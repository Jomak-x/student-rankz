import { sql } from "drizzle-orm";
import type { SQL, SQLWrapper } from "drizzle-orm";

import { publicSampleReviews, publicSampleReviewRatings } from "@/db/demo-review-schema";

// Score aggregation building blocks.
//
// Every displayed score is `avg(rating.value)` over the published sample
// reviews of one subject, computed in SQL from stored rows. Nothing is
// hardcoded: a subject with no reviews (or a dimension nobody rated) yields
// SQL NULL, which the mappers turn into an honest `null` DTO field.

// DB dimension names are snake_case; DTO keys are camelCase and mapped in the
// subject mappers.
export const UNIVERSITY_DIMENSIONS = [
  "overall",
  "teaching",
  "support",
  "facilities",
  "administration",
  "value",
  "social_life",
] as const;

export const COURSE_DIMENSIONS = [
  "overall",
  "workload",
  "organisation",
  "clarity",
  "assessment_fairness",
] as const;

export const INSTRUCTOR_DIMENSIONS = [
  "overall",
  "clarity",
  "support",
  "expertise",
  "engagement",
] as const;

// Aggregated per-subject statistics over the fan-out join
// reviews -> ratings. `count(distinct …)` keeps the count honest despite the
// one-to-many fan-out. Field aliases (`score_*`, `review_count`,
// `latest_review_at`) are referenced by ORDER BY fragments below.
export function reviewStatsSelect(dimensions: readonly string[]) {
  return {
    reviewCount: sql<number>`count(distinct ${publicSampleReviews.id})`.as("review_count"),
    latestReviewAt: sql<Date | null>`max(${publicSampleReviews.publishedAt})`.as(
      "latest_review_at",
    ),
    ...Object.fromEntries(
      dimensions.map((dimension) => [
        `score_${dimension}`,
        dimensionAverageSql(dimension).as(`score_${dimension}`),
      ]),
    ),
  } satisfies Record<string, SQLWrapper>;
}

// Conditional average for one dimension; NULL when the subject has no rating
// row for it.
export function dimensionAverageSql(dimension: string): SQL<number | null> {
  return sql`avg(case when ${publicSampleReviewRatings.dimension} = ${dimension} then ${publicSampleReviewRatings.value} end)`;
}

// HAVING fragment for "has at least one rating on this dimension" — used by
// the top-N ranking so only subjects with a real score rank.
export function hasDimensionRatingSql(dimension: string): SQL<unknown> {
  return sql`${dimensionAverageSql(dimension)} is not null`;
}

// ORDER BY fragment referencing the aggregated output alias; `nulls last`
// keeps unscored rows out of the way, and callers append stable unique
// tie-breakers so pagination is deterministic.
export function scoreAliasOrderSql(dimension: string): SQL<unknown> {
  return sql.raw(`"score_${dimension}" desc nulls last`);
}
