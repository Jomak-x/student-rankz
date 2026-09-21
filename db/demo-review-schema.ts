import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { courses, instructors, universities } from "@/db/schema";

// Drizzle mirror of db/feature-migrations/demo-public-reviews.sql.
//
// This file deliberately lives OUTSIDE the base db/schema.ts: the base
// Drizzle journal is untouched and the final integration PR consolidates the
// feature migration into the generated journal. Column names are pinned
// explicitly so no `casing` configuration can desynchronise this mirror from
// the SQL asset.
//
// Public sample projection only: no identity columns, no private drafts, no
// moderation state. Rows are read-only for the application; the only writer
// is the explicitly opt-in demo ratings seed (db/demo-ratings-seed.ts).

// Published sample review of a university, course or instructor. Every row
// belongs to exactly one university; composite foreign keys force course and
// instructor subjects to belong to the same university.
export const publicSampleReviews = pgTable(
  "public_sample_reviews",
  {
    id: uuid("id").primaryKey(),
    universityId: uuid("university_id").notNull(),
    subjectType: text("subject_type").notNull(),
    courseId: uuid("course_id"),
    instructorId: uuid("instructor_id"),
    authorAlias: text("author_alias").notNull(),
    programmeLabel: text("programme_label"),
    experienceYear: smallint("experience_year"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    pros: text("pros"),
    cons: text("cons"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    provenance: text("provenance").notNull().default("demo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "public_sample_reviews_subject_type_check",
      sql`${t.subjectType} in ('university', 'course', 'instructor')`,
    ),
    check(
      "public_sample_reviews_subject_shape_check",
      sql`(${t.subjectType} = 'university' and ${t.courseId} is null and ${t.instructorId} is null)
        or (${t.subjectType} = 'course' and ${t.courseId} is not null and ${t.instructorId} is null)
        or (${t.subjectType} = 'instructor' and ${t.courseId} is null and ${t.instructorId} is not null)`,
    ),
    check(
      "public_sample_reviews_author_alias_length_check",
      sql`char_length(${t.authorAlias}) between 1 and 80`,
    ),
    check(
      "public_sample_reviews_programme_label_length_check",
      sql`${t.programmeLabel} is null or char_length(${t.programmeLabel}) <= 120`,
    ),
    check(
      "public_sample_reviews_experience_year_check",
      sql`${t.experienceYear} is null or ${t.experienceYear} between 1900 and 2100`,
    ),
    check("public_sample_reviews_title_length_check", sql`char_length(${t.title}) between 1 and 200`),
    check("public_sample_reviews_body_length_check", sql`char_length(${t.body}) between 1 and 4000`),
    check("public_sample_reviews_pros_length_check", sql`${t.pros} is null or char_length(${t.pros}) <= 1000`),
    check("public_sample_reviews_cons_length_check", sql`${t.cons} is null or char_length(${t.cons}) <= 1000`),
    check("public_sample_reviews_provenance_check", sql`${t.provenance} = 'demo'`),
    foreignKey({
      name: "public_sample_reviews_university_fkey",
      columns: [t.universityId],
      foreignColumns: [universities.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "public_sample_reviews_course_fkey",
      columns: [t.courseId, t.universityId],
      foreignColumns: [courses.id, courses.universityId],
    }).onDelete("cascade"),
    foreignKey({
      name: "public_sample_reviews_instructor_fkey",
      columns: [t.instructorId, t.universityId],
      foreignColumns: [instructors.id, instructors.universityId],
    }).onDelete("cascade"),
    index("public_sample_reviews_university_subject_idx").on(
      t.universityId,
      t.subjectType,
      t.publishedAt.desc(),
    ),
    index("public_sample_reviews_course_idx")
      .on(t.courseId, t.publishedAt.desc())
      .where(sql`${t.courseId} is not null`),
    index("public_sample_reviews_instructor_idx")
      .on(t.instructorId, t.publishedAt.desc())
      .where(sql`${t.instructorId} is not null`),
  ],
);

// One row per rated dimension per review. All displayed scores and review
// counts are aggregated from this table — nothing is hardcoded.
export const publicSampleReviewRatings = pgTable(
  "public_sample_review_ratings",
  {
    reviewId: uuid("review_id").notNull(),
    dimension: text("dimension").notNull(),
    value: smallint("value").notNull(),
  },
  (t) => [
    primaryKey({
      name: "public_sample_review_ratings_pkey",
      columns: [t.reviewId, t.dimension],
    }),
    check(
      "public_sample_review_ratings_dimension_check",
      sql`${t.dimension} in (
        'overall', 'teaching', 'support', 'facilities', 'administration', 'value', 'social_life',
        'workload', 'organisation', 'clarity', 'assessment_fairness', 'expertise', 'engagement'
      )`,
    ),
    check("public_sample_review_ratings_value_check", sql`${t.value} between 1 and 5`),
    foreignKey({
      name: "public_sample_review_ratings_review_fkey",
      columns: [t.reviewId],
      foreignColumns: [publicSampleReviews.id],
    }).onDelete("cascade"),
  ],
);
