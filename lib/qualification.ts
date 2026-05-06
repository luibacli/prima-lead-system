import type { LeadQualification, LeadInsert } from "@/types/lead";

interface QualificationResult {
  qualification: LeadQualification;
  qualification_reason: string;
}

export function qualifyLead(
  data: Pick<LeadInsert, "email" | "phone" | "website">
): QualificationResult {
  const hasEmail = Boolean(data.email?.trim());
  const hasPhone = Boolean(data.phone?.trim());
  const hasWebsite = Boolean(data.website?.trim());

  const presentFields: string[] = [];
  const missingFields: string[] = [];

  if (hasWebsite) presentFields.push("website");
  else missingFields.push("website");

  if (hasEmail) presentFields.push("email");
  else missingFields.push("email");

  if (hasPhone) presentFields.push("phone");
  else missingFields.push("phone");

  if (hasWebsite && hasEmail && hasPhone) {
    return {
      qualification: "HIGH",
      qualification_reason: "Has website, email, and phone",
    };
  }

  if (missingFields.length === 1) {
    return {
      qualification: "MEDIUM",
      qualification_reason: `Missing ${missingFields[0]}; has ${presentFields.join(" and ")}`,
    };
  }

  const present = presentFields.length > 0 ? `Has ${presentFields.join(" and ")}` : "No contact info found";
  return {
    qualification: "LOW",
    qualification_reason: `Missing ${missingFields.join(", ")}; ${present}`,
  };
}
