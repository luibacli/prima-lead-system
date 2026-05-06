import type { LeadInsert, ScrapeLog } from "@/types/lead";
import type { Page, BrowserContext } from "playwright";
import { qualifyLead } from "./qualification";
import { buildSearchQuery, parseLocation, type ParsedLocation } from "./query-builder";
import { filterByLocation } from "./location-filter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawBusiness {
  company_name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  facebook: string | null;
  address: string | null;
}

export interface ScrapeOutput {
  leads: LeadInsert[];
  errors: string[];
  log: ScrapeLog;
}

// ---------------------------------------------------------------------------
// Anti-detection constants
// ---------------------------------------------------------------------------

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

export async function scrapeBusinesses(
  keyword: string,
  location: string,
  industry: string
): Promise<ScrapeOutput> {
  const errors: string[] = [];
  const parsedLocation = parseLocation(location);
  const generatedQuery = buildSearchQuery({ keyword, industry, location });

  console.log(`[Scraper] Generated query: "${generatedQuery}"`);
  console.log(
    `[Scraper] Location parsed → municipality="${parsedLocation.municipality}" | ` +
    `barangay="${parsedLocation.barangay}" | province="${parsedLocation.province}"`
  );

  let raw: RawBusiness[] = [];
  let usedMock = false;

  try {
    raw = await scrapeGoogle(generatedQuery, parsedLocation);
    console.log(`[Scraper] Google raw results: ${raw.length}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Scrape engine failed: ${message}. Showing generated sample data.`);
    usedMock = true;
    raw = getMockData(keyword, location, industry, parsedLocation);
    console.log(`[Scraper] Fallback mock data: ${raw.length} items`);
  }

  // Apply location relevance filter
  const { items: filtered, breakdown } = filterByLocation(raw, parsedLocation);

  console.log(
    `[Scraper] After location filter: ${filtered.length}/${raw.length} kept ` +
    `(HIGH=${breakdown.high} MEDIUM=${breakdown.medium} LOW=${breakdown.low} ` +
    `UNKNOWN=${breakdown.unknown} discarded=${breakdown.discarded})`
  );

  if (!usedMock && breakdown.high === 0 && breakdown.medium === 0 && raw.length > 0) {
    errors.push(
      `No scraped results exactly matched "${parsedLocation.primaryTarget}". ` +
      `Showing ${filtered.length} partial results — verify addresses manually.`
    );
  }

  const leads: LeadInsert[] = filtered.map((biz) => {
    const { qualification, qualification_reason } = qualifyLead({
      email: biz.email,
      phone: biz.phone,
      website: biz.website,
    });
    return {
      company_name: biz.company_name,
      industry: industry || "General",
      email: biz.email,
      phone: biz.phone,
      website: biz.website,
      facebook: biz.facebook,
      address: biz.address,
      qualification,
      qualification_reason,
      notes: null,
      status: "New",
    };
  });

  const log: ScrapeLog = {
    generatedQuery,
    detectedLocation: parsedLocation.primaryTarget,
    totalScraped: raw.length,
    afterFilter: filtered.length,
    locationBreakdown: {
      high: breakdown.high,
      medium: breakdown.medium,
      low: breakdown.low,
      discarded: breakdown.discarded,
    },
  };

  return { leads, errors, log };
}

// ---------------------------------------------------------------------------
// Google Search scraping
// ---------------------------------------------------------------------------

