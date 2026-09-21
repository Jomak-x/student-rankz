-- Feature migration: public sample review projection (demo ratings).
--
-- Self-contained and ordered: applies cleanly AFTER the base Drizzle
-- migrations in ../drizzle/. The final integration PR consolidates this asset
-- into the generated Drizzle journal; until then operators apply it with
-- `npm run db:migrate:feature` and tests apply it after the base migrations.
--
-- What this adds (and deliberately does not add):
-- - `public_sample_reviews`: published sample reviews of a university, course
--   or instructor. Every row belongs to exactly one university and uses the
--   same composite-foreign-key pattern as the base directory schema, so a
--   review can never reference a course or instructor of another university.
--   Rows carry an explicit `provenance` marker (currently only 'demo'); there
--   is no write path in this repository: no public submission, mutation or
--   moderation endpoint exists.
-- - `public_sample_review_ratings`: one row per rated dimension per review.
--   Displayed scores and review counts are always derived from these rows.
--
-- What is NOT here: identities (no email/account/user columns), private
-- review drafts, moderation state or any user-owned table. Private drafts
-- stay entirely separate from this public sample projection.

CREATE TABLE "public_sample_reviews" (
  "id" uuid PRIMARY KEY,
  "university_id" uuid NOT NULL,
  "subject_type" text NOT NULL,
  "course_id" uuid,
  "instructor_id" uuid,
  "author_alias" text NOT NULL,
  "programme_label" text,
  "experience_year" smallint,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "pros" text,
  "cons" text,
  "published_at" timestamp with time zone NOT NULL,
  "provenance" text NOT NULL DEFAULT 'demo',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "public_sample_reviews_university_fkey" FOREIGN KEY ("university_id")
    REFERENCES "universities"("id") ON DELETE CASCADE,
  CONSTRAINT "public_sample_reviews_course_fkey" FOREIGN KEY ("course_id", "university_id")
    REFERENCES "courses"("id", "university_id") ON DELETE CASCADE,
  CONSTRAINT "public_sample_reviews_instructor_fkey" FOREIGN KEY ("instructor_id", "university_id")
    REFERENCES "instructors"("id", "university_id") ON DELETE CASCADE,
  CONSTRAINT "public_sample_reviews_subject_type_check" CHECK (
    "subject_type" IN ('university', 'course', 'instructor')
  ),
  CONSTRAINT "public_sample_reviews_subject_shape_check" CHECK (
    ("subject_type" = 'university' AND "course_id" IS NULL AND "instructor_id" IS NULL)
    OR ("subject_type" = 'course' AND "course_id" IS NOT NULL AND "instructor_id" IS NULL)
    OR ("subject_type" = 'instructor' AND "course_id" IS NULL AND "instructor_id" IS NOT NULL)
  ),
  CONSTRAINT "public_sample_reviews_author_alias_length_check" CHECK (char_length("author_alias") BETWEEN 1 AND 80),
  CONSTRAINT "public_sample_reviews_programme_label_length_check" CHECK ("programme_label" IS NULL OR char_length("programme_label") <= 120),
  CONSTRAINT "public_sample_reviews_experience_year_check" CHECK ("experience_year" IS NULL OR "experience_year" BETWEEN 1900 AND 2100),
  CONSTRAINT "public_sample_reviews_title_length_check" CHECK (char_length("title") BETWEEN 1 AND 200),
  CONSTRAINT "public_sample_reviews_body_length_check" CHECK (char_length("body") BETWEEN 1 AND 4000),
  CONSTRAINT "public_sample_reviews_pros_length_check" CHECK ("pros" IS NULL OR char_length("pros") <= 1000),
  CONSTRAINT "public_sample_reviews_cons_length_check" CHECK ("cons" IS NULL OR char_length("cons") <= 1000),
  CONSTRAINT "public_sample_reviews_provenance_check" CHECK ("provenance" = 'demo')
);

-- One row per rated dimension per review. Score averages shown in the UI are
-- aggregated from this table, never hardcoded.
CREATE TABLE "public_sample_review_ratings" (
  "review_id" uuid NOT NULL,
  "dimension" text NOT NULL,
  "value" smallint NOT NULL,
  CONSTRAINT "public_sample_review_ratings_pkey" PRIMARY KEY ("review_id", "dimension"),
  CONSTRAINT "public_sample_review_ratings_review_fkey" FOREIGN KEY ("review_id")
    REFERENCES "public_sample_reviews"("id") ON DELETE CASCADE,
  CONSTRAINT "public_sample_review_ratings_dimension_check" CHECK ("dimension" IN (
    'overall',
    'teaching',
    'support',
    'facilities',
    'administration',
    'value',
    'social_life',
    'workload',
    'organisation',
    'clarity',
    'assessment_fairness',
    'expertise',
    'engagement'
  )),
  CONSTRAINT "public_sample_review_ratings_value_check" CHECK ("value" BETWEEN 1 AND 5)
);

CREATE INDEX "public_sample_reviews_university_subject_idx"
  ON "public_sample_reviews" ("university_id", "subject_type", "published_at" DESC);
CREATE INDEX "public_sample_reviews_course_idx"
  ON "public_sample_reviews" ("course_id", "published_at" DESC) WHERE "course_id" IS NOT NULL;
CREATE INDEX "public_sample_reviews_instructor_idx"
  ON "public_sample_reviews" ("instructor_id", "published_at" DESC) WHERE "instructor_id" IS NOT NULL;
