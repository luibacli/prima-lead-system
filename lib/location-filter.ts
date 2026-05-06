import type { ParsedLocation } from "./query-builder";

export type LocationRelevance = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface LocationScore {
  relevance: LocationRelevance;
  matchDetail: string;
}

/**
 * Scores how well an address string matches the target parsed location.
 *
 * HIGH   — address contains the exact municipality or barangay
 * MEDIUM — address contains the province but a different city/municipality
 * LOW    — address is in the Philippines but no location overlap detected
 * UNKNOWN — no address available to score
 */
export function scoreLocationRelevance(
  address: string | null,
  parsed: ParsedLocation
): LocationScore {
  if (!address || address.trim() === "") {
    return { relevance: "UNKNOWN", matchDetail: "No address to score" };
  }

  const addr = address.toLowerCase();

  // HIGH: municipality match (most common case: "San Fernando" in "National Rd, San Fernando, Cebu")
  if (parsed.municipality) {
    const muni = parsed.municipality.toLowerCase();
    if (addr.includes(muni)) {
      return { relevance: "HIGH", matchDetail: `Municipality match: ${parsed.municipality}` };
    }
  }

  // HIGH: barangay match
  if (parsed.barangay) {
    const brgy = parsed.barangay.toLowerCase();
    // Only match barangay if it's ≥4 chars to avoid false positives
    if (brgy.length >= 4 && addr.includes(brgy)) {
      return { relevance: "HIGH", matchDetail: `Barangay match: ${parsed.barangay}` };
    }
  }

  // MEDIUM: province match (same province, different city)
  if (parsed.province) {
    const prov = parsed.province.toLowerCase();
    if (addr.includes(prov)) {
      return {
        relevance: "MEDIUM",
        matchDetail: `Province only: ${parsed.province} (different city/municipality)`,
      };
    }
  }

  // MEDIUM: any non-trivial part of the location appears in the address
  for (const part of parsed.parts) {
    if (part.length >= 4 && addr.includes(part)) {
      return { relevance: "MEDIUM", matchDetail: `Partial match on "${part}"` };
    }
  }

  return { relevance: "LOW", matchDetail: "No location match found in address" };
}

export interface FilterResult<T> {
  items: T[];
  breakdown: {
    high: number;
    medium: number;
    low: number;
    unknown: number;
    discarded: number;
  };
}

/**
 * Filters a list of items (each with an address field) by location relevance.
 *
 * Strategy:
 * - If any HIGH matches exist → return HIGH + MEDIUM
 * - Else if any MEDIUM matches → return MEDIUM + UNKNOWN (up to 5)
 * - Else → return everything (graceful fallback, still better than nothing)
 */
export function filterByLocation<T extends { address: string | null }>(
  items: T[],
  parsed: ParsedLocation
): FilterResult<T> {
  type Scored = T & { _rel: LocationRelevance };

  const scored: Scored[] = items.map((item) => ({
    ...item,
    _rel: scoreLocationRelevance(item.address, parsed).relevance,
  }));

  const high = scored.filter((i) => i._rel === "HIGH");
  const medium = scored.filter((i) => i._rel === "MEDIUM");
  const low = scored.filter((i) => i._rel === "LOW");
  const unknown = scored.filter((i) => i._rel === "UNKNOWN");

  let kept: Scored[];

  if (high.length > 0) {
    kept = [...high, ...medium];
  } else if (medium.length > 0) {
    kept = [...medium, ...unknown.slice(0, 5)];
  } else {
    // Nothing matched the location — return all (caller gets a warning in errors[])
    kept = scored;
  }

  const discarded = scored.length - kept.length;

  // Strip the internal _rel field before returning
  const items_clean = kept.map(({ _rel: _, ...rest }) => rest as unknown as T);

  return {
    items: items_clean,
    breakdown: {
      high: high.length,
      medium: medium.length,
      low: low.length,
      unknown: unknown.length,
      discarded,
    },
  };
}
