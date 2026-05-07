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
  rating: string | null;
  category: string | null;
}

export interface ScrapeOutput {
  leads: LeadInsert[];
  errors: string[];
  log: ScrapeLog;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

const MAX_RESULTS = 15;

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
    `[Scraper] Location → municipality="${parsedLocation.municipality}" | ` +
    `barangay="${parsedLocation.barangay}" | province="${parsedLocation.province}"`
  );

  let raw: RawBusiness[] = [];

  try {
    raw = await scrapeMaps(generatedQuery, parsedLocation);
    console.log(`[Scraper] Maps raw results: ${raw.length}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Scrape engine failed: ${message}`);
    console.error(`[Scraper] Fatal error: ${message}`);
  }

  const { items: filtered, breakdown } = filterByLocation(raw, parsedLocation);

  console.log(
    `[Scraper] After location filter: ${filtered.length}/${raw.length} kept ` +
    `(HIGH=${breakdown.high} MEDIUM=${breakdown.medium} LOW=${breakdown.low} ` +
    `UNKNOWN=${breakdown.unknown} discarded=${breakdown.discarded})`
  );

  if (raw.length > 0 && breakdown.high === 0 && breakdown.medium === 0) {
    errors.push(
      `No results exactly matched "${parsedLocation.primaryTarget}". ` +
      `Showing ${filtered.length} partial results — verify addresses manually.`
    );
  }

  const leads: LeadInsert[] = filtered.map((biz) => {
    const { qualification, qualification_reason } = qualifyLead({
      email: biz.email,
      phone: biz.phone,
      website: biz.website,
    });

    const noteParts: string[] = [];
    if (biz.rating) noteParts.push(`Rating: ${biz.rating}`);
    if (biz.category) noteParts.push(`Category: ${biz.category}`);

    return {
      company_name: biz.company_name,
      industry: industry || biz.category || "General",
      email: biz.email,
      phone: biz.phone,
      website: biz.website,
      facebook: biz.facebook,
      address: biz.address,
      qualification,
      qualification_reason,
      notes: noteParts.length > 0 ? noteParts.join(" | ") : null,
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
// Google Maps scraping orchestrator
// ---------------------------------------------------------------------------

async function scrapeMaps(
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
      },
    });

    // Stealth: remove webdriver fingerprint
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
      (window as any).chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}), app: {} };
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    // ── Navigate directly to Maps search URL ─────────────────────────────
    // Using the path-based search URL bypasses the search box interaction
    // entirely and is far more reliable than fill → Enter.
    const mapsQuery = `${generatedQuery}, Philippines`;
    const searchUrl =
      `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}?hl=en&gl=ph`;

    console.log(`[Scraper] Maps URL: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await jitter(1500, 2500);

    await dismissConsentBanner(page);
    await jitter(800, 1500);

    // CAPTCHA guard
    const pageTitle = await page.title();
    if (/captcha|unusual traffic|sorry/i.test(pageTitle)) {
      await saveDebugScreenshot(page, "captcha");
      throw new Error("Google Maps CAPTCHA detected");
    }

    // ── Wait for feed to be populated (not just to exist) ─────────────────
    // The feed container appears on the Maps homepage too (empty). We must
    // wait until at least one place link is inside it.
    let feedHasResults = false;
    try {
      await page.waitForFunction(
        () => {
          const feed = document.querySelector('div[role="feed"]');
          return !!feed && feed.querySelectorAll('a[href*="/maps/place/"]').length > 0;
        },
        { timeout: 30000 }
      );
      feedHasResults = true;
    } catch {
      // Feed may be absent — check alternate states below
    }

    if (!feedHasResults) {
      // Maps sometimes opens a single-place detail panel for very specific queries
      const hasSinglePlace = (await page.$("h1")) !== null;
      if (hasSinglePlace) {
        console.log("[Scraper] Maps opened single-place panel — extracting directly");
        const biz = await extractPlaceDetails(page, context, page.url());
        return biz ? [biz] : [];
      }

      const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
      if (/no results|didn.t find|couldn.t find/i.test(bodyText)) {
        console.log("[Scraper] Maps returned no results");
        return [];
      }

      await saveDebugScreenshot(page, "no-feed");
      throw new Error("Maps results feed did not load or is empty after 30 s");
    }

    await jitter(1500, 2500);

    // ── Step 4: Scroll feed to collect place URLs ─────────────────────────
    const placeUrls = await scrollFeedAndCollectUrls(page, MAX_RESULTS);
    console.log(`[Scraper] Collected ${placeUrls.length} place URLs`);

    if (placeUrls.length === 0) {
      return [];
    }

    // ── Step 5: Extract details from each place ───────────────────────────
    const seen = new Set<string>();

    for (const placeUrl of placeUrls) {
      if (results.length >= MAX_RESULTS) break;

      try {
        await jitter(2000, 3500);
        const biz = await extractPlaceDetails(page, context, placeUrl);

        if (biz && biz.company_name && !seen.has(biz.company_name.toLowerCase())) {
          results.push(biz);
          seen.add(biz.company_name.toLowerCase());
          console.log(
            `[Scraper] ✓ "${biz.company_name}" | addr="${biz.address ?? "—"}" | ` +
            `phone=${biz.phone ?? "—"} | rating=${biz.rating ?? "—"}`
          );
        }
      } catch (err) {
        console.log(
          `[Scraper] ✗ Skipped place: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

// ---------------------------------------------------------------------------
// Scroll the Maps results panel and collect all place URLs
// ---------------------------------------------------------------------------

async function scrollFeedAndCollectUrls(page: Page, maxResults: number): Promise<string[]> {
  const collectedUrls = new Set<string>();
  let consecutiveNoChange = 0;
  const MAX_STALE_ROUNDS = 4;

  for (let round = 0; round < 25; round++) {
    // Harvest URLs from the current state of the feed
    const freshUrls: string[] = await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (!feed) return [];
      return Array.from(feed.querySelectorAll('a[href*="/maps/place/"]'))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((h) => h.includes("/maps/place/"));
    });

    const prevSize = collectedUrls.size;
    for (const url of freshUrls) {
      collectedUrls.add(url);
    }

    console.log(
      `[Scraper] Scroll round ${round + 1}: +${collectedUrls.size - prevSize} URLs ` +
      `(total ${collectedUrls.size})`
    );

    if (collectedUrls.size >= maxResults) break;

    if (collectedUrls.size === prevSize) {
      consecutiveNoChange++;
    } else {
      consecutiveNoChange = 0;
    }
    if (consecutiveNoChange >= MAX_STALE_ROUNDS) {
      console.log("[Scraper] No new URLs after repeated scrolls — end of results");
      break;
    }

    // Check for end-of-list text in the feed
    const reachedEnd = await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      const text = (feed as HTMLElement | null)?.innerText ?? "";
      return (
        text.includes("You've reached the end") ||
        text.includes("reached the end of the list") ||
        text.includes("No more results")
      );
    });
    if (reachedEnd) {
      console.log("[Scraper] Maps feed reported end of results");
      break;
    }

    // Scroll the feed panel (not the window)
    await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (feed) feed.scrollTop += 600;
    });

    await jitter(1500, 2500);
  }

  return Array.from(collectedUrls).slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// Navigate to a Maps place URL and extract all details
