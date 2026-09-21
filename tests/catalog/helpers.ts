import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import {
  closeDb,
  createEphemeralDatabase,
  dropEphemeralDatabase,
  type EphemeralDatabase,
} from "../db/helpers.js";
import { createCatalogService } from "@/server/catalog/service";
import type { CatalogDatabase } from "@/server/catalog/database";

// Capture the exact return type of a no-schema drizzle call.
// ReturnType<typeof drizzle> resolves to the constraint bound
// NodePgDatabase<Record<string,unknown>>; the explicit type argument below
// gives the default NodePgDatabase<Record<string,never>> that the seed helpers
// expect.
type TestDb = ReturnType<typeof drizzle<Record<string, never>>>;

// Ephemeral catalog test helper, layered on the foundation harness
// (tests/db/helpers.ts): creates a brand-new Postgres database, applies the
// base Drizzle migrations, then applies the ordered feature migration SQL
// assets (db/feature-migrations/*.sql) after the base — exactly the sequence
// the interim operator workflow and final integration use.

const repoRoot = path.resolve(import.meta.dirname, "../..");
const drizzleMigrationsFolder = path.resolve(repoRoot, "drizzle");
const featureMigrationsFolder = path.resolve(repoRoot, "db/feature-migrations");

export type CatalogEphemeralDatabase = EphemeralDatabase & {
  db: TestDb;
};

export async function createCatalogDatabase(): Promise<CatalogEphemeralDatabase> {
  const ephemeral = await createEphemeralDatabase(drizzleMigrationsFolder);

  const client = new Client({ connectionString: ephemeral.connectionString });
  await client.connect();
  try {
    const files = (await readdir(featureMigrationsFolder))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const sqlText = await readFile(path.join(featureMigrationsFolder, file), "utf8");
      // Simple query protocol accepts multi-statement SQL files.
      await client.query(sqlText);
    }
  } finally {
    await client.end();
  }

  const db = drizzle(ephemeral.connectionString, { casing: "snake_case" });
  return { ...ephemeral, db };
}

export async function dropCatalogDatabase(ephemeral: CatalogEphemeralDatabase): Promise<void> {
  await closeDb(ephemeral.db);
  await dropEphemeralDatabase(ephemeral.databaseName);
}

export type CatalogTestContext = {
  db: TestDb;
  service: ReturnType<typeof createCatalogService>;
  ephemeral: CatalogEphemeralDatabase;
};

// Builds a catalog service bound to one shared ephemeral-database client so
// connections are not leaked per call. Tests close the pool via
// dropCatalogDatabase().
export async function withCatalogDatabase(
  fn: (ctx: CatalogTestContext) => Promise<void>,
): Promise<void> {
  const ephemeral = await createCatalogDatabase();
  const db = ephemeral.db;
  const database = db as unknown as CatalogDatabase;
  const service = createCatalogService({ getDb: () => database });
  try {
    await fn({ db, service, ephemeral });
  } finally {
    await dropCatalogDatabase(ephemeral);
  }
}
