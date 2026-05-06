export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getLeadById, updateLead, deleteLead } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lead = await getLeadById(id);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json(lead);
  } catch (error) {
    console.error("[GET /api/leads/[id]]", error);
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const lead = await updateLead(id, body);
    return NextResponse.json(lead);
  } catch (error) {
    console.error("[PATCH /api/leads/[id]]", error);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteLead(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/leads/[id]]", error);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
