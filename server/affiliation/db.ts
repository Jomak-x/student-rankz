import "server-only";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as affiliationSchema from "@/db/affiliation-schema";
import * as directorySchema from "@/db/schema";

// Production database factory for the affiliation service.
//
// Uses the Neon serverless WebSocket Pool, which supports real interactive
// PostgreSQL transactions (SELECT … FOR UPDATE, SAVEPOINT, etc.).  This is
// explicitly distinct from the HTTP-only driver in server/db.ts, which cannot
// run interactive multi-statement transactions.
//
// In Node.js environments without a global WebSocket (Node < 22), set
// neonConfig.webSocketConstructor before calling createAffiliationDb():
//
//   import ws from "ws";
//   neonConfig.webSocketConstructor = ws;
//
// On Vercel and Node 22+, the global WebSocket is available automatically.
//
// Required environment variable: DATABASE_URL (pooled Neon connection string).

export { neonConfig };

const combinedSchema = { ...directorySchema, ...affiliationSchema };

type AffiliationDbInstance = ReturnType<typeof drizzle<typeof combinedSchema>>;
export type AffiliationProdDb = AffiliationDbInstance;

let cached: { db: AffiliationDbInstance; pool: Pool } | undefined;

export function createAffiliationDb(
  connectionString?: string,
): { db: ReturnType<typeof drizzle<typeof combinedSchema>>; pool: Pool } {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required for the affiliation service. " +
        "Set it to a pooled Neon connection string that supports WebSocket connections.",
    );
  }
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema: combinedSchema, casing: "snake_case" });
  return { db, pool };
}

/** Lazy singleton — creates the pool once and reuses it across requests. */
export function getAffiliationDb(): AffiliationProdDb {
  if (!cached) {
    cached = createAffiliationDb();
  }
  return (cached as NonNullable<typeof cached>).db;
}

/**
 * Close the underlying WebSocket pool for the singleton.
 * Call this in graceful-shutdown handlers when running in a long-lived Node.js
 * process.  Safe to call multiple times; subsequent calls are no-ops.
 */
export async function closeAffiliationDb(): Promise<void> {
  if (cached) {
    await cached.pool.end();
    cached = undefined;
  }
}
