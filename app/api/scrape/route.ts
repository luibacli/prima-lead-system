export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { scrapeBusinesses } from "@/lib/scraper";
import { createLeads } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { keyword, location, industry } = body as {
      keyword: string;
      location: string;
      industry: string;
    };

    if (!keyword?.trim() || !location?.trim()) {
      return NextResponse.json(
        { error: "keyword and location are required" },
        { status: 400 }
      );
    }

    const { leads: scraped, errors, log } = await scrapeBusinesses(
      keyword.trim(),
      location.trim(),
      (industry ?? "").trim()
    );

    if (scraped.length === 0) {
      return NextResponse.json({
        success: false,
        count: 0,
        leads: [],
        errors: errors.length ? errors : ["No results found for your search."],
        log,
      });
    }

    const saved = await createLeads(scraped);

    return NextResponse.json({
      success: true,
      count: saved.length,
      leads: saved,
      errors,
      log,
    });
  } catch (error) {
    console.error("[POST /api/scrape]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Scraping failed: ${message}`,
        count: 0,
        leads: [],
        errors: [`Scraping failed: ${message}`],
        log: null,
      },
      { status: 500 }
    );
  }
}
