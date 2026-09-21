-- Private review drafts — feature-owned SQL migration asset.
--
-- This PR deliberately does not touch the base Drizzle migration journal
-- (drizzle/) so parallel feature branches never compete over generated
-- metadata. Apply this file AFTER the base directory migrations
-- (drizzle/0000_*.sql), e.g.:
--
--   psql "$DATABASE_URL" -f db/feature-migrations/private-drafts.sql
--
-- The final integration PR consolidates this asset into the Drizzle journal
-- once. Statements are guarded so re-applying is a no-op.

DO $$
BEGIN
  CREATE TYPE "draft_target_type" AS ENUM ('university', 'course', 'instructor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "review_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Private owner identity: server-validated provider subject. No FK into
  -- the managed auth provider's schema (auth owns its own tables).
  "owner_subject" varchar(255) NOT NULL,
  "target_type" "draft_target_type" NOT NULL,
  "university_id" uuid NOT NULL,
  "course_id" uuid,
  "instructor_id" uuid,
  "title" varchar(140),
  "body" text NOT NULL,
  "rating" smallint NOT NULL,
  "client_request_key" varchar(100) NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "review_drafts_owner_request_key_unique"
    UNIQUE ("owner_subject", "client_request_key"),
  CONSTRAINT "review_drafts_university_fkey"
    FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE,
  -- Composite foreign keys force course/instructor drafts to target rows of
  -- the draft's own university (MATCH SIMPLE: null columns skip the check,
  -- which the target_type check constraint makes exact).
  CONSTRAINT "review_drafts_course_fkey"
    FOREIGN KEY ("course_id", "university_id")
    REFERENCES "courses"("id", "university_id") ON DELETE CASCADE,
  CONSTRAINT "review_drafts_instructor_fkey"
    FOREIGN KEY ("instructor_id", "university_id")
    REFERENCES "instructors"("id", "university_id") ON DELETE CASCADE,
  CONSTRAINT "review_drafts_owner_check"
    CHECK (char_length("owner_subject") BETWEEN 1 AND 255),
  CONSTRAINT "review_drafts_client_key_check"
    CHECK (char_length("client_request_key") BETWEEN 1 AND 100),
  CONSTRAINT "review_drafts_title_check"
    CHECK ("title" IS NULL OR char_length("title") BETWEEN 1 AND 140),
  CONSTRAINT "review_drafts_body_check"
    CHECK (char_length("body") BETWEEN 1 AND 5000),
  CONSTRAINT "review_drafts_rating_check"
    CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "review_drafts_revision_check"
    CHECK ("revision" >= 1),
  CONSTRAINT "review_drafts_target_check" CHECK (
    ("target_type" = 'university' AND "course_id" IS NULL AND "instructor_id" IS NULL)
    OR ("target_type" = 'course' AND "course_id" IS NOT NULL AND "instructor_id" IS NULL)
    OR ("target_type" = 'instructor' AND "course_id" IS NULL AND "instructor_id" IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS "review_drafts_owner_updated_idx"
  ON "review_drafts" ("owner_subject", "updated_at");
CREATE INDEX IF NOT EXISTS "review_drafts_university_idx"
  ON "review_drafts" ("university_id");
CREATE INDEX IF NOT EXISTS "review_drafts_course_idx"
  ON "review_drafts" ("course_id");
CREATE INDEX IF NOT EXISTS "review_drafts_instructor_idx"
  ON "review_drafts" ("instructor_id");
