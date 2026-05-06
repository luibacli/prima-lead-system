export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getLeads, createLead } from "@/lib/supabase";
import type { LeadFilters, LeadStatus, LeadQualification } from "@/types/lead";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const filters: LeadFilters = {
      search: searchParams.get("search") ?? undefined,
      status: (searchParams.get("status") as LeadStatus | "all") ?? "all",
      qualification: (searchParams.get("qualification") as LeadQualification | "all") ?? "all",
      industry: searchParams.get("industry") ?? undefined,
    };

    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);

    const result = await getLeads(filters, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/leads]", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lead = await createLead(body);
    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("[POST /api/leads]", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
