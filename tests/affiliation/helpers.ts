import { readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import {
  createEphemeralDatabase,
  dropEphemeralDatabase,
} from "../db/helpers.js";
import { universities } from "@/db/schema";
import { universityDomains } from "@/db/affiliation-schema";

export { dropEphemeralDatabase };

const BASE_MIGRATIONS = path.resolve(import.meta.dirname, "../../drizzle");
const AFFILIATION_SQL_PATH = path.resolve(
  import.meta.dirname,
  "../../db/feature-migrations/affiliation.sql",
);

export type TestDb = ReturnType<typeof drizzle<Record<string, never>>>;

/**
 * Creates a fully migrated ephemeral Postgres database:
 * - applies the base Drizzle migration (directory schema)
 * - applies the affiliation feature SQL migration
 *
 * Each call returns an isolated database; call dropAffiliationTestDb when done.
 */
export async function createAffiliationTestDb(): Promise<{
  db: TestDb;
  databaseName: string;
  connectionString: string;
}> {
  const ephemeral = await createEphemeralDatabase(BASE_MIGRATIONS);

  // Apply the affiliation feature SQL after the base migration.
  const affiliationSql = await readFile(AFFILIATION_SQL_PATH, "utf8");
  const client = new Client({ connectionString: ephemeral.connectionString });
  await client.connect();
  try {
    // pg simple query protocol executes all semicolon-separated statements.
    await client.query(affiliationSql);
  } finally {
    await client.end();
  }

  const db = drizzle(ephemeral.connectionString, { casing: "snake_case" });
  return { db, databaseName: ephemeral.databaseName, connectionString: ephemeral.connectionString };
}

export async function dropAffiliationTestDb(
  db: TestDb,
  databaseName: string,
): Promise<void> {
  await db.$client.end();
  await dropEphemeralDatabase(databaseName);
}

// ── Fixture data ──────────────────────────────────────────────────────────────

export const UNIVERSITIES = {
  westhaven: "00000000-0000-4000-9000-aff000000001",
  ostbruck: "00000000-0000-4000-9000-aff000000002",
};

export const DOMAINS = {
  westhavenStudent: "student.westhaven.nl",
  westhavenStaff: "westhaven.nl",
  ostbruckStudent: "student.ostbruck.de",
};

export async function seedFixtures(db: TestDb): Promise<void> {
  await db.insert(universities).values([
    {
      id: UNIVERSITIES.westhaven,
      slug: "westhaven-university-aff",
      name: "Westhaven University",
      city: "Westhaven",
      country: "Netherlands",
      countryCode: "NL",
      type: "public",
    },
    {
      id: UNIVERSITIES.ostbruck,
      slug: "ostbruck-institute-aff",
      name: "Ostbrück Institute",
      city: "Ostbrück",
      country: "Germany",
      countryCode: "DE",
      type: "technical",
    },
  ]);

  await db.insert(universityDomains).values([
    {
      universityId: UNIVERSITIES.westhaven,
      domain: DOMAINS.westhavenStudent,
      active: true,
    },
    {
      universityId: UNIVERSITIES.westhaven,
      domain: DOMAINS.westhavenStaff,
      active: true,
    },
    {
      universityId: UNIVERSITIES.ostbruck,
      domain: DOMAINS.ostbruckStudent,
      active: true,
    },
  ]);
}
