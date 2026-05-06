export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { scrapeBusinesses } from "@/lib/scraper";
import { createLeads } from "@/lib/supabase";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { keyword, location, industry } = body as {
      keyword: string;
      location: string;
      industry: string;
    };

    if (!keyword || !location) {
      return NextResponse.json(
        { error: "keyword and location are required" },
        { status: 400 }
      );
    }

    const { leads: scraped, errors } = await scrapeBusinesses(keyword, location, industry);

    if (scraped.length === 0) {
      return NextResponse.json({
        success: false,
        count: 0,
        leads: [],
        errors: errors.length ? errors : ["No results found for your search."],
      });
    }

    const saved = await createLeads(scraped);

    return NextResponse.json({
      success: true,
      count: saved.length,
      leads: saved,
      errors,
    });
  } catch (error) {
    console.error("[POST /api/scrape]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Scraping failed: ${message}` },
      { status: 500 }
    );
  }
}
