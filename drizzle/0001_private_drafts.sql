CREATE TYPE "public"."draft_target_type" AS ENUM('university', 'course', 'instructor');--> statement-breakpoint
CREATE TABLE "review_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_subject" varchar(255) NOT NULL,
	"target_type" "draft_target_type" NOT NULL,
	"university_id" uuid NOT NULL,
	"course_id" uuid,
	"instructor_id" uuid,
	"title" varchar(140),
	"body" text NOT NULL,
	"rating" smallint NOT NULL,
	"client_request_key" varchar(100) NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_drafts_owner_request_key_unique" UNIQUE("owner_subject","client_request_key"),
	CONSTRAINT "review_drafts_owner_check" CHECK (char_length("review_drafts"."owner_subject") between 1 and 255),
	CONSTRAINT "review_drafts_client_key_check" CHECK (char_length("review_drafts"."client_request_key") between 1 and 100),
	CONSTRAINT "review_drafts_title_check" CHECK ("review_drafts"."title" is null or char_length("review_drafts"."title") between 1 and 140),
	CONSTRAINT "review_drafts_body_check" CHECK (char_length("review_drafts"."body") between 1 and 5000),
	CONSTRAINT "review_drafts_rating_check" CHECK ("review_drafts"."rating" between 1 and 5),
	CONSTRAINT "review_drafts_revision_check" CHECK ("review_drafts"."revision" >= 1),
	CONSTRAINT "review_drafts_target_check" CHECK (("review_drafts"."target_type" = 'university' and "review_drafts"."course_id" is null and "review_drafts"."instructor_id" is null)
        or ("review_drafts"."target_type" = 'course' and "review_drafts"."course_id" is not null and "review_drafts"."instructor_id" is null)
        or ("review_drafts"."target_type" = 'instructor' and "review_drafts"."course_id" is null and "review_drafts"."instructor_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "review_drafts" ADD CONSTRAINT "review_drafts_university_fkey" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_drafts" ADD CONSTRAINT "review_drafts_course_fkey" FOREIGN KEY ("course_id","university_id") REFERENCES "public"."courses"("id","university_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_drafts" ADD CONSTRAINT "review_drafts_instructor_fkey" FOREIGN KEY ("instructor_id","university_id") REFERENCES "public"."instructors"("id","university_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_drafts_owner_updated_idx" ON "review_drafts" USING btree ("owner_subject","updated_at");--> statement-breakpoint
CREATE INDEX "review_drafts_university_idx" ON "review_drafts" USING btree ("university_id");--> statement-breakpoint
CREATE INDEX "review_drafts_course_idx" ON "review_drafts" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "review_drafts_instructor_idx" ON "review_drafts" USING btree ("instructor_id");