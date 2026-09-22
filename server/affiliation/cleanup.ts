import { sql } from "drizzle-orm";

import { recipientSendLog } from "@/db/affiliation-schema";
import type { AffiliationServiceConfig } from "./service.js";

/**
 * Global expiry sweep, including recipients that never initiate again.
 * The fixed DB-clock cutoff matches initiate's one-hour throttle window.
 * No recipient or caller-controlled cutoff; active reservations are untouched.
 * Call from a trusted maintenance process, never an unauthenticated route.
 */
export async function cleanupRecipientSendLog(
  db: AffiliationServiceConfig["db"],
): Promise<number> {
  const result = await db.execute<{ deleted_count: number }>(sql`
    WITH deleted AS (
      DELETE FROM ${recipientSendLog}
      WHERE ${recipientSendLog.sentAt} <= now() - interval '1 hour'
      RETURNING 1
    )
    SELECT count(*)::int AS deleted_count FROM deleted
  `);
  // Only an aggregate leaves the database, never addresses or challenge IDs.
  return result.rows[0].deleted_count;
}
