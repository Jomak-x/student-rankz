import type { CatalogUniversity } from "./catalog-types";

export const RANKINGS_LIMIT = 10;

type RankingUniversity = Pick<
  CatalogUniversity,
  "id" | "name" | "city" | "country" | "scores" | "reviewCount"
>;

export type RankedUniversity<T extends RankingUniversity = RankingUniversity> = {
  university: T;
  rank: number;
};

/**
 * Keeps ranking presentation deterministic for already-loaded catalog rows.
 * The catalog service is responsible for selecting ranking-eligible rows.
 */
export function rankUniversities<T extends RankingUniversity>(
  items: T[],
  limit: number = RANKINGS_LIMIT,
): RankedUniversity<T>[] {
  return [...items]
    .sort(
      (a, b) =>
        (b.scores.overall ?? -Infinity) - (a.scores.overall ?? -Infinity) ||
        b.reviewCount - a.reviewCount ||
        a.name.localeCompare(b.name),
    )
    .slice(0, Math.max(0, limit))
    .map((university, index) => ({ university, rank: index + 1 }));
}
