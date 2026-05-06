export interface ParsedLocation {
  raw: string;
  barangay: string | null;
  municipality: string | null;
  province: string | null;
  /** Lowercase comma-separated parts e.g. ["sangat", "san fernando", "cebu"] */
  parts: string[];
  /** Most specific addressable component (municipality or barangay) */
  primaryTarget: string;
}

export interface BuildQueryOptions {
  keyword: string;
  industry: string;
  location: string;
}

/**
 * Parses a Philippine address location string into its components.
 *
 * Examples:
 *   "Sangat, San Fernando, Cebu"    → barangay=Sangat, municipality=San Fernando, province=Cebu
 *   "San Fernando, Cebu"            → municipality=San Fernando, province=Cebu
 *   "Cebu City"                     → municipality=Cebu City
 */
export function parseLocation(location: string): ParsedLocation {
  const raw = location.trim();
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  let barangay: string | null = null;
  let municipality: string | null = null;
  let province: string | null = null;

  if (parts.length >= 3) {
    barangay = parts[0];
    municipality = parts[1];
    province = parts[2];
  } else if (parts.length === 2) {
    municipality = parts[0];
    province = parts[1];
  } else {
    municipality = parts[0] ?? raw;
  }

  const primaryTarget = municipality ?? barangay ?? raw;

  return {
    raw,
    barangay,
    municipality,
    province,
    parts: parts.map((p) => p.toLowerCase()),
    primaryTarget,
  };
}

/**
 * Builds a precise, deduplicated search query string.
 *
 * Example:
 *   keyword="Cement", industry="Construction", location="Sangat, San Fernando, Cebu"
 *   → "Cement Construction companies in Sangat, San Fernando, Cebu"
 */
export function buildSearchQuery(opts: BuildQueryOptions): string {
  const kw = opts.keyword.trim();
  const loc = opts.location.trim();

  // Normalize industry label: "BPO / Call Center" → "BPO", "General Business" → ""
  let ind = opts.industry.trim();
  if (ind === "General Business" || ind === "") {
    ind = "";
  } else if (ind.includes(" / ")) {
    ind = ind.split(" / ")[0].trim();
  } else if (ind.includes(" - ")) {
    ind = ind.split(" - ")[0].trim();
  }

  const parts: string[] = [];

  if (kw) parts.push(kw);

  // Add industry only when it contributes new information
  if (ind) {
    const kwLower = kw.toLowerCase();
    const indFirstWord = ind.toLowerCase().split(" ")[0];
    const alreadyPresent =
      kwLower.includes(ind.toLowerCase()) || kwLower.includes(indFirstWord);
    if (!alreadyPresent) parts.push(ind);
  }

  // Append "companies" unless the keyword already implies a collection
  const collectionWords = ["companies", "company", "businesses", "firms", "industries"];
  const basePhrase = parts.join(" ").toLowerCase();
  const hasCollection = collectionWords.some((w) => basePhrase.includes(w));
  if (!hasCollection && parts.length > 0) parts.push("companies");

  // Always append "in {exact location}"
  if (loc) parts.push(`in ${loc}`);

  return parts
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
