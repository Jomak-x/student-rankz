import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { cleanupRecipientSendLog } from "./cleanup";

async function main(): Promise<void> {
  // Require an explicitly exported target; do not load ambient .env files.
  // No recipient, cutoff, or other options are accepted.
  if (process.argv.length !== 3 || process.argv[2] !== "--yes") {
    throw new Error("confirmation required");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("database required");
  const url = new URL(connectionString);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("PostgreSQL required");
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });
  try {
    const deleted = await cleanupRecipientSendLog(drizzle(pool, { casing: "snake_case" }));
    console.log(`Deleted ${deleted} expired recipient send reservations.`);
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  // Database errors can contain credentials or private row contents.
  console.error(
    "Affiliation cleanup failed. Verify the exported DATABASE_URL target and run npm run affiliation:cleanup -- --yes. No recipient or cutoff options are accepted.",
  );
  process.exitCode = 1;
});
