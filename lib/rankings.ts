// Deterministic ranking helpers — sample-data only, not real-world rankings.
//
// Order: highest overall student-experience score first. Ties are broken by
// review count (more sample reviews first), then by name (A–Z) so the result
// is fully deterministic and stable regardless of input order.

import type { University } from "./demo-data";

export const RANKINGS_LIMIT = 10;

export type RankedUniversity = {
  university: University;
  rank: number;
};

export function rankUniversities(
  items: University[],
  limit: number = RANKINGS_LIMIT
): RankedUniversity[] {
  return [...items]
    .sort(
      (a, b) =>
        b.scores.overall - a.scores.overall ||
        b.reviewCount - a.reviewCount ||
        a.name.localeCompare(b.name)
    )
    .slice(0, Math.max(0, limit))
    .map((university, index) => ({ university, rank: index + 1 }));
}
