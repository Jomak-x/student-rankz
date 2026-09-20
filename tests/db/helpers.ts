import { randomUUID } from "node:crypto";
import { Client } from "pg";

// Ephemeral PostgreSQL test helper.
//
// Each test run creates a brand-new database on the test Postgres server,
// applies the Drizzle migrations, and drops the database afterwards. Nothing
// is mocked: constraints are exercised against a real PostgreSQL server.
//
// TEST_DATABASE_URL points at an administrative connection (any database the
// server allows creating databases from); it defaults to the local Docker
// Postgres started by docs/DATABASE.md.

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:15432/postgres";

export type EphemeralDatabase = {
  /** Connection string for the fresh, migrated database. */
  connectionString: string;
  databaseName: string;
};

export async function createEphemeralDatabase(
  migrationsFolder: string,
): Promise<EphemeralDatabase> {
  const databaseName = `sr_test_${randomUUID().replaceAll("-", "").slice(0, 16)}`;

  const admin = new Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }

  const parsed = new URL(TEST_DATABASE_URL);
  parsed.pathname = `/${databaseName}`;
  const connectionString = parsed.toString();

  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const db = drizzle(connectionString);
  await migrate(db, { migrationsFolder });
  // Close the migrator pool so later DROP DATABASE cannot kill live
  // connections.
  await db.$client.end();

  return { connectionString, databaseName };
}

/** Close the connection pool behind a drizzle node-postgres instance. */
export async function closeDb(db: { $client: { end: () => Promise<void> } }) {
  await db.$client.end();
}

export async function dropEphemeralDatabase(
  databaseName: string,
): Promise<void> {
  const admin = new Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  try {
    await admin.query(
      `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
    );
  } finally {
    await admin.end();
  }
}

export async function withEphemeralDatabase(
  migrationsFolder: string,
  fn: (db: EphemeralDatabase) => Promise<void>,
): Promise<void> {
  const ephemeral = await createEphemeralDatabase(migrationsFolder);
  try {
    await fn(ephemeral);
  } finally {
    await dropEphemeralDatabase(ephemeral.databaseName);
  }
}
