import "server-only";

import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "@/db/schema";

// Server-only database access for the directory.
//
// Configuration is validated lazily: importing this module never throws, so
// the demo frontend builds and runs without any database credentials. The
// first actual backend access through getDb() requires DATABASE_URL.
//
// The client uses the Neon serverless HTTP driver, which works on Vercel
// serverless and edge runtimes without holding open TCP connections.

export type AppDatabase = ReturnType<typeof createDatabase>;

function createDatabase(url: string) {
  return drizzle(url, { schema, casing: "snake_case" });
}

let cached: AppDatabase | undefined;

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL;
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
      "DATABASE_URL is not set. Database-backed features require a Postgres connection string; the demo frontend intentionally runs without one.",
    );
  }
  cached = createDatabase(url);
  return cached;
}

export { schema };
