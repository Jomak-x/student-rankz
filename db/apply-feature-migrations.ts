// Feature migration runner: applies the ordered SQL assets in
// db/feature-migrations/ AFTER the base Drizzle migrations (npm run
// db:migrate). Explicitly operator-invoked only — never part of build,
// deploy or CI pipelines.
//
// Idempotency, atomicity and concurrency safety:
//   All work runs inside ONE transaction:
//     1. pg_advisory_xact_lock — transaction-scoped; auto-released on
//        COMMIT or ROLLBACK, so a crash or pooler disconnect can never leave
//        a stale session-level lock.
//     2. CREATE TABLE IF NOT EXISTS feature_migrations — tracking table.
//     3. Read already-applied filenames; skip them.
//     4. For each new file: execute its DDL then INSERT the filename into
//        the tracking table — schema change and record are atomic.
//     5. COMMIT.
//   If anything fails the whole transaction rolls back and no partial state
//   is left. Concurrent invocations queue on the advisory lock and then
//   discover their files are already tracked.
//
// Connection note:
//   Prefers DATABASE_DIRECT_URL (a direct Postgres connection bypassing
//   any connection pooler) because session/transaction advisory locks and
//   multi-statement DDL require a stable, dedicated connection. Falls back
//   to DATABASE_URL when DATABASE_DIRECT_URL is absent or blank.
//
// Usage:
//   DATABASE_URL=postgres://... npm run db:migrate:feature
//   # or, for a direct (non-pooled) connection:
//   DATABASE_DIRECT_URL=postgres://... npm run db:migrate:feature

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const FEATURE_MIGRATIONS_DIR = path.resolve(import.meta.dirname, "feature-migrations");

// Stable advisory lock key for this runner.
const ADVISORY_LOCK_KEY = 5731;

// Tracking table DDL — included inside the transaction so it is also
// covered by the advisory lock and rolled back on failure.
const TRACKING_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS feature_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
)`;

function resolveConnectionUrl(): string | undefined {
  const direct = process.env.DATABASE_DIRECT_URL?.trim();
  if (direct) return direct;
  const pooled = process.env.DATABASE_URL?.trim();
  if (pooled) return pooled;
  return undefined;
}

async function featureMigrationFiles(): Promise<string[]> {
  const entries = await readdir(FEATURE_MIGRATIONS_DIR);
  // Lexicographic filename order is the application order.
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

async function main(): Promise<void> {
  const url = resolveConnectionUrl();
  if (!url) {
    console.error(
      "Refusing to run feature migrations: set DATABASE_DIRECT_URL (preferred) or DATABASE_URL.",
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
    // Everything runs inside one transaction so the advisory lock is
    // transaction-scoped and is always released on COMMIT or ROLLBACK.
    await client.query("BEGIN");
    try {
      // Acquire transaction-scoped advisory lock. Concurrent callers wait
      // here until the first completes.
      await client.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK_KEY]);

      // Ensure the tracking table exists.
      await client.query(TRACKING_TABLE_DDL);

      const result = await client.query<{ filename: string }>(
        "SELECT filename FROM feature_migrations",
      );
      const applied = new Set(result.rows.map((r) => r.filename));

      for (const file of files) {
        if (applied.has(file)) {
          console.log(`Skipping (already applied): ${file}`);
          continue;
        }

        const sqlText = await readFile(path.join(FEATURE_MIGRATIONS_DIR, file), "utf8");
        await client.query(sqlText);
        // Record inside the same transaction: schema change and tracking
        // record commit or roll back together.
        await client.query("INSERT INTO feature_migrations (filename) VALUES ($1)", [file]);
        console.log(`Applied feature migration: ${file}`);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(
        `Feature migration run failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    console.log("Feature migrations complete.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Feature migration run failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
