export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAllLeadsForExport } from "@/lib/supabase";
import { generateLeadsExcel } from "@/lib/excel";

export async function GET() {
  try {
    const leads = await getAllLeadsForExport();

    if (leads.length === 0) {
      return NextResponse.json({ error: "No leads to export" }, { status: 404 });
    }

    const buffer = await generateLeadsExcel(leads);
    const date = new Date().toISOString().split("T")[0];
    const filename = `primawell-leads-${date}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[GET /api/export]", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
