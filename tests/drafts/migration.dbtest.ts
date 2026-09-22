import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "pg";

import {
  applyFeatureMigration,
  createDraftsDatabase,
  dropDraftsDatabase,
} from "./helpers.js";

test("drafts feature migration: table, enum and constraints exist after base migrations", async () => {
  const handle = await createDraftsDatabase();
  const client = new Client({ connectionString: handle.connectionString });
  await client.connect();
  try {
    const columns = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'review_drafts'
       ORDER BY column_name`,
    );
    assert.deepEqual(
      columns.rows.map((r) => r.column_name),
      EXPECTED_COLUMNS,
    );

    const enumValues = await client.query<{ enumlabel: string }>(
      `SELECT e.enumlabel FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'draft_target_type'
       ORDER BY e.enumsortorder`,
    );
    assert.deepEqual(
      enumValues.rows.map((r) => r.enumlabel),
      ["university", "course", "instructor"],
    );

    const constraints = await client.query<{ constraint_name: string }>(
      `SELECT conname AS constraint_name FROM pg_constraint
       WHERE conrelid = 'review_drafts'::regclass
       ORDER BY conname`,
    );
    const names = constraints.rows.map((r) => r.constraint_name);
    for (const expected of [
      "review_drafts_owner_request_key_unique",
      "review_drafts_university_fkey",
      "review_drafts_course_fkey",
      "review_drafts_instructor_fkey",
      "review_drafts_target_check",
      "review_drafts_rating_check",
      "review_drafts_body_check",
      "review_drafts_title_check",
      "review_drafts_owner_check",
      "review_drafts_client_key_check",
      "review_drafts_revision_check",
      "review_drafts_pkey",
    ]) {
      assert.ok(names.includes(expected), `missing constraint ${expected}`);
    }

    // Foreign keys point only at directory tables (universities/courses/
    // instructors) — never at a managed auth provider schema.
    const fkTargets = await client.query<{ target: string }>(
      `SELECT conrelid::regclass::text || ' -> ' || confrelid::regclass::text AS target
       FROM pg_constraint
       WHERE conrelid = 'review_drafts'::regclass AND contype = 'f'
       ORDER BY conname`,
    );
    assert.deepEqual(
      fkTargets.rows.map((r) => r.target),
      [
        "review_drafts -> courses",
        "review_drafts -> instructors",
        "review_drafts -> universities",
      ],
    );
  } finally {
    await client.end();
    await dropDraftsDatabase(handle);
  }
});

test("drafts feature migration: re-applying the asset is a no-op", async () => {
  const handle = await createDraftsDatabase();
  try {
    // Applying the very same asset again must not fail and must not
    // duplicate anything (guards idempotent operator re-runs).
    await applyFeatureMigration(handle.connectionString);

    const client = new Client({ connectionString: handle.connectionString });
    await client.connect();
    try {
      const tables = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'review_drafts'`,
      );
      assert.equal(tables.rows[0].count, "1");

      const enums = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM pg_type t
         WHERE t.typname = 'draft_target_type'`,
      );
      assert.equal(enums.rows[0].count, "1");
    } finally {
      await client.end();
    }
  } finally {
    await dropDraftsDatabase(handle);
  }
});

const EXPECTED_COLUMNS = [
  "body",
  "client_request_key",
  "course_id",
  "created_at",
  "id",
  "instructor_id",
  "owner_subject",
  "rating",
  "revision",
  "target_type",
  "title",
  "university_id",
  "updated_at",
];
