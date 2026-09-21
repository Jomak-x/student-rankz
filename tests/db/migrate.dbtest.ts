import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";

import { Client } from "pg";

import { closeDb, createEphemeralDatabase, dropEphemeralDatabase } from "./helpers.js";

const migrationsFolder = path.resolve(import.meta.dirname, "../../drizzle");

const EXPECTED_TABLES = [
  "course_offerings",
  "courses",
  "instructors",
  "offering_instructors",
  "programme_courses",
  "programmes",
  "review_drafts",
  "universities",
];

test("clean migration: fresh database migrates successfully", async () => {
  const ephemeral = await createEphemeralDatabase(migrationsFolder);
  try {
    const client = new Client({ connectionString: ephemeral.connectionString });
    await client.connect();
    try {
      const tables = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
      );
      assert.deepEqual(
        tables.rows.map((r) => r.table_name),
        EXPECTED_TABLES,
      );

      const enums = await client.query<{ enum_name: string }>(
        `SELECT t.typname AS enum_name FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         GROUP BY t.typname ORDER BY t.typname`,
      );
      assert.deepEqual(
        enums.rows.map((r) => r.enum_name),
        ["draft_target_type", "programme_course_status", "study_level", "university_type"],
      );

      const applied = await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations",
      );
      assert.equal(applied.rows[0].count, "2");
    } finally {
      await client.end();
    }
  } finally {
    await dropEphemeralDatabase(ephemeral.databaseName);
  }
});

test("migration is repeatable: applying again is a no-op", async () => {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { drizzle } = await import("drizzle-orm/node-postgres");

  const ephemeral = await createEphemeralDatabase(migrationsFolder);
  try {
    // Running the migrator a second time must not fail and must not
    // duplicate applied migrations.
    const db = drizzle(ephemeral.connectionString);
    await migrate(db, { migrationsFolder });
    await closeDb(db);

    const client = new Client({ connectionString: ephemeral.connectionString });
    await client.connect();
    try {
      const applied = await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations",
      );
      assert.equal(applied.rows[0].count, "2");
    } finally {
      await client.end();
    }
  } finally {
    await dropEphemeralDatabase(ephemeral.databaseName);
  }
});


test("foundation-only database upgrades to private drafts without changing directory rows", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "sr-base-migration-"));
  await mkdir(path.join(folder, "meta"));
  await copyFile(path.join(migrationsFolder, "0000_old_iron_fist.sql"), path.join(folder, "0000_old_iron_fist.sql"));
  const journal = JSON.parse(await readFile(path.join(migrationsFolder, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.slice(0, 1);
  await writeFile(path.join(folder, "meta/_journal.json"), JSON.stringify(journal));
  const ephemeral = await createEphemeralDatabase(folder);
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const db = drizzle(ephemeral.connectionString);
  try {
    await db.$client.query(`INSERT INTO universities (slug, name, city, country, country_code, type)
      VALUES ('upgrade-fixture', 'Synthetic upgrade institution', 'Test', 'Test', 'XX', 'public')`);
    await migrate(db, { migrationsFolder });
    const count = await db.$client.query("SELECT count(*) FROM universities WHERE slug = 'upgrade-fixture'");
    assert.equal(count.rows[0].count, "1");
    const drafts = await db.$client.query("SELECT count(*) FROM review_drafts");
    assert.equal(drafts.rows[0].count, "0");
    const fks = await db.$client.query("SELECT conname FROM pg_constraint WHERE conrelid = 'review_drafts'::regclass AND contype = 'f' ORDER BY conname");
    assert.deepEqual(fks.rows.map(row => row.conname), ["review_drafts_course_fkey", "review_drafts_instructor_fkey", "review_drafts_university_fkey"]);
  } finally {
    await closeDb(db);
    await dropEphemeralDatabase(ephemeral.databaseName);
    await rm(folder, { recursive: true });
  }
});
