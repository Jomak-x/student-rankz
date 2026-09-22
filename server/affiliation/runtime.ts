import "server-only";

import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import { drizzle as postgresDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { asc, eq } from "drizzle-orm";
import { accountVerifications } from "@/db/affiliation-schema";
import { universities } from "@/db/schema";
import { AffiliationService } from "./service";
import { ResendTransport } from "./resend";

function createRuntime() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("Verification database unavailable");
  const transport = process.env.DATABASE_TRANSPORT || "neon-http";
  const options = { connectionString, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  if (transport === "postgres") {
    const pool = new Pool(options);
    pool.on("error", () => {}); // pg removes failed idle clients; queries still reject.
    return { db: postgresDrizzle(pool, { casing: "snake_case" }), pool };
  }
  if (transport !== "neon-http") throw new Error("Verification database unavailable");
  // Verification always needs interactive transactions. Neon catalog HTTP mode
  // therefore uses the supported WebSocket pool here, never the HTTP driver.
  const pool = new NeonPool(options);
  pool.on("error", () => {});
  return { db: neonDrizzle(pool, { casing: "snake_case" }), pool };
}

let cached: ReturnType<typeof createRuntime> | undefined;
export function getVerificationDatabase() {
  cached ??= createRuntime();
  return cached.db;
}

export async function closeVerificationRuntime() {
  const current = cached;
  cached = undefined;
  await current?.pool.end();
}

export function getVerificationService() {
  const hmacSecret = process.env.AFFILIATION_HMAC_SECRET;
  if (!hmacSecret || hmacSecret.trim().length < 32) throw new Error("Verification unavailable");
  // Check mail configuration before allocating a connection or reserving a send.
  const transport = ResendTransport.fromEnv();
  return new AffiliationService({ db: getVerificationDatabase(), hmacSecret, transport });
}

export async function listOwnedVerifications(principal: string, offset: number) {
  // Complete configuration is required so an empty list never implies that a
  // disabled verification flow is ready. No email or provider subject is projected.
  getVerificationService();
  const rows = await getVerificationDatabase().select({
    universityId: accountVerifications.universityId,
    universityName: universities.name,
    verified: accountVerifications.verified,
    verifiedAt: accountVerifications.verifiedAt,
  }).from(accountVerifications)
    .innerJoin(universities, eq(accountVerifications.universityId, universities.id))
    .where(eq(accountVerifications.accountSubject, principal))
    .orderBy(asc(accountVerifications.universityId)).limit(51).offset(offset);
  return { items: rows.slice(0, 50), hasMore: rows.length > 50, nextOffset: rows.length > 50 ? offset + 50 : null };
}
