import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";

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

// Each catalog test uses the complete ordered Drizzle journal in a fresh
// database. Feature SQL must not be replayed outside its tracking protocol.

const repoRoot = path.resolve(import.meta.dirname, "../..");
const drizzleMigrationsFolder = path.resolve(repoRoot, "drizzle");

export type CatalogEphemeralDatabase = EphemeralDatabase & {
  db: TestDb;
};

export async function createCatalogDatabase(): Promise<CatalogEphemeralDatabase> {
  const ephemeral = await createEphemeralDatabase(drizzleMigrationsFolder);

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
