-- Bridge the source feature runner and the ordered Drizzle journal. Both
-- runners hold this transaction-scoped lock through DDL and tracking writes.
-- A tracked source migration is authoritative; untracked collisions fail.
SELECT pg_advisory_xact_lock(5731);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.feature_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- 0001 may already be recorded by the pre-bridge integration journal.
-- Reconcile its feature record without replaying its DDL.
INSERT INTO public.feature_migrations (filename) VALUES ('private-drafts.sql')
ON CONFLICT (filename) DO NOTHING;
--> statement-breakpoint
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.feature_migrations WHERE filename = 'demo-public-reviews.sql') THEN
CREATE TABLE "public_sample_review_ratings" (
	"review_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"value" smallint NOT NULL,
	CONSTRAINT "public_sample_review_ratings_pkey" PRIMARY KEY("review_id","dimension"),
	CONSTRAINT "public_sample_review_ratings_dimension_check" CHECK ("public_sample_review_ratings"."dimension" in (
        'overall', 'teaching', 'support', 'facilities', 'administration', 'value', 'social_life',
        'workload', 'organisation', 'clarity', 'assessment_fairness', 'expertise', 'engagement'
      )),
	CONSTRAINT "public_sample_review_ratings_value_check" CHECK ("public_sample_review_ratings"."value" between 1 and 5)
);

CREATE TABLE "public_sample_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
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
	"provenance" text DEFAULT 'demo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_sample_reviews_subject_type_check" CHECK ("public_sample_reviews"."subject_type" in ('university', 'course', 'instructor')),
	CONSTRAINT "public_sample_reviews_subject_shape_check" CHECK (("public_sample_reviews"."subject_type" = 'university' and "public_sample_reviews"."course_id" is null and "public_sample_reviews"."instructor_id" is null)
        or ("public_sample_reviews"."subject_type" = 'course' and "public_sample_reviews"."course_id" is not null and "public_sample_reviews"."instructor_id" is null)
        or ("public_sample_reviews"."subject_type" = 'instructor' and "public_sample_reviews"."course_id" is null and "public_sample_reviews"."instructor_id" is not null)),
	CONSTRAINT "public_sample_reviews_author_alias_length_check" CHECK (char_length("public_sample_reviews"."author_alias") between 1 and 80),
	CONSTRAINT "public_sample_reviews_programme_label_length_check" CHECK ("public_sample_reviews"."programme_label" is null or char_length("public_sample_reviews"."programme_label") <= 120),
	CONSTRAINT "public_sample_reviews_experience_year_check" CHECK ("public_sample_reviews"."experience_year" is null or "public_sample_reviews"."experience_year" between 1900 and 2100),
	CONSTRAINT "public_sample_reviews_title_length_check" CHECK (char_length("public_sample_reviews"."title") between 1 and 200),
	CONSTRAINT "public_sample_reviews_body_length_check" CHECK (char_length("public_sample_reviews"."body") between 1 and 4000),
	CONSTRAINT "public_sample_reviews_pros_length_check" CHECK ("public_sample_reviews"."pros" is null or char_length("public_sample_reviews"."pros") <= 1000),
	CONSTRAINT "public_sample_reviews_cons_length_check" CHECK ("public_sample_reviews"."cons" is null or char_length("public_sample_reviews"."cons") <= 1000),
	CONSTRAINT "public_sample_reviews_provenance_check" CHECK ("public_sample_reviews"."provenance" = 'demo')
);

ALTER TABLE "public_sample_review_ratings" ADD CONSTRAINT "public_sample_review_ratings_review_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."public_sample_reviews"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public_sample_reviews" ADD CONSTRAINT "public_sample_reviews_university_fkey" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public_sample_reviews" ADD CONSTRAINT "public_sample_reviews_course_fkey" FOREIGN KEY ("course_id","university_id") REFERENCES "public"."courses"("id","university_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public_sample_reviews" ADD CONSTRAINT "public_sample_reviews_instructor_fkey" FOREIGN KEY ("instructor_id","university_id") REFERENCES "public"."instructors"("id","university_id") ON DELETE cascade ON UPDATE no action;

  ELSE
    -- The source SQL used PostgreSQL's implicit DESC NULLS FIRST. Match the
    -- generated snapshot's explicit NULLS LAST (published_at is NOT NULL).
    DROP INDEX public.public_sample_reviews_university_subject_idx;
    DROP INDEX public.public_sample_reviews_course_idx;
    DROP INDEX public.public_sample_reviews_instructor_idx;
  END IF;
CREATE INDEX "public_sample_reviews_university_subject_idx" ON "public_sample_reviews" USING btree ("university_id","subject_type","published_at" DESC NULLS LAST);
CREATE INDEX "public_sample_reviews_course_idx" ON "public_sample_reviews" USING btree ("course_id","published_at" DESC NULLS LAST) WHERE "public_sample_reviews"."course_id" is not null;
CREATE INDEX "public_sample_reviews_instructor_idx" ON "public_sample_reviews" USING btree ("instructor_id","published_at" DESC NULLS LAST) WHERE "public_sample_reviews"."instructor_id" is not null;
  INSERT INTO public.feature_migrations (filename) VALUES ('demo-public-reviews.sql')
  ON CONFLICT (filename) DO NOTHING;
END
$migration$;
