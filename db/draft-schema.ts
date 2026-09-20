import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { courses, instructors, universities } from "./schema";

// Private review drafts (feature-owned schema, applied through the
// db/feature-migrations/private-drafts.sql asset — not part of the base
// directory schema or its migration journal).
//
// A draft belongs to exactly one owner, identified by the private provider
// subject handed to the service by a server-side route. The subject is
// stored only in this table and is never part of any service response.
//
// Drafts target exactly one directory entity: a university, a course or an
// instructor of a specific university. Composite foreign keys onto the
// directory's (id, university_id) unique constraints force the target to
// belong to the draft's university; cross-university or nonexistent targets
// are rejected by the database itself. There is deliberately no foreign key
// or other link into the managed auth provider's own schema.
//
// Drafts are private forever in this PR: there is no publication state, no
// moderation workflow and no score aggregation. A draft's only fate is to be
// read, edited or deleted by its owner.

export const draftTargetTypeEnum = pgEnum("draft_target_type", [
  "university",
  "course",
  "instructor",
]);

export const reviewDrafts = pgTable(
  "review_drafts",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Server-validated provider subject (private owner identity). No FK:
    // auth-managed tables are owned by the auth provider.
    ownerSubject: varchar({ length: 255 }).notNull(),
    // What the draft reviews; determines which target column is set.
    targetType: draftTargetTypeEnum().notNull(),
    // The university the reviewed entity belongs to.
    universityId: uuid()
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    // Set only for course drafts; composite FK forces same university.
    courseId: uuid(),
    // Set only for instructor drafts; composite FK forces same university.
    instructorId: uuid(),
    title: varchar({ length: 140 }),
    body: text().notNull(),
    rating: smallint().notNull(),
    // Client-supplied idempotency key; unique per owner so a retried create
    // can never produce a duplicate draft.
    clientRequestKey: varchar({ length: 100 }).notNull(),
    // Optimistic concurrency token, incremented on every update.
    revision: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("review_drafts_owner_request_key_unique").on(
      t.ownerSubject,
      t.clientRequestKey,
    ),
    foreignKey({
      name: "review_drafts_university_fkey",
      columns: [t.universityId],
      foreignColumns: [universities.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "review_drafts_course_fkey",
      columns: [t.courseId, t.universityId],
      foreignColumns: [courses.id, courses.universityId],
    }).onDelete("cascade"),
    foreignKey({
      name: "review_drafts_instructor_fkey",
      columns: [t.instructorId, t.universityId],
      foreignColumns: [instructors.id, instructors.universityId],
    }).onDelete("cascade"),
    index("review_drafts_owner_updated_idx").on(t.ownerSubject, t.updatedAt),
    index("review_drafts_university_idx").on(t.universityId),
    index("review_drafts_course_idx").on(t.courseId),
    index("review_drafts_instructor_idx").on(t.instructorId),
    check("review_drafts_owner_check", sql`char_length(${t.ownerSubject}) between 1 and 255`),
    check("review_drafts_client_key_check", sql`char_length(${t.clientRequestKey}) between 1 and 100`),
    check("review_drafts_title_check", sql`${t.title} is null or char_length(${t.title}) between 1 and 140`),
    check("review_drafts_body_check", sql`char_length(${t.body}) between 1 and 5000`),
    check("review_drafts_rating_check", sql`${t.rating} between 1 and 5`),
    check("review_drafts_revision_check", sql`${t.revision} >= 1`),
    // Exactly the target column matching target_type may be set.
    check(
      "review_drafts_target_check",
      sql`(${t.targetType} = 'university' and ${t.courseId} is null and ${t.instructorId} is null)
        or (${t.targetType} = 'course' and ${t.courseId} is not null and ${t.instructorId} is null)
        or (${t.targetType} = 'instructor' and ${t.courseId} is null and ${t.instructorId} is not null)`,
    ),
  ],
);

export type ReviewDraftRow = typeof reviewDrafts.$inferSelect;
export type NewReviewDraftRow = typeof reviewDrafts.$inferInsert;
