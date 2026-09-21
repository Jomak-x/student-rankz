// Feature migration runner: applies the ordered SQL assets in
// db/feature-migrations/ AFTER the base Drizzle migrations (npm run
// db:migrate). Explicitly operator-invoked only — never part of build,
// deploy or CI pipelines.
//
// Idempotency and repeatability:
//   A `feature_migrations` tracking table records every successfully applied
//   file. Re-running skips already-recorded files, so running the command
//   twice on the same database is safe and data-preserving.
//
// Concurrency safety:
//   The runner acquires a PostgreSQL session-level advisory lock (key
//   5731) for the duration of the run. Concurrent invocations wait for the
//   lock rather than racing.
//
// Usage:
//   DATABASE_URL=postgres://... npm run db:migrate:feature
//   # or, preferring the unpooled migration connection:
//   DATABASE_DIRECT_URL=postgres://... npm run db:migrate:feature

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const FEATURE_MIGRATIONS_DIR = path.resolve(import.meta.dirname, "feature-migrations");

// Stable advisory lock key for this runner — prevents concurrent migrations
// from the same or different processes racing each other.
const ADVISORY_LOCK_KEY = 5731;

// Tracking table DDL. CREATE TABLE IF NOT EXISTS is itself idempotent.
const TRACKING_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS feature_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
)`;

async function featureMigrationFiles(): Promise<string[]> {
  const entries = await readdir(FEATURE_MIGRATIONS_DIR);
  // Ordered asset: lexicographic filename order is the application order.
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

async function appliedMigrations(client: Client): Promise<Set<string>> {
  const result = await client.query<{ filename: string }>(
    "SELECT filename FROM feature_migrations",
  );
  return new Set(result.rows.map((r) => r.filename));
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Refusing to run feature migrations: set DATABASE_URL (or DATABASE_DIRECT_URL for migration tooling).",
    );
    process.exit(1);
  }

  const files = await featureMigrationFiles();
  if (files.length === 0) {
    console.log("No feature migrations found; nothing to apply.");
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // Acquire session-level advisory lock. The lock is held until the
    // session ends (client.end()), which is in the finally block below.
    await client.query(`SELECT pg_advisory_lock($1)`, [ADVISORY_LOCK_KEY]);

    // Ensure the tracking table exists (idempotent).
    await client.query(TRACKING_TABLE_DDL);

    const applied = await appliedMigrations(client);

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping (already applied): ${file}`);
        continue;
      }

      const sqlText = await readFile(path.join(FEATURE_MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sqlText);
        // Record the migration inside the same transaction so the schema
        // change and the tracking record are committed together.
        await client.query(
          "INSERT INTO feature_migrations (filename) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        console.log(`Applied feature migration: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(
          `Feature migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    console.log("Feature migrations complete.");
  } finally {
    // The advisory lock is released when the session closes.
    await client.end();
  }
}

main().catch((error) => {
  console.error("Feature migration run failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
