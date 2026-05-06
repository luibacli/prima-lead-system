import type { LeadInsert, ScrapeLog } from "@/types/lead";
import { qualifyLead } from "./qualification";
import { buildSearchQuery, parseLocation, type ParsedLocation } from "./query-builder";
import { filterByLocation } from "./location-filter";

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

export async function scrapeBusinesses(
  keyword: string,
  location: string,
  industry: string
): Promise<ScrapeOutput> {
  const errors: string[] = [];
  const parsedLocation = parseLocation(location);
  const generatedQuery = buildSearchQuery({ keyword, industry, location });

  console.log(`[Scraper] Generated query: "${generatedQuery}"`);
  console.log(`[Scraper] Parsed location: municipality="${parsedLocation.municipality}" | barangay="${parsedLocation.barangay}" | province="${parsedLocation.province}"`);

  let raw: RawBusiness[] = [];
  let usedMock = false;

  try {
    raw = await scrapeBusinessListPH(generatedQuery, parsedLocation);
    console.log(`[Scraper] Raw scraped results: ${raw.length}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Scrape engine failed: ${message}. Showing generated sample data.`);
    usedMock = true;
    raw = getMockData(keyword, location, industry, parsedLocation);
    console.log(`[Scraper] Using mock data (${raw.length} items) due to scrape failure`);
  }

  // Apply location relevance filter
  const { items: filtered, breakdown } = filterByLocation(raw, parsedLocation);

  console.log(
    `[Scraper] After location filter: ${filtered.length}/${raw.length} kept ` +
    `(HIGH=${breakdown.high}, MEDIUM=${breakdown.medium}, LOW=${breakdown.low}, UNKNOWN=${breakdown.unknown}, discarded=${breakdown.discarded})`
  );

  if (!usedMock && breakdown.high === 0 && breakdown.medium === 0 && raw.length > 0) {
    errors.push(
      `No results matched location "${parsedLocation.primaryTarget}". ` +
      `Showing ${filtered.length} unfiltered results — addresses may differ from your target area.`
    );
  }

  // Map to LeadInsert
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

async function scrapeBusinessListPH(
  generatedQuery: string,
  parsedLocation: ParsedLocation
): Promise<RawBusiness[]> {
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const results: RawBusiness[] = [];

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-PH",
    });

    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    // Use the fully composed query — no partial queries
    const encodedQuery = encodeURIComponent(generatedQuery);
    const searchUrl = `https://www.businesslist.ph/search?q=${encodedQuery}`;
    console.log(`[Scraper] Fetching: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });

    // Wait for any known listing selector
    await page
      .waitForSelector(".listing_title, .business-name, h2 a, .company-name, .listing", {
        timeout: 10000,
      })
      .catch(() => null);

    const listings: RawBusiness[] = await page
      .$$eval(".listing, .business-item, article, .search-result, li.listing", (els: Element[]) =>
        els.slice(0, 25).map((el) => {
          const text = (sel: string): string | null =>
            el.querySelector(sel)?.textContent?.trim() ?? null;
          const href = (sel: string): string | null =>
            (el.querySelector(sel) as HTMLAnchorElement | null)?.href ?? null;

          // Company name — try multiple selector patterns
          const company_name =
            text(".listing_title") ??
            text("h3.listing_title") ??
            text(".business-name") ??
            text("h2 a") ??
            text("h3 a") ??
            text("h4 a") ??
            text(".company-name") ??
            text("[class*='title'] a") ??
            "Unknown Business";

          const phone =
            text(".phone") ??
            text(".listing_phone") ??
            text("[class*='phone']") ??
            text("[itemprop='telephone']") ??
            null;

          const address =
            text(".address") ??
            text(".listing_address") ??
            text("[class*='address']") ??
            text("[itemprop='address']") ??
            text(".location") ??
            null;

          const website =
            href(".website a") ??
            href("[class*='website'] a") ??
            href("a[rel='nofollow'][target='_blank']") ??
            null;

          const email =
            text(".email") ??
            text("[class*='email']") ??
            text("[itemprop='email']") ??
            null;

          return { company_name, phone, address, website, email, facebook: null };
        })
      )
      .catch(() => [] as RawBusiness[]);

    // Enrich up to 6 listings by visiting their detail pages
    const detailUrls = await page
      .$$eval(
        ".listing_title a, .business-name a, h2 a, h3 a, h4 a",
        (els: Element[]) =>
          (els as HTMLAnchorElement[])
            .slice(0, 6)
            .map((a) => a.href)
            .filter((u) => u && u.startsWith("http"))
      )
      .catch(() => [] as string[]);

    for (let i = 0; i < Math.min(detailUrls.length, listings.length); i++) {
      try {
        const detail = await scrapeDetailPage(context, detailUrls[i]);
        listings[i] = {
          ...listings[i],
          email: detail.email ?? listings[i].email,
          phone: detail.phone ?? listings[i].phone,
          website: detail.website ?? listings[i].website,
          facebook: detail.facebook ?? listings[i].facebook,
          address: detail.address ?? listings[i].address,
        };
      } catch {
        // Non-fatal: skip detail page failures
      }
    }

    // Pre-filter obvious unknowns before location scoring
    results.push(...listings.filter((l) => l.company_name !== "Unknown Business"));

    // Location-aware: if the site returned zero results, try again with just the municipality
    if (results.length === 0 && parsedLocation.municipality) {
      console.log(`[Scraper] Zero results — retrying with municipality-only query`);
      const fallbackQuery = encodeURIComponent(
        `${parsedLocation.municipality} business`
      );
      await page.goto(
        `https://www.businesslist.ph/search?q=${fallbackQuery}`,
        { waitUntil: "domcontentloaded", timeout: 20000 }
      );

      const fallback: RawBusiness[] = await page
        .$$eval(".listing, article, li.listing", (els: Element[]) =>
          els.slice(0, 15).map((el) => {
            const text = (sel: string): string | null =>
              el.querySelector(sel)?.textContent?.trim() ?? null;
            const href = (sel: string): string | null =>
              (el.querySelector(sel) as HTMLAnchorElement | null)?.href ?? null;
            return {
              company_name:
                text(".listing_title") ?? text("h3 a") ?? text("h2 a") ?? "Unknown Business",
              phone: text(".phone") ?? text("[class*='phone']") ?? null,
              address: text(".address") ?? text("[class*='address']") ?? null,
              website: href(".website a") ?? null,
              email: null,
              facebook: null,
            };
          })
        )
        .catch(() => [] as RawBusiness[]);

      results.push(...fallback.filter((l) => l.company_name !== "Unknown Business"));
    }
  } finally {
    await browser.close();
  }

  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scrapeDetailPage(context: any, url: string): Promise<Partial<RawBusiness>> {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });

    const getText = (sel: string) =>
      page.$eval(sel, (el: Element) => el.textContent?.trim() ?? null).catch(() => null);
    const getHref = (sel: string) =>
      page.$eval(sel, (el: Element) => (el as HTMLAnchorElement).href).catch(() => null);

    const [email, phone, website, facebook, address] = await Promise.all([
      page
        .$$eval("a[href^='mailto:']", (els: Element[]) =>
          (els[0] as HTMLAnchorElement)?.href?.replace("mailto:", "").trim() ?? null
        )
        .catch(() => null),
      getText(".phone, .tel, [class*='phone'], [itemprop='telephone']"),
      getHref(".website a, a[class*='website'], a[rel='nofollow'][target='_blank']"),
      getHref("a[href*='facebook.com'], a[href*='fb.com']"),
      getText(".address, [class*='address'], [itemprop='address']"),
    ]);

    return { email, phone, website, facebook, address };
  } finally {
    await page.close();
  }
}

