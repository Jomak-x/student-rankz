import "server-only";

import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as postgresDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

// Server-only database access for the directory.
//
// Configuration is validated lazily: importing this module never throws, so
// the frontend builds and renders unavailable states without credentials. The
// first actual backend access through getDb() requires DATABASE_URL.
//
// Neon HTTP is the default. Standard PostgreSQL uses a bounded Node.js pool.

export type AppDatabase = ReturnType<typeof createDatabase>;

function createDatabase(url: string) {
  const transport = process.env.DATABASE_TRANSPORT || "neon-http";
  if (transport === "postgres") {
    const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 });
    // pg removes failed idle clients before emitting this event. Handle it so
    // a disconnect cannot become an uncaught process error. Active query
    // failures still reject and become a generic catalog unavailable state.
    pool.on("error", () => {});
    return postgresDrizzle(pool, { schema, casing: "snake_case" });
  }
  if (transport !== "neon-http") throw new Error("Unsupported database transport");
  return drizzle(url, { schema, casing: "snake_case" });
}

let cached: AppDatabase | undefined;

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL?.trim() || undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

export function getDb(): AppDatabase {
  if (cached) {
    return cached;
  }
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Database-backed features require a Postgres connection string; unconfigured pages render an unavailable notice.",
    );
  }
  cached = createDatabase(url);
  return cached;
}

export { schema };
