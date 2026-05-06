export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getLeadStats } from "@/lib/supabase";

export async function GET() {
  try {
    const stats = await getLeadStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[GET /api/stats]", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