async function scrapeGoogle(
  generatedQuery: string,
  parsedLocation: ParsedLocation
): Promise<RawBusiness[]> {
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1366,768",
    ],
  });

  const results: RawBusiness[] = [];

  try {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const context = await browser.newContext({
      userAgent: ua,
      viewport: { width: 1366, height: 768 },
      locale: "en-PH",
      timezoneId: "Asia/Manila",
      extraHTTPHeaders: {
        "Accept-Language": "en-PH,en;q=0.9,fil;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    // Stealth: remove webdriver flag and inject realistic browser properties
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "languages", { get: () => ["en-PH", "en", "fil"] });
      Object.defineProperty(navigator, "plugins", {
        get: () => [
          { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format", length: 1 },
          { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", description: "", length: 1 },
          { name: "Native Client", filename: "internal-nacl-plugin", description: "", length: 2 },
        ],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).chrome = {
        runtime: {},
        loadTimes: () => ({}),
        csi: () => ({}),
        app: {},
      };
    });

    const page = await context.newPage();
    page.setDefaultTimeout(20000);

    // Append "Philippines" so Google prioritises PH-based results.
    // gl=ph  → country filter Philippines
    // hl=en  → English results
    // num=20 → 20 results per page
    const fullQuery = `${generatedQuery} Philippines`;
    const searchUrl =
      `https://www.google.com/search` +
      `?q=${encodeURIComponent(fullQuery)}` +
      `&gl=ph&hl=en&num=20`;

    console.log(`[Scraper] Google URL: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Detect hard block / CAPTCHA
    const title = await page.title();
    if (/captcha|unusual traffic|sorry/i.test(title)) {
      throw new Error("Google CAPTCHA or rate-limit detected");
    }

    // Dismiss any consent / cookie banner
    await dismissConsentBanner(page);

    // Small delay — appears more human-like
    await jitter(800, 1800);

    // Scroll slightly to trigger lazy-loaded results
    await page.evaluate(() => window.scrollBy(0, 350));
    await jitter(400, 800);

    // ── 1. Extract Google Local Pack (business map cards) ─────────────────
    const localResults = await extractLocalPack(page);
    console.log(`[Scraper] Local pack extracted: ${localResults.length}`);
    results.push(...localResults);

    // ── 2. Extract organic result URLs + titles ───────────────────────────
    const organicEntries = await extractOrganicEntries(page);
    console.log(`[Scraper] Organic entries: ${organicEntries.length}`);

    // ── 3. Visit business pages for phone / email / address / Facebook ────
    const seen = new Set(results.map((r) => r.company_name.toLowerCase()));
    const toVisit = organicEntries
      .filter((e) => !shouldSkipUrl(e.url))
      .slice(0, 6);

    for (const entry of toVisit) {
      try {
        await jitter(1200, 2800);
        const biz = await visitBusinessPage(context, entry.url, entry.title, parsedLocation);
        if (biz && !seen.has(biz.company_name.toLowerCase())) {
          results.push(biz);
          seen.add(biz.company_name.toLowerCase());
        }
      } catch (err) {
        console.log(`[Scraper] Skip ${entry.url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // ── 4. If still nothing, broaden to municipality-only ─────────────────
    if (results.length === 0 && parsedLocation.municipality) {
      console.log("[Scraper] No results — retrying with municipality fallback");
      const fallbackQuery =
        `businesses in ${parsedLocation.municipality}` +
        (parsedLocation.province ? `, ${parsedLocation.province}` : "") +
        " Philippines";

      await jitter(1000, 2000);
      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(fallbackQuery)}&gl=ph&hl=en&num=20`,
        { waitUntil: "domcontentloaded", timeout: 25000 }
      );
      await jitter(600, 1200);

      const fallbackLocal = await extractLocalPack(page);
      const fallbackOrganic = await extractOrganicEntries(page);

      results.push(...fallbackLocal);

      for (const entry of fallbackOrganic.filter((e) => !shouldSkipUrl(e.url)).slice(0, 3)) {
        try {
          await jitter(1000, 2000);
          const biz = await visitBusinessPage(context, entry.url, entry.title, parsedLocation);
          if (biz && !seen.has(biz.company_name.toLowerCase())) {
            results.push(biz);
            seen.add(biz.company_name.toLowerCase());
          }
        } catch {
          // non-fatal
        }
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

// ---------------------------------------------------------------------------
// Local Pack extraction
// ---------------------------------------------------------------------------

async function extractLocalPack(page: Page): Promise<RawBusiness[]> {
  // Google local pack entries always link to /maps/place/.
  // We find those anchor elements and read structured text from their
  // closest ancestor that looks like a self-contained business card.
  return page
    .evaluate(() => {
      const PH_PHONE =
        /(?:\+63|0)[\s\-.]?(?:\d{2,3}[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}|\d{10})/g;

      const ADDRESS_HINTS =
        /\b(?:st\.?|street|avenue|ave\.?|road|rd\.?|blvd|boulevard|drive|dr\.?|highway|hwy|national|barangay|brgy\.?|purok|zone|sitio|village|vill\.|subdivision|subd\.?|cebu|mandaue|lapu-lapu|davao|manila)\b/i;

      const results: Array<{
        company_name: string;
        address: string | null;
        phone: string | null;
        website: string | null;
        facebook: string | null;
        email: string | null;
      }> = [];

      const seen = new Set<string>();

      // All links pointing to a Google Maps place page
      const mapAnchors = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="/maps/place/"]')
      );

      for (const anchor of mapAnchors.slice(0, 12)) {
        // Walk up until we find a container with enough text lines
        let container: Element | null = anchor;
        for (let depth = 0; depth < 6; depth++) {
          const parent: Element | null = container ? container.parentElement : null;
          if (!parent) break;
          const lines = (parent as HTMLElement).innerText
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          if (lines.length >= 3) { container = parent; break; }
          container = parent;
        }
        if (!container) continue;

        const rawText = (container as HTMLElement).innerText ?? "";
        const lines = rawText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) continue;

        // First meaningful line is the business name
        const company_name = lines[0];
        if (
          company_name.length < 2 ||
          company_name.length > 120 ||
          seen.has(company_name.toLowerCase())
        ) continue;
        seen.add(company_name.toLowerCase());

        // Phone — first PH-format match in the card text
        const phoneMatches = rawText.match(PH_PHONE);
        const phone = phoneMatches ? phoneMatches[0].trim() : null;

        // Address — line that looks like a street / location
        const address =
          lines.slice(1).find((l) => ADDRESS_HINTS.test(l) && l.length > 10) ?? null;

        // Website link inside the card (non-Google, non-Maps)
        const websiteAnchor = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find(
          (a) =>
            a.href &&
            !a.href.includes("google.com") &&
            !a.href.includes("maps") &&
            a.href.startsWith("http")
        );
        const website = websiteAnchor?.href ?? null;

        // Facebook link inside the card
        const fbAnchor = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find(
          (a) => a.href.includes("facebook.com") || a.href.includes("fb.com")
        );
        const facebook = fbAnchor?.href ?? null;

        results.push({ company_name, address, phone, website, facebook, email: null });
      }

      return results;
    })
    .catch(() => [] as RawBusiness[]);
}

// ---------------------------------------------------------------------------
// Organic results extraction
// ---------------------------------------------------------------------------

async function extractOrganicEntries(
  page: Page
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  return page
    .evaluate(() => {
      const items: Array<{ title: string; url: string; snippet: string }> = [];

      // #rso is the main results container in Google Search
      const resultDivs = Array.from(
        document.querySelectorAll<HTMLElement>(
          "#rso > div, #rso > div > div, div[data-sokoban-container]"
        )
      );

      for (const div of resultDivs) {
        const h3 = div.querySelector<HTMLElement>("h3");
        const anchor = div.querySelector<HTMLAnchorElement>("a[href]");
        const snippetEl = div.querySelector<HTMLElement>(
          "[data-sncf], .VwiC3b, [class*='snippet'], [class*='lEBKkf']"
        );

        const title = h3?.innerText?.trim() ?? "";
        const url = anchor?.href ?? "";
        const snippet = snippetEl?.innerText?.trim() ?? "";

        if (
          title.length > 2 &&
          url.startsWith("http") &&
          !url.includes("google.com") &&
          !url.includes("googleusercontent")
        ) {
          items.push({ title, url, snippet });
        }
      }

      return items;
    })
    .catch(() => []);
}

// ---------------------------------------------------------------------------
// Individual business page visitation
// ---------------------------------------------------------------------------

async function visitBusinessPage(
  context: BrowserContext,
  url: string,
  fallbackTitle: string,
  parsedLocation: ParsedLocation
): Promise<RawBusiness | null> {
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await jitter(400, 900);

    const locParts = parsedLocation.parts; // passed into evaluate below

    const data = await page.evaluate(
      (args: { locParts: string[] }) => {
        const PH_PHONE =
          /(?:\+63|0)[\s\-.]?(?:\d{2,3}[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}|\d{10})/;

        // ── Company name ──────────────────────────────────────────────────
        const schemaName = document
          .querySelector<HTMLElement>(
            '[itemtype*="Organization"] [itemprop="name"], [itemtype*="LocalBusiness"] [itemprop="name"]'
          )
          ?.innerText?.trim();

        const h1Name = document.querySelector<HTMLElement>("h1")?.innerText?.trim();

        const titleName = document.title?.split(/[-|·–]/)[0]?.trim();

        const company_name = schemaName ?? h1Name ?? titleName ?? "";

        // ── Phone ─────────────────────────────────────────────────────────
        const telAnchor = document.querySelector<HTMLAnchorElement>("a[href^='tel:']");
        const telFromLink = telAnchor?.href?.replace("tel:", "").trim() ?? null;

        const schemaTel = document
          .querySelector<HTMLElement>("[itemprop='telephone']")
          ?.innerText?.trim() ?? null;

        const bodyPhone = (() => {
          const bodyText = (document.body as HTMLElement).innerText ?? "";
          const m = bodyText.match(PH_PHONE);
          return m ? m[0].trim() : null;
        })();

        const phone = telFromLink ?? schemaTel ?? bodyPhone ?? null;

        // ── Email ─────────────────────────────────────────────────────────
        const mailAnchor = document.querySelector<HTMLAnchorElement>("a[href^='mailto:']");
        const email =
          mailAnchor?.href?.replace("mailto:", "").split("?")[0].trim() ??
          document.querySelector<HTMLElement>("[itemprop='email']")?.innerText?.trim() ??
          null;

        // ── Address ───────────────────────────────────────────────────────
        const schemaAddr =
          document.querySelector<HTMLElement>("[itemprop='address']")?.innerText?.trim() ??
          document.querySelector<HTMLElement>("[itemprop='streetAddress']")?.innerText?.trim() ??
          null;

        const domAddr =
          document
            .querySelector<HTMLElement>(".address, #address, [class*='address'], footer address")
            ?.innerText?.trim() ?? null;

        // Prefer the address that contains a known location token
        let address = schemaAddr ?? domAddr ?? null;
        if (address && args.locParts.length > 0) {
          const addrLower = address.toLowerCase();
          const hasMatch = args.locParts.some((p) => p.length >= 4 && addrLower.includes(p));
          if (!hasMatch && domAddr) address = domAddr;
        }

        // ── Facebook ──────────────────────────────────────────────────────
        const fbAnchor = Array.from(
          document.querySelectorAll<HTMLAnchorElement>("a[href*='facebook.com'], a[href*='fb.com']")
        ).find((a) => !a.href.includes("share") && !a.href.includes("sharer"));
        const facebook = fbAnchor?.href ?? null;

        return { company_name, phone, email, address, facebook };
      },
      { locParts }
    );

    if (!data.company_name && !fallbackTitle) return null;

    return {
      company_name: data.company_name || fallbackTitle,
      phone: data.phone,
      email: data.email,
      address: data.address,
      website: url,
      facebook: data.facebook,
    };
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jitter(minMs: number, maxMs: number): Promise<void> {
  return new Promise((r) => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

async function dismissConsentBanner(page: Page): Promise<void> {
  // Google consent buttons (mainly for EU but can appear elsewhere)
  const consentSelectors = [
    'button[id*="accept"]',
    'button[aria-label*="Accept"]',
    'button[aria-label*="agree"]',
    '#L2AGLb',            // "I agree" button
    'form[action*="consent"] button',
  ];
  for (const sel of consentSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await jitter(400, 800);
        return;
      }
    } catch {
      // selector not found
    }
  }
}

function shouldSkipUrl(url: string): boolean {
  const SKIP = [
    "google.com", "googleapis.com", "googleusercontent.com",
    "youtube.com", "twitter.com", "x.com", "instagram.com",
    "wikipedia.org", "wikimedia.org",
    "facebook.com",        // FB pages require login to scrape properly
    "linkedin.com",
    "philstar.com", "inquirer.net", "abs-cbn.com", "sunstar.com.ph",
    "rappler.com", "mb.com.ph", "gmanetwork.com", "manilatimes.net",
    "pagasa.dost.gov.ph", "bsp.gov.ph",
    "amazon.com", "shopee.ph", "lazada.com.ph",
  ];
  return SKIP.some((pattern) => url.includes(pattern));
}

// ---------------------------------------------------------------------------
// Mock fallback (only used when Playwright fails entirely)
// ---------------------------------------------------------------------------

function getMockData(
  keyword: string,
  location: string,
  industry: string,
  parsed: ParsedLocation
): RawBusiness[] {
  void industry; // industry is baked into the location context

  const prefixes = [
    "Cebu", "Visayas", "Pacific", "Metro", "Prime", "Global", "Allied", "Summit",
    "Horizon", "First", "Pioneer", "Excellence", "Premier", "Southern", "Island",
    "Eastern", "Northern", "Central", "Western", "Royal",
  ];
  const suffixes = [
    "Solutions", "Services", "Corporation", "Enterprises", "Group", "Holdings",
    "Industries", "Systems", "Technologies", "Trading", "Ventures", "Builders",
  ];
  const domains = ["gmail.com", "yahoo.com", "outlook.com"];

  const primaryLoc = parsed.municipality ?? parsed.province ?? location;
  const province = parsed.province ?? location;
  const brgy = parsed.barangay;

  // Addresses are built from the ACTUAL input location — never hardcoded cities
  const addresses = [
    `${brgy ? brgy + ", " : ""}${primaryLoc}, ${province}`,
    `National Highway, ${primaryLoc}, ${province}`,
    `Purok 2, Barangay Center, ${primaryLoc}, ${province}`,
    `Zone 1, ${primaryLoc}, ${province}`,
    `Main Road, ${primaryLoc}, ${province}`,
    `Commercial Street, ${primaryLoc}, ${province}`,
    `Industrial Zone, ${primaryLoc}, ${province}`,
    `Poblacion, ${primaryLoc}, ${province}`,
    `${primaryLoc}, ${province}`,       // minimal — MEDIUM after filter
    `${province} Province`,             // province-only — MEDIUM
  ];

  const base = `${keyword} ${location}`.toLowerCase();
  const seed = base.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  return Array.from({ length: 12 }, (_, i) => {
    const r = (n: number) => (seed + i * 7 + n) % 10;
    const prefix = prefixes[(seed + i * 3) % prefixes.length];
    const suffix = suffixes[(seed + i * 5) % suffixes.length];
    const name = `${prefix} ${suffix}`;
    const slug = name.toLowerCase().replace(/\s+/g, "");

    return {
      company_name: name,
      email: r(1) > 3 ? `info@${slug}.${domains[r(5) % domains.length]}` : null,
      phone: r(2) > 2 ? `+63 32 ${200 + r(6)}${r(7)} ${1000 + seed + i}` : null,
      website: r(3) > 4 ? `https://www.${slug}.com.ph` : null,
      facebook: r(4) > 5 ? `https://facebook.com/${slug}` : null,
      address: addresses[i % addresses.length],
    };
  });
}
