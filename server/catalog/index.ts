import "server-only";

// Server-only barrel for the catalog read service.
//
// Application code (server components, route handlers) imports from here: the
// `server-only` import makes bundlers reject any client-component usage, and
// the default binding wires the service to the lazy `getDb()` from
// server/db.ts (no environment access at import time).
//
// Tests import the pure factory from ./service directly so they can inject an
// ephemeral Postgres client.

import { getDb } from "@/server/db";

import type { CatalogService } from "./service";
import { createCatalogService } from "./service";

export { CatalogUnavailableError, isCatalogUnavailableError } from "./errors";
export type { CatalogUnavailableReason } from "./errors";
export type { CatalogService } from "./service";
export type {
  ListCoursesParams,
  ListUniversitiesParams,
  ReviewsPageParams,
  TopUniversitiesParams,
} from "./service";

let defaultService: CatalogService | undefined;

/** Catalog service bound to the application database (lazy, server-only). */
export function getCatalogService(): CatalogService {
  if (!defaultService) {
    defaultService = createCatalogService({ getDb: () => getDb() });
  }
  return defaultService;
}
