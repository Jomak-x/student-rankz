import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { NormalizedPagination } from "./params";

// Any Drizzle PostgreSQL instance works as a catalog database: the runtime app
// passes the Neon HTTP client from server/db.ts (see server/catalog/index.ts),
// while tests pass node-postgres clients against an ephemeral Postgres. Both
// satisfy this wide PgDatabase shape; only the common query-builder subset is
// used here (no driver-specific APIs, no transactions in read paths).
export type CatalogDatabase = PgDatabase<
  PgQueryResultHKT,
  Record<string, unknown>,
  ExtractTablesWithRelations<Record<string, unknown>>
>;

export type CatalogServiceDeps = {
  /** Lazily provides the database client; may throw when unconfigured. */
  getDb: () => CatalogDatabase;
};

export type { NormalizedPagination };

// Values returned by drivers vary (node-postgres returns numeric aggregates as
// strings; neon-http may return numbers). These helpers normalise driver
// values without ever inventing data: null stays null.

export function toCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  // Two decimals are plenty for 1–5 rating averages and keep ordering stable.
  return Math.round(parsed * 100) / 100;
}

export function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
