import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { courses, instructors, programmes, universities } from "@/db/schema";
import { publicSampleReviews, publicSampleReviewRatings } from "@/db/demo-review-schema";
import type {
  CatalogCountry,
  CatalogPage,
  CatalogProgrammeSummary,
  CatalogUniversity,
  CatalogUniversityDetail,
  CatalogUniversitySort,
  CatalogUniversityType,
  UniversityExperienceScores,
} from "@/lib/catalog-types";

import type { CatalogDatabase, NormalizedPagination } from "./database";
import { toCount, toIsoOrNull, toNumberOrNull } from "./database";
import { escapeLikePattern } from "./params";
import {
  UNIVERSITY_DIMENSIONS,
  hasDimensionRatingSql,
  reviewStatsSelect,
  scoreAliasOrderSql,
} from "./scores";

// University catalog queries: list/search/filter/sort/paginate, detail,
// top-N student-experience ranking and the country facet. All scores derive
// from the public sample projection via LEFT JOIN + conditional averages;
// universities without reviews carry null scores and reviewCount 0.

// Aggregate columns arrive from drivers as string or number (driver
// dependent) — these row types keep both possibilities honest until the
// mappers normalise them into the DTO.
type StatsColumns = {
  reviewCount: number | string;
  latestReviewAt: Date | string | null;
  score_overall: number | string | null;
  score_teaching: number | string | null;
  score_support: number | string | null;
  score_facilities: number | string | null;
  score_administration: number | string | null;
  score_value: number | string | null;
  score_social_life: number | string | null;
};

type UniversityRow = {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  foundedYear: number | null;
  type: CatalogUniversityType;
  websiteUrl: string | null;
  description: string | null;
  studentCount: number | null;
} & StatsColumns;

function toScores(row: StatsColumns): UniversityExperienceScores {
  return {
    overall: toNumberOrNull(row.score_overall),
    teaching: toNumberOrNull(row.score_teaching),
    support: toNumberOrNull(row.score_support),
    facilities: toNumberOrNull(row.score_facilities),
    administration: toNumberOrNull(row.score_administration),
    value: toNumberOrNull(row.score_value),
    socialLife: toNumberOrNull(row.score_social_life),
  };
}

function toUniversityDto(row: UniversityRow): CatalogUniversity {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    country: row.country,
    countryCode: row.countryCode,
    foundedYear: row.foundedYear,
    type: row.type,
    websiteUrl: row.websiteUrl,
    description: row.description,
    studentCount: row.studentCount,
    scores: toScores(row),
    reviewCount: toCount(row.reviewCount),
    latestReviewAt: toIsoOrNull(row.latestReviewAt),
  };
}

// Every university query shares this shape: universities LEFT JOINed to their
// published university-level sample reviews and those reviews' rating rows,
// aggregated to one row per university (count, latest published_at, and one
// conditional avg per dimension). Callers chain `.where(...)`,
// `.groupBy(universities.id)` and the rest — `.where(undefined)` is valid
// Drizzle, so filters apply conditionally.
function universityStatsBase(db: CatalogDatabase) {
  return db
    .select({
      id: universities.id,
      slug: universities.slug,
      name: universities.name,
      city: universities.city,
      country: universities.country,
      countryCode: universities.countryCode,
      foundedYear: universities.foundedYear,
      type: universities.type,
      websiteUrl: universities.websiteUrl,
      description: universities.description,
      studentCount: universities.studentCount,
      ...reviewStatsSelect(UNIVERSITY_DIMENSIONS),
    })
    .from(universities)
    .leftJoin(
      publicSampleReviews,
      and(
        eq(publicSampleReviews.universityId, universities.id),
        eq(publicSampleReviews.subjectType, "university"),
      ),
    )
    .leftJoin(
      publicSampleReviewRatings,
      eq(publicSampleReviewRatings.reviewId, publicSampleReviews.id),
    );
}

// Deterministic ordering for every sort mode; the slug tie-breaker keeps
// pagination stable across identical-score rows.
function universityOrderSql(sort: CatalogUniversitySort) {
  switch (sort) {
    case "overall":
      // Unscored universities sort last via `nulls last`.
      return [
        scoreAliasOrderSql("overall"),
        desc(sql`"review_count"`),
        asc(universities.name),
        asc(universities.slug),
      ];
    case "reviews":
      return [desc(sql`"review_count"`), asc(universities.name), asc(universities.slug)];
    case "name":
      return [asc(universities.name), asc(universities.slug)];
  }
}