/**
 * Generates realistic fallback data that respects the actual input location.
 * Called only when Playwright scraping fails entirely.
 */
function getMockData(
  keyword: string,
  location: string,
  industry: string,
  parsed: ParsedLocation
): RawBusiness[] {
  const prefixes = [
    "Cebu", "Visayas", "Pacific", "Metro", "Prime", "Global", "Allied", "Summit",
    "Horizon", "First", "Pioneer", "Excellence", "Premier", "Southern", "Island",
    "Eastern", "Northern", "Central", "Western", "Royal",
  ];
  const suffixes = [
    "Solutions", "Services", "Corporation", "Enterprises", "Group", "Holdings",
    "Industries", "Systems", "Technologies", "Outsourcing", "Trading", "Ventures",
  ];
  const domains = ["gmail.com", "yahoo.com", "outlook.com"];

  // Build location-aware address templates using the actual input location
  const primaryLoc = parsed.municipality ?? parsed.province ?? location;
  const province = parsed.province ?? location;
  const brgy = parsed.barangay;

  const addressTemplates = [
    // HIGH relevance — exact municipality
    `${brgy ? brgy + ", " : ""}${primaryLoc}, ${province}`,
    `National Highway, ${primaryLoc}, ${province}`,
    `Purok 2, Barangay Center, ${primaryLoc}, ${province}`,
    `Zone 1, ${primaryLoc}, ${province}`,
    `Main Road, ${primaryLoc}, ${province}`,
    // MEDIUM relevance — same province, different area
    `Poblacion, ${province}`,
    `${province} Province`,
    // A few more HIGH
    `Commercial Area, ${primaryLoc}, ${province}`,
    `Industrial Zone, ${primaryLoc}, ${province}`,
  ];

  const base = `${keyword} ${location}`.toLowerCase();
  const seed = base.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  return Array.from({ length: 12 }, (_, i) => {
    const r = (n: number) => (seed + i * 7 + n) % 10;
    const prefix = prefixes[(seed + i * 3) % prefixes.length];
    const suffix = suffixes[(seed + i * 5) % suffixes.length];
    const name = `${prefix} ${suffix}`;
    const slug = name.toLowerCase().replace(/\s+/g, "");

    const hasEmail = r(1) > 3;
    const hasPhone = r(2) > 2;
    const hasWebsite = r(3) > 4;
    const hasFacebook = r(4) > 5;

    return {
      company_name: name,
      email: hasEmail ? `info@${slug}.${domains[r(5) % domains.length]}` : null,
      phone: hasPhone ? `+63 32 ${200 + r(6)}${r(7)} ${1000 + seed + i}` : null,
      website: hasWebsite ? `https://www.${slug}.com.ph` : null,
      facebook: hasFacebook ? `https://facebook.com/${slug}` : null,
      address: addressTemplates[i % addressTemplates.length],
    };
  });
}
