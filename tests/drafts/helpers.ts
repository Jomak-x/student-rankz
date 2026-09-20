import { readFile } from "node:fs/promises";
import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgClient, NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  courses,
  instructors,
  universities,
} from "@/db/schema";
import {
  closeDb,
  createEphemeralDatabase,
  dropEphemeralDatabase,
} from "../db/helpers.js";

// Drafts test harness.
//
// Creates a brand-new ephemeral Postgres database, applies the BASE directory
// migrations (via the shared foundation helper) and then the drafts feature
// SQL asset on top — exactly the order the integration PR will consolidate
// into the migration journal later. Nothing is mocked and no real Neon or
// auth provider is involved.

const migrationsFolder = path.resolve(import.meta.dirname, "../../drizzle");
const featureMigrationPath = path.resolve(
  import.meta.dirname,
  "../../db/feature-migrations/private-drafts.sql",
);

export type DraftsTestDatabase = {
  db: NodePgDatabase<Record<string, never>> & { $client: NodePgClient };
  connectionString: string;
  databaseName: string;
};

export async function applyFeatureMigration(
  connectionString: string,
  sqlPath = featureMigrationPath,
): Promise<void> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(await readFile(sqlPath, "utf8"));
  } finally {
    await client.end();
  }
}

export async function createDraftsDatabase(): Promise<DraftsTestDatabase> {
  const base = await createEphemeralDatabase(migrationsFolder);
  await applyFeatureMigration(base.connectionString);
  const db = drizzle(base.connectionString, { casing: "snake_case" });
  return { db, connectionString: base.connectionString, databaseName: base.databaseName };
}

export async function dropDraftsDatabase(
  handle: DraftsTestDatabase,
): Promise<void> {
  await closeDb(handle.db);
  await dropEphemeralDatabase(handle.databaseName);
}

// Fixed baseline directory rows (fictional, mirroring tests/db fixtures):
// two universities, one course and one instructor each, so cross-university
// target mismatches can be exercised.

export const UNIVERSITIES = {
  westhaven: "00000000-0000-4000-9000-00000000a001",
  ostbruck: "00000000-0000-4000-9000-00000000a002",
} as const;

export const COURSES = {
  westhavenAlgorithms: "00000000-0000-4000-9000-00000000c001",
  ostbruckAlgorithms: "00000000-0000-4000-9000-00000000c002",
} as const;

export const INSTRUCTORS = {
  westhavenDoe: "00000000-0000-4000-9000-00000000e001",
  ostbruckRoe: "00000000-0000-4000-9000-00000000e002",
} as const;

export const OWNERS = {
  alice: "auth|subject|alice",
  bob: "auth|subject|bob",
} as const;

type Db = NodePgDatabase<Record<string, never>>;

export async function setupBaselineDirectory(db: Db): Promise<void> {
  await db.insert(universities).values([
    {
      id: UNIVERSITIES.westhaven,
      slug: "westhaven-university",
      name: "Westhaven University (drafts fixture)",
      city: "Westhaven",
      country: "Netherlands",
      countryCode: "NL",
      foundedYear: 1955,
      type: "public",
    },
    {
      id: UNIVERSITIES.ostbruck,
      slug: "ostbruck-institute",
      name: "Ostbrück Institute (drafts fixture)",
      city: "Ostbrück",
      country: "Germany",
      countryCode: "DE",
      foundedYear: 1980,
      type: "technical",
    },
  ]);

  await db.insert(courses).values([
    {
      id: COURSES.westhavenAlgorithms,
      universityId: UNIVERSITIES.westhaven,
      code: "WH-CS200",
      name: "Algorithms",
      credits: "7.50",
      level: "bachelor",
    },
    {
      id: COURSES.ostbruckAlgorithms,
      universityId: UNIVERSITIES.ostbruck,
      code: "WH-CS200",
      name: "Algorithms",
      credits: "5.00",
      level: "bachelor",
    },
  ]);

  await db.insert(instructors).values([
    {
      id: INSTRUCTORS.westhavenDoe,
      universityId: UNIVERSITIES.westhaven,
      slug: "jane-doe",
      fullName: "Prof. Jane Doe",
    },
    {
      id: INSTRUCTORS.ostbruckRoe,
      universityId: UNIVERSITIES.ostbruck,
      slug: "john-roe",
      fullName: "Dr. John Roe",
    },
  ]);
}
