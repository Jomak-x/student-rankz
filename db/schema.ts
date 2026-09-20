import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Directory schema for the Student Rankz prototype.
//
// Every entity belongs to exactly one university. Relations that span two
// entity types (programme-course, course-offering, offering-instructor) carry
// the owning university id and use composite foreign keys so both sides are
// forced to reference rows from the same university. Cross-university links
// are therefore rejected by the database itself.

export const universityTypeEnum = pgEnum("university_type", [
  "public",
  "private",
  "technical",
]);

export const studyLevelEnum = pgEnum("study_level", [
  "bachelor",
  "master",
  "phd",
]);

// Status of a course within a specific programme (compulsory vs elective).
export const programmeCourseStatusEnum = pgEnum("programme_course_status", [
  "required",
  "elective",
]);

export const universities = pgTable(
  "universities",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: varchar({ length: 80 }).notNull(),
    name: text().notNull(),
    city: text().notNull(),
    country: text().notNull(),
    countryCode: varchar({ length: 2 }).notNull(),
    foundedYear: smallint(),
    type: universityTypeEnum().notNull().default("public"),
    websiteUrl: text(),
    description: text(),
    studentCount: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("universities_slug_unique").on(t.slug),
    check("universities_founded_year_check", sql`${t.foundedYear} between 800 and 2100`),
    check("universities_student_count_check", sql`${t.studentCount} >= 0`),
  ],
);

export const programmes = pgTable(
  "programmes",
  {
    id: uuid().primaryKey().defaultRandom(),
    universityId: uuid()
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    slug: varchar({ length: 120 }).notNull(),
    name: text().notNull(),
    level: studyLevelEnum().notNull(),
    description: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("programmes_university_slug_unique").on(t.universityId, t.slug),
    // Referenced by composite foreign keys from programme_courses.
    unique("programmes_id_university_unique").on(t.id, t.universityId),
    index("programmes_university_idx").on(t.universityId),
  ],
);

export const courses = pgTable(
  "courses",
  {
    id: uuid().primaryKey().defaultRandom(),
    universityId: uuid()
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    code: varchar({ length: 40 }).notNull(),
    name: text().notNull(),
    department: text(),
    credits: numeric({ precision: 5, scale: 2 }).notNull(),
    level: studyLevelEnum().notNull(),
    description: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("courses_university_code_unique").on(t.universityId, t.code),
    // Referenced by composite foreign keys from programme_courses and course_offerings.
    unique("courses_id_university_unique").on(t.id, t.universityId),
    index("courses_university_idx").on(t.universityId),
    check("courses_credits_check", sql`${t.credits} > 0`),
  ],
);

// Links a programme to a course with its status (required/elective) inside
// that programme. The shared university_id column plus composite foreign keys
// reject links between programmes and courses of different universities.
export const programmeCourses = pgTable(
  "programme_courses",
  {
    programmeId: uuid().notNull(),
    courseId: uuid().notNull(),
    universityId: uuid()
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    status: programmeCourseStatusEnum().notNull(),
  },
  (t) => [
    primaryKey({
      name: "programme_courses_pkey",
      columns: [t.programmeId, t.courseId],
    }),
    foreignKey({
      name: "programme_courses_programme_fkey",
      columns: [t.programmeId, t.universityId],
      foreignColumns: [programmes.id, programmes.universityId],
    }).onDelete("cascade"),
    foreignKey({
      name: "programme_courses_course_fkey",
      columns: [t.courseId, t.universityId],
      foreignColumns: [courses.id, courses.universityId],
    }).onDelete("cascade"),
    index("programme_courses_course_idx").on(t.courseId),
  ],
);

// A dated instance of a course being taught (academic year + term, optional
// start/end dates). The composite foreign key forces the offering's
// university to match the course's university.
export const courseOfferings = pgTable(
  "course_offerings",
  {
    id: uuid().primaryKey().defaultRandom(),
    courseId: uuid().notNull(),
    universityId: uuid()
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    academicYear: smallint().notNull(),
    term: varchar({ length: 40 }).notNull(),
    startsOn: date(),
    endsOn: date(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("course_offerings_course_year_term_unique").on(
      t.courseId,
      t.academicYear,
      t.term,
    ),
    // Referenced by composite foreign keys from offering_instructors.
    unique("course_offerings_id_university_unique").on(t.id, t.universityId),
    // Forces the offering's university to match its course's university.
    foreignKey({
      name: "course_offerings_course_fkey",
      columns: [t.courseId, t.universityId],
      foreignColumns: [courses.id, courses.universityId],
    }).onDelete("cascade"),
    index("course_offerings_course_idx").on(t.courseId),
    check("course_offerings_academic_year_check", sql`${t.academicYear} between 1900 and 2100`),
    check(
      "course_offerings_dates_check",
      sql`${t.endsOn} is null or ${t.startsOn} is null or ${t.endsOn} >= ${t.startsOn}`,
    ),
  ],
);

export const instructors = pgTable(
  "instructors",
  {
    id: uuid().primaryKey().defaultRandom(),
    universityId: uuid()
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    slug: varchar({ length: 120 }).notNull(),
    fullName: text().notNull(),
    title: text(),
    department: text(),
    bio: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("instructors_university_slug_unique").on(t.universityId, t.slug),
    // Referenced by composite foreign keys from offering_instructors.
    unique("instructors_id_university_unique").on(t.id, t.universityId),
    index("instructors_university_idx").on(t.universityId),
  ],
);

// Associates instructors with a specific dated offering. Composite foreign
// keys reject associations between offerings and instructors of different
// universities.
export const offeringInstructors = pgTable(
  "offering_instructors",
  {
    offeringId: uuid().notNull(),
    instructorId: uuid().notNull(),
    universityId: uuid()
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    role: varchar({ length: 60 }).notNull().default("lecturer"),
  },
  (t) => [
    unique("offering_instructors_pkey").on(t.offeringId, t.instructorId),
    foreignKey({
      name: "offering_instructors_offering_fkey",
      columns: [t.offeringId, t.universityId],
      foreignColumns: [courseOfferings.id, courseOfferings.universityId],
    }).onDelete("cascade"),
    foreignKey({
      name: "offering_instructors_instructor_fkey",
      columns: [t.instructorId, t.universityId],
      foreignColumns: [instructors.id, instructors.universityId],
    }).onDelete("cascade"),
    index("offering_instructors_instructor_idx").on(t.instructorId),
  ],
);