// ---------------------------------------------------------------------------

async function extractPlaceDetails(
  mapPage: Page,
  context: BrowserContext,
  placeUrl: string
): Promise<RawBusiness | null> {
  await mapPage.goto(placeUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

  // Wait for the business name header
  try {
    await mapPage.waitForSelector("h1", { timeout: 12000 });
  } catch {
    return null;
  }

  await jitter(1000, 2000);

  const data = await mapPage.evaluate(() => {
    // ── Name ──────────────────────────────────────────────────────────────
    const name = document.querySelector("h1")?.textContent?.trim() ?? "";

    // ── Category ──────────────────────────────────────────────────────────
    // Google Maps places the category in a button near the top of the detail panel.
    // Class names are obfuscated but several stable patterns exist.
    const categorySelectors = [
      "button.DkEaL",
      "button[jsaction*='category']",
      "[jsan*='t_i.localPlaceDetailsTab.category']",
      ".rogA2c .fontBodyMedium",
    ];
    let category: string | null = null;
    for (const sel of categorySelectors) {
      const el = document.querySelector(sel);
      const text = el?.textContent?.trim();
      if (text && text.length > 1 && text.length < 80) {
        category = text;
        break;
      }
    }

    // ── Phone ──────────────────────────────────────────────────────────────
    // data-item-id for phone is "phone:tel:+63XXXXXXXXX" — the number is in the attribute itself
    const phoneDataEl = document.querySelector("[data-item-id^='phone:tel:']");
    const phoneFromDataId =
      phoneDataEl?.getAttribute("data-item-id")?.replace("phone:tel:", "").trim() ?? null;

    // Fallback: tel: anchor link
    const telAnchor = document.querySelector("a[href^='tel:']") as HTMLAnchorElement | null;
    const phoneFromTel = telAnchor?.href?.replace("tel:", "").trim() ?? null;

    // Fallback: aria-label on phone button
    const phoneBtnLabel =
      document
        .querySelector("[data-item-id^='phone']")
        ?.getAttribute("aria-label")
        ?.replace(/^Phone:\s*/i, "")
        .trim() ?? null;

    const phone = phoneFromDataId ?? phoneFromTel ?? phoneBtnLabel ?? null;

    // ── Website ────────────────────────────────────────────────────────────
    // data-item-id="authority" is stable for the external website link
    const websiteEl = document.querySelector("a[data-item-id='authority']") as HTMLAnchorElement | null;
    let website = websiteEl?.href ?? null;

    // Unwrap Google redirect URLs (/url?q=...)
    if (website?.includes("google.com/url")) {
      try {
        const u = new URL(website);
        const dest = u.searchParams.get("q");
        if (dest) website = dest;
      } catch {
        /* keep original */
      }
    }

    // ── Address ────────────────────────────────────────────────────────────
    // data-item-id="address" marks the address section
    const addrEl = document.querySelector("[data-item-id='address']");
    let address: string | null = null;
    if (addrEl) {
      // Inner text of the display span/div (not icon text)
      const addrText =
        addrEl.querySelector(".fontBodyMedium")?.textContent?.trim() ??
        addrEl.querySelector("span:last-child")?.textContent?.trim() ??
        (addrEl as HTMLElement).innerText?.split("\n").find((l) => l.trim().length > 4) ??
        null;

      // aria-label is "Address: <value>"
      const addrLabel =
        addrEl.getAttribute("aria-label")?.replace(/^Address:\s*/i, "").trim() ?? null;

      // Prefer display text over aria-label (aria-label is often truncated)
      address = addrText && addrText.length > 4 ? addrText : addrLabel;
    }

    // Fallback: aria-label="Address: ..." on any element
    if (!address) {
      const fallbackAddrEl = document.querySelector("[aria-label^='Address:']");
      if (fallbackAddrEl) {
        address =
          fallbackAddrEl.getAttribute("aria-label")?.replace(/^Address:\s*/i, "").trim() ?? null;
      }
    }

    // ── Rating ─────────────────────────────────────────────────────────────
    // aria-label is "4.1 stars " (trailing space) — match the leading number
    const ratingEl =
      document.querySelector("span[aria-label*='stars']") ??
      document.querySelector("span[aria-label*='star']");
    const ratingRaw = ratingEl?.getAttribute("aria-label") ?? "";
    const ratingMatch = ratingRaw.match(/^([\d.]+)/);
    const rating = ratingMatch ? ratingMatch[1] : null;

    return { name, category, phone, website, address, rating };
  });

  if (!data.name) return null;

  // ── Website visit for email and Facebook ──────────────────────────────
  let email: string | null = null;
  let facebook: string | null = null;

  if (data.website) {
    try {
      await jitter(1200, 2200);
      const siteData = await scrapeWebsiteForContact(context, data.website);
      email = siteData.email;
      facebook = siteData.facebook;
    } catch {
      // non-fatal — Maps data is still usable without email
    }
  }

  return {
    company_name: data.name,
    phone: data.phone,
    email,
    website: data.website,
    address: data.address,
    facebook,
    rating: data.rating,
    category: data.category,
  };
}

// ---------------------------------------------------------------------------
// Visit a business website to extract email and Facebook link
// ---------------------------------------------------------------------------

async function scrapeWebsiteForContact(
  context: BrowserContext,
  url: string
): Promise<{ email: string | null; facebook: string | null }> {
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
    await jitter(500, 1000);

    const result = await page.evaluate(() => {
      // ── Email ──────────────────────────────────────────────────────────
      const mailAnchor = document.querySelector("a[href^='mailto:']") as HTMLAnchorElement | null;
      const emailFromLink =
        mailAnchor?.href?.replace("mailto:", "").split("?")[0].trim() ?? null;

      const schemaEmail =
        document.querySelector("[itemprop='email']")?.textContent?.trim() ?? null;

      let emailFromBody: string | null = null;
      const bodyText = (document.body as HTMLElement)?.innerText ?? "";
      const emailMatches = bodyText.match(
        /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
      );
      if (emailMatches) {
        emailFromBody =
          emailMatches.find(
            (e) =>
              !e.endsWith("example.com") &&
              !e.startsWith("email@") &&
              !e.includes("youremail") &&
              !e.includes("sample@") &&
              !e.includes("user@") &&
              e.length < 80
          ) ?? null;
      }

      const email = emailFromLink ?? schemaEmail ?? emailFromBody ?? null;

      // ── Facebook ───────────────────────────────────────────────────────
      const fbAnchor = Array.from(
        document.querySelectorAll("a[href*='facebook.com'], a[href*='fb.com']") as NodeListOf<HTMLAnchorElement>
      ).find((a) => !a.href.includes("/sharer") && !a.href.includes("/share?"));
      const facebook = fbAnchor?.href ?? null;

      return { email, facebook };
    });

    return result;
  } catch {
    return { email: null, facebook: null };
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

async function saveDebugScreenshot(page: Page, label: string): Promise<void> {
  try {
    const path = `/tmp/maps-debug-${label}-${Date.now()}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log(`[Scraper] Debug screenshot → ${path}`);
  } catch {
    // non-fatal
  }
}

async function dismissConsentBanner(page: Page): Promise<void> {
  const selectors = [
    "#L2AGLb",
    "button[aria-label*='Accept all']",
    "button[aria-label*='Accept All']",
    "button[aria-label*='accept all']",
    "button[aria-label*='Agree']",
    "button[id*='accept']",
    "form[action*='consent'] button",
  ];

  for (const sel of selectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await jitter(600, 1200);
        return;
      }
    } catch {
      // selector not found — try next
    }
  }
}
