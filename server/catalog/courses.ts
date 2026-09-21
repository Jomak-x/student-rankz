import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { courseOfferings, courses, offeringInstructors, instructors, universities } from "@/db/schema";
import { publicSampleReviews, publicSampleReviewRatings } from "@/db/demo-review-schema";
import type {
  CatalogCourse,
  CatalogCourseDetail,
  CatalogCourseSort,
  CatalogInstructorSummary,
  CatalogOffering,
  CatalogPage,
  CourseExperienceScores,
} from "@/lib/catalog-types";

import type { CatalogDatabase, NormalizedPagination } from "./database";
import { toCount, toIsoOrNull, toNumberOrNull } from "./database";
import { escapeLikePattern } from "./params";
import { COURSE_DIMENSIONS, reviewStatsSelect, scoreAliasOrderSql } from "./scores";

// Course catalog queries. Scores aggregate the public sample projection the
// same way as university scores; courses without reviews carry null scores.

type CourseStatsColumns = {
  reviewCount: number | string;
  latestReviewAt: Date | string | null;
  score_overall: number | string | null;
  score_workload: number | string | null;
  score_organisation: number | string | null;
  score_clarity: number | string | null;
  score_assessment_fairness: number | string | null;
};

type CourseRow = {
  id: string;
  universityId: string;
  universitySlug: string;
  universityName: string;
  code: string;
  name: string;
  department: string | null;
  credits: string;
  level: "bachelor" | "master" | "phd";
  description: string | null;
} & CourseStatsColumns;

function toScores(row: CourseStatsColumns): CourseExperienceScores {
  return {
    overall: toNumberOrNull(row.score_overall),
    workload: toNumberOrNull(row.score_workload),
    organisation: toNumberOrNull(row.score_organisation),
    clarity: toNumberOrNull(row.score_clarity),
    assessmentFairness: toNumberOrNull(row.score_assessment_fairness),
  };
}

function toCourseDto(row: CourseRow): CatalogCourse {
  return {
    id: row.id,
    universityId: row.universityId,
    universitySlug: row.universitySlug,
    universityName: row.universityName,
    code: row.code,
    name: row.name,
    department: row.department,
    credits: Number(row.credits),
    level: row.level,
    description: row.description,
    scores: toScores(row),
    reviewCount: toCount(row.reviewCount),
    latestReviewAt: toIsoOrNull(row.latestReviewAt),
  };
}

function courseStatsBase(db: CatalogDatabase) {
  return db
    .select({
      id: courses.id,
      universityId: courses.universityId,
      universitySlug: universities.slug,
      universityName: universities.name,
      code: courses.code,
      name: courses.name,
      department: courses.department,
      credits: courses.credits,
      level: courses.level,
      description: courses.description,
      ...reviewStatsSelect(COURSE_DIMENSIONS),
    })
    .from(courses)
    .innerJoin(universities, eq(universities.id, courses.universityId))
    .leftJoin(
      publicSampleReviews,
      and(
        eq(publicSampleReviews.courseId, courses.id),
        eq(publicSampleReviews.subjectType, "course"),
      ),
    )
    .leftJoin(
      publicSampleReviewRatings,
      eq(publicSampleReviewRatings.reviewId, publicSampleReviews.id),
    );
}

// Deterministic ordering; the course id tie-breaker keeps pages stable.
function courseOrderSql(sort: CatalogCourseSort) {
  switch (sort) {
    case "name":
      return [asc(courses.name), asc(courses.code), asc(courses.id)];
    case "overall":
      return [
        scoreAliasOrderSql("overall"),
        desc(sql`"review_count"`),
        asc(courses.code),
        asc(courses.id),
      ];
    case "code":
      return [asc(courses.code), asc(courses.id)];
  }
}

export type CourseListQuery = {
  term?: string;
  level?: "bachelor" | "master" | "phd";
  universityId?: string;
  sort: CatalogCourseSort;
  pagination: NormalizedPagination;
};

export async function queryCourses(
  db: CatalogDatabase,
  query: CourseListQuery,
): Promise<CatalogPage<CatalogCourse>> {
  const condition = and(
    query.term
      ? or(
          ilike(courses.name, likePattern(query.term)),
          ilike(courses.code, likePattern(query.term)),
          ilike(courses.department, likePattern(query.term)),
        )
      : undefined,
    query.level ? eq(courses.level, query.level) : undefined,
    query.universityId ? eq(courses.universityId, query.universityId) : undefined,
  );

  // Cast justification: aggregate columns are typed `number` by Drizzle but
  // arrive as strings on some drivers; the mappers normalise both.
  const rows = (await courseStatsBase(db)
    .where(condition)
    .groupBy(courses.id, universities.id)
    .orderBy(...courseOrderSql(query.sort))
    .limit(query.pagination.pageSize + 1)
    .offset(query.pagination.offset)) as CourseRow[];

  const totalRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(courses)
    .where(condition);
  const total = toCount(totalRows[0]?.total);
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pagination.pageSize);
  const hasNextPage = rows.length > query.pagination.pageSize;

  return {
    items: (hasNextPage ? rows.slice(0, query.pagination.pageSize) : rows).map(toCourseDto),
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

export async function queryCourseDetail(
  db: CatalogDatabase,
  courseId: string,
): Promise<CatalogCourseDetail | null> {
  const rows = (await courseStatsBase(db)
    .where(eq(courses.id, courseId))
    .groupBy(courses.id, universities.id)
    .limit(1)) as CourseRow[];

  const row = rows[0];
  if (!row) {
    return null;
  }

  const [offeringRows, instructorRows] = await Promise.all([
    db
      .select({
        id: courseOfferings.id,
        academicYear: courseOfferings.academicYear,
        term: courseOfferings.term,
        startsOn: courseOfferings.startsOn,
        endsOn: courseOfferings.endsOn,
      })
      .from(courseOfferings)
      .where(eq(courseOfferings.courseId, row.id))
      .orderBy(
        desc(courseOfferings.academicYear),
        asc(courseOfferings.term),
        asc(courseOfferings.startsOn),
        asc(courseOfferings.id),
      ),
    db
      .selectDistinct({
        id: instructors.id,
        slug: instructors.slug,
        fullName: instructors.fullName,
        title: instructors.title,
      })
      .from(instructors)
      .innerJoin(offeringInstructors, eq(offeringInstructors.instructorId, instructors.id))
      .innerJoin(courseOfferings, eq(courseOfferings.id, offeringInstructors.offeringId))
      .where(eq(courseOfferings.courseId, row.id))
      .orderBy(asc(instructors.fullName), asc(instructors.id)),
  ]);

  const offerings: CatalogOffering[] = offeringRows.map((o) => ({
    id: o.id,
    academicYear: o.academicYear,
    term: o.term,
    startsOn: o.startsOn,
    endsOn: o.endsOn,
  }));

  const courseInstructors: CatalogInstructorSummary[] = instructorRows.map((i) => ({
    id: i.id,
    slug: i.slug,
    fullName: i.fullName,
    title: i.title,
  }));

  return {
    ...toCourseDto(row),
    offerings,
    instructors: courseInstructors,
  };
}