export type UniversityListQuery = {
  term?: string;
  countryCode?: string;
  sort: CatalogUniversitySort;
  pagination: NormalizedPagination;
};

export async function queryUniversities(
  db: CatalogDatabase,
  query: UniversityListQuery,
): Promise<CatalogPage<CatalogUniversity>> {
  const condition = and(
    query.term
      ? or(
          ilike(universities.name, likePattern(query.term)),
          ilike(universities.city, likePattern(query.term)),
          ilike(universities.country, likePattern(query.term)),
        )
      : undefined,
    query.countryCode ? eq(universities.countryCode, query.countryCode) : undefined,
  );

  // Cast justification: aggregate columns are typed `number` by Drizzle but
  // arrive as strings on some drivers; the mappers normalise both.
  const rows = (await universityStatsBase(db)
    .where(condition)
    .groupBy(universities.id)
    .orderBy(...universityOrderSql(query.sort))
    .limit(query.pagination.pageSize + 1)
    .offset(query.pagination.offset)) as UniversityRow[];

  const totalRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(universities)
    .where(condition);
  const total = toCount(totalRows[0]?.total);
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pagination.pageSize);
  const hasNextPage = rows.length > query.pagination.pageSize;

  return {
    items: (hasNextPage ? rows.slice(0, query.pagination.pageSize) : rows).map(toUniversityDto),
    page: query.pagination.page,
    pageSize: query.pagination.pageSize,
    total,
    totalPages,
    hasNextPage,
  };
}

function likePattern(term: string): string {
  return `%${escapeLikePattern(term)}%`;
}

export async function queryUniversityDetail(
  db: CatalogDatabase,
  slug: string,
): Promise<CatalogUniversityDetail | null> {
  const rows = (await universityStatsBase(db)
    .where(eq(universities.slug, slug))
    .groupBy(universities.id)
    .limit(1)) as UniversityRow[];

  const row = rows[0];
  if (!row) {
    return null;
  }

  const [programmeRows, courseCountRows, instructorCountRows] = await Promise.all([
    db
      .select({
        id: programmes.id,
        slug: programmes.slug,
        name: programmes.name,
        level: programmes.level,
        description: programmes.description,
      })
      .from(programmes)
      .where(eq(programmes.universityId, row.id))
      .orderBy(asc(programmes.name), asc(programmes.slug)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(courses)
      .where(eq(courses.universityId, row.id)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(instructors)
      .where(eq(instructors.universityId, row.id)),
  ]);

  const programmeSummaries: CatalogProgrammeSummary[] = programmeRows.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    level: p.level,
    description: p.description,
  }));

  return {
    ...toUniversityDto(row),
    programmes: programmeSummaries,
    courseCount: toCount(courseCountRows[0]?.total),
    instructorCount: toCount(instructorCountRows[0]?.total),
  };
}

export type TopUniversitiesQuery = {
  limit: number;
};

// Top-N universities by average overall student-experience score. Only
// universities with at least one `overall` rating rank; ordering is score
// DESC, review count DESC, name ASC, slug ASC — deterministic under ties.
export async function queryTopUniversities(
  db: CatalogDatabase,
  query: TopUniversitiesQuery,
): Promise<CatalogUniversity[]> {
  const rows = (await universityStatsBase(db)
    .groupBy(universities.id)
    .having(hasDimensionRatingSql("overall"))
    .orderBy(...universityOrderSql("overall"))
    .limit(query.limit)) as UniversityRow[];

  return rows.map(toUniversityDto);
}

export async function queryCountries(db: CatalogDatabase): Promise<CatalogCountry[]> {
  const rows = await db
    .select({
      country: universities.country,
      countryCode: universities.countryCode,
      universityCount: sql<number>`count(*)`.as("university_count"),
    })
    .from(universities)
    .groupBy(universities.country, universities.countryCode)
    .orderBy(asc(universities.country), asc(universities.countryCode));

  return rows.map((row) => ({
    country: row.country,
    countryCode: row.countryCode,
    universityCount: toCount(row.universityCount),
  }));
}
