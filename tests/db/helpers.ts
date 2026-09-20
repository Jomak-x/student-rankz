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
  try {
    await migrate(db, { migrationsFolder });
  } catch (error) {
    // Setup failed: clean up what this call created (its own pool and its
    // own database only) and rethrow the original failure. A cleanup error
    // is attached as `cleanupError` and never masks the original.
    let cleanupError: unknown;
    try {
      await db.$client.end();
    } catch (closeError) {
      cleanupError ??= closeError;
    }
    try {
      await dropEphemeralDatabase(databaseName);
    } catch (dropError) {
      cleanupError ??= dropError;
    }
    if (cleanupError !== undefined) {
      (error as { cleanupError?: unknown }).cleanupError = cleanupError;
    }
    // Expose which database this call created so tests (and operators) can
    // verify it was dropped.
    (error as { ephemeralDatabaseName?: string }).ephemeralDatabaseName =
      databaseName;
    throw error;
  }
  // Close the migrator pool so later DROP DATABASE cannot kill live
  // connections.
  await db.$client.end();

  return { connectionString, databaseName };
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

/** Close the connection pool behind a drizzle node-postgres instance. */
export async function closeDb(db: { $client: { end: () => Promise<void> } }) {
  await db.$client.end();
}
