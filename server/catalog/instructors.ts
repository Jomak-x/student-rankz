import { and, asc, eq } from "drizzle-orm";

import {
  courseOfferings,
  courses,
  instructors,
  offeringInstructors,
  universities,
} from "@/db/schema";
import { publicSampleReviews, publicSampleReviewRatings } from "@/db/demo-review-schema";
import type {
  CatalogCourseSummary,
  CatalogInstructor,
  InstructorExperienceScores,
} from "@/lib/catalog-types";

import type { CatalogDatabase } from "./database";
import { toCount, toIsoOrNull, toNumberOrNull } from "./database";
import { INSTRUCTOR_DIMENSIONS, reviewStatsSelect } from "./scores";

// Instructor detail query. Scores aggregate the public sample projection the
// same way as university and course scores; instructors without reviews carry
// null scores and reviewCount 0.

// Aggregate columns arrive from drivers as string or number (driver
// dependent) — normalised by the DTO mapper below.
type InstructorStatsColumns = {
  reviewCount: number | string;
  latestReviewAt: Date | string | null;
  score_overall: number | string | null;
  score_clarity: number | string | null;
  score_support: number | string | null;
  score_expertise: number | string | null;
  score_engagement: number | string | null;
};

type InstructorRow = {
  id: string;
  universityId: string;
  universitySlug: string;
  universityName: string;
  slug: string;
  fullName: string;
  title: string | null;
  department: string | null;
  bio: string | null;
} & InstructorStatsColumns;

function toScores(row: InstructorStatsColumns): InstructorExperienceScores {
  return {
    overall: toNumberOrNull(row.score_overall),
    clarity: toNumberOrNull(row.score_clarity),
    support: toNumberOrNull(row.score_support),
    expertise: toNumberOrNull(row.score_expertise),
    engagement: toNumberOrNull(row.score_engagement),
  };
}

function toInstructorDto(
  row: InstructorRow,
  coursesTaught: CatalogCourseSummary[],
): CatalogInstructor {
  return {
    id: row.id,
    universityId: row.universityId,
    universitySlug: row.universitySlug,
    universityName: row.universityName,
    slug: row.slug,
    fullName: row.fullName,
    title: row.title,
    department: row.department,
    bio: row.bio,
    scores: toScores(row),
    reviewCount: toCount(row.reviewCount),
    latestReviewAt: toIsoOrNull(row.latestReviewAt),
    courses: coursesTaught,
  };
}

export async function queryInstructorDetail(
  db: CatalogDatabase,
  instructorId: string,
): Promise<CatalogInstructor | null> {
  const rows = (await db
    .select({
      id: instructors.id,
      universityId: instructors.universityId,
      universitySlug: universities.slug,
      universityName: universities.name,
      slug: instructors.slug,
      fullName: instructors.fullName,
      title: instructors.title,
      department: instructors.department,
      bio: instructors.bio,
      ...reviewStatsSelect(INSTRUCTOR_DIMENSIONS),
    })
    .from(instructors)
    .innerJoin(universities, eq(universities.id, instructors.universityId))
    .leftJoin(
      publicSampleReviews,
      and(
        eq(publicSampleReviews.instructorId, instructors.id),
        eq(publicSampleReviews.subjectType, "instructor"),
      ),
    )
    .leftJoin(
      publicSampleReviewRatings,
      eq(publicSampleReviewRatings.reviewId, publicSampleReviews.id),
    )
    .where(eq(instructors.id, instructorId))
    .groupBy(instructors.id, universities.id)
    .limit(1)) as InstructorRow[];

  const row = rows[0];
  if (!row) {
    return null;
  }

  // Courses the instructor has taught on any dated offering, distinct and
  // deterministically ordered.
  const courseRows = await db
    .selectDistinct({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      level: courses.level,
    })
    .from(courses)
    .innerJoin(courseOfferings, eq(courseOfferings.courseId, courses.id))
    .innerJoin(offeringInstructors, eq(offeringInstructors.offeringId, courseOfferings.id))
    .where(eq(offeringInstructors.instructorId, row.id))
    .orderBy(asc(courses.code));

  return toInstructorDto(
    row,
    courseRows.map((c) => ({ id: c.id, code: c.code, name: c.name, level: c.level })),
  );
}
