// Feature migration runner: applies the ordered SQL assets in
// db/feature-migrations/ AFTER the base Drizzle migrations (npm run
// db:migrate). Explicitly operator-invoked only — never part of build,
// deploy or CI pipelines.
//
// The final integration PR consolidates these assets into the generated
// Drizzle journal; this runner keeps the interim workflow honest and simple.
//
// Usage:
//   DATABASE_URL=postgres://... npm run db:migrate:feature
//   # or, preferring the unpooled migration connection:
//   DATABASE_DIRECT_URL=postgres://... npm run db:migrate:feature

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const FEATURE_MIGRATIONS_DIR = path.resolve(import.meta.dirname, "feature-migrations");

async function featureMigrationFiles(): Promise<string[]> {
  const entries = await readdir(FEATURE_MIGRATIONS_DIR);
  // Ordered asset: lexicographic filename order is the application order.
  return entries.filter((name) => name.endsWith(".sql")).sort();
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
    for (const file of files) {
      const sqlText = await readFile(path.join(FEATURE_MIGRATIONS_DIR, file), "utf8");
      try {
        // Simple query protocol: multi-statement files apply atomically per
        // file via an explicit transaction.
        await client.query("BEGIN");
        await client.query(sqlText);
        await client.query("COMMIT");
        console.log(`Applied feature migration: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(
          `Feature migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Feature migration run failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
