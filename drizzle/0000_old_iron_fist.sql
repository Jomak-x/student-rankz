CREATE TYPE "public"."programme_course_status" AS ENUM('required', 'elective');--> statement-breakpoint
CREATE TYPE "public"."study_level" AS ENUM('bachelor', 'master', 'phd');--> statement-breakpoint
CREATE TYPE "public"."university_type" AS ENUM('public', 'private', 'technical');--> statement-breakpoint
CREATE TABLE "course_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"university_id" uuid NOT NULL,
	"academic_year" smallint NOT NULL,
	"term" varchar(40) NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_offerings_course_year_term_unique" UNIQUE("course_id","academic_year","term"),
	CONSTRAINT "course_offerings_id_university_unique" UNIQUE("id","university_id"),
	CONSTRAINT "course_offerings_academic_year_check" CHECK ("course_offerings"."academic_year" between 1900 and 2100),
	CONSTRAINT "course_offerings_dates_check" CHECK ("course_offerings"."ends_on" is null or "course_offerings"."starts_on" is null or "course_offerings"."ends_on" >= "course_offerings"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" text NOT NULL,
	"department" text,
	"credits" numeric(5, 2) NOT NULL,
	"level" "study_level" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_university_code_unique" UNIQUE("university_id","code"),
	CONSTRAINT "courses_id_university_unique" UNIQUE("id","university_id"),
	CONSTRAINT "courses_credits_check" CHECK ("courses"."credits" > 0)
);
--> statement-breakpoint
CREATE TABLE "instructors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"full_name" text NOT NULL,
	"title" text,
	"department" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instructors_university_slug_unique" UNIQUE("university_id","slug"),
	CONSTRAINT "instructors_id_university_unique" UNIQUE("id","university_id")
);
--> statement-breakpoint
CREATE TABLE "offering_instructors" (
	"offering_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"university_id" uuid NOT NULL,
	"role" varchar(60) DEFAULT 'lecturer' NOT NULL,
	CONSTRAINT "offering_instructors_pkey" UNIQUE("offering_id","instructor_id")
);
--> statement-breakpoint
CREATE TABLE "programme_courses" (
	"programme_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"university_id" uuid NOT NULL,
	"status" "programme_course_status" NOT NULL,
	CONSTRAINT "programme_courses_pkey" PRIMARY KEY("programme_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "programmes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" text NOT NULL,
	"level" "study_level" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programmes_university_slug_unique" UNIQUE("university_id","slug"),
	CONSTRAINT "programmes_id_university_unique" UNIQUE("id","university_id")
);
--> statement-breakpoint
CREATE TABLE "universities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"founded_year" smallint,
	"type" "university_type" DEFAULT 'public' NOT NULL,
	"website_url" text,
	"description" text,
	"student_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "universities_slug_unique" UNIQUE("slug"),
	CONSTRAINT "universities_founded_year_check" CHECK ("universities"."founded_year" between 800 and 2100),
	CONSTRAINT "universities_student_count_check" CHECK ("universities"."student_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_course_fkey" FOREIGN KEY ("course_id","university_id") REFERENCES "public"."courses"("id","university_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructors" ADD CONSTRAINT "instructors_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_instructors" ADD CONSTRAINT "offering_instructors_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_instructors" ADD CONSTRAINT "offering_instructors_offering_fkey" FOREIGN KEY ("offering_id","university_id") REFERENCES "public"."course_offerings"("id","university_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_instructors" ADD CONSTRAINT "offering_instructors_instructor_fkey" FOREIGN KEY ("instructor_id","university_id") REFERENCES "public"."instructors"("id","university_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_courses" ADD CONSTRAINT "programme_courses_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_courses" ADD CONSTRAINT "programme_courses_programme_fkey" FOREIGN KEY ("programme_id","university_id") REFERENCES "public"."programmes"("id","university_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_courses" ADD CONSTRAINT "programme_courses_course_fkey" FOREIGN KEY ("course_id","university_id") REFERENCES "public"."courses"("id","university_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_offerings_course_idx" ON "course_offerings" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "courses_university_idx" ON "courses" USING btree ("university_id");--> statement-breakpoint
CREATE INDEX "instructors_university_idx" ON "instructors" USING btree ("university_id");--> statement-breakpoint
CREATE INDEX "offering_instructors_instructor_idx" ON "offering_instructors" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "programme_courses_course_idx" ON "programme_courses" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "programmes_university_idx" ON "programmes" USING btree ("university_id");