import assert from "node:assert/strict";
import path from "node:path";
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
        ["programme_course_status", "study_level", "university_type"],
      );

      const applied = await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations",
      );
      assert.equal(applied.rows[0].count, "1");
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
      assert.equal(applied.rows[0].count, "1");
    } finally {
      await client.end();
    }
  } finally {
    await dropEphemeralDatabase(ephemeral.databaseName);
  }
});
