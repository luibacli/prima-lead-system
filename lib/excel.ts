import ExcelJS from "exceljs";
import type { Lead } from "@/types/lead";

export async function generateLeadsExcel(leads: Lead[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PrimaWell Lead Intelligence System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Leads", {
    pageSetup: { paperSize: 9, orientation: "landscape" },
  });

  sheet.columns = [
    { header: "Company Name", key: "company_name", width: 35 },
    { header: "Industry", key: "industry", width: 20 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 20 },
    { header: "Website", key: "website", width: 30 },
    { header: "Facebook", key: "facebook", width: 30 },
    { header: "Address", key: "address", width: 40 },
    { header: "Qualification", key: "qualification", width: 15 },
    { header: "Qualification Reason", key: "qualification_reason", width: 40 },
    { header: "Status", key: "status", width: 20 },
    { header: "Notes", key: "notes", width: 40 },
    { header: "Date Added", key: "created_at", width: 15 },
  ];

  // Header row styling
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF1E40AF" } },
      bottom: { style: "thin", color: { argb: "FF1E40AF" } },
      left: { style: "thin", color: { argb: "FF1E40AF" } },
      right: { style: "thin", color: { argb: "FF1E40AF" } },
    };
  });
  headerRow.height = 30;

  leads.forEach((lead, index) => {
    const row = sheet.addRow({
      company_name: lead.company_name,
      industry: lead.industry ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      website: lead.website ?? "",
      facebook: lead.facebook ?? "",
      address: lead.address ?? "",
      qualification: lead.qualification,
      qualification_reason: lead.qualification_reason,
      status: lead.status,
      notes: lead.notes ?? "",
      created_at: new Date(lead.created_at).toLocaleDateString("en-PH"),
    });

    const isEven = index % 2 === 0;
    const bgColor = isEven ? "FFFFFFFF" : "FFF8FAFC";

    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: bgColor },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });

    // Qualification cell color
    const qualCell = row.getCell("qualification");
    const qualColors: Record<string, string> = {
      HIGH: "FF166534",
      MEDIUM: "FF92400E",
      LOW: "FF991B1B",
    };
    const qualBg: Record<string, string> = {
      HIGH: "FFDCFCE7",
      MEDIUM: "FFFEF3C7",
      LOW: "FFFEE2E2",
    };
    qualCell.font = { color: { argb: qualColors[lead.qualification] ?? "FF000000" }, bold: true };
    qualCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: qualBg[lead.qualification] ?? "FFFFFFFF" },
    };
    qualCell.alignment = { horizontal: "center", vertical: "middle" };

    row.height = 22;
  });

  // Add summary info at the bottom
  sheet.addRow([]);
  const summaryRow = sheet.addRow([
    `Total Leads: ${leads.length}`,
    "",
    `High: ${leads.filter((l) => l.qualification === "HIGH").length}`,
    `Medium: ${leads.filter((l) => l.qualification === "MEDIUM").length}`,
    `Low: ${leads.filter((l) => l.qualification === "LOW").length}`,
  ]);
  summaryRow.font = { bold: true, color: { argb: "FF64748B" } };

  // Freeze header row
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
