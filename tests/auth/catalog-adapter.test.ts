import { afterEach, expect, test, vi } from "vitest";
import { Pool } from "pg";

vi.mock("server-only", () => ({}));

let pool: Pool | undefined;
afterEach(async () => {
  await pool?.end();
  pool = undefined;
  vi.resetModules();
});

test("idle PostgreSQL disconnects are handled without losing the reusable pool", async () => {
  vi.stubEnv("DATABASE_TRANSPORT", "postgres");
  vi.stubEnv("DATABASE_URL", "postgres://unused:unused@localhost:1/unused");
  const { getDb } = await import("@/server/db");
  const db = getDb();
  pool = db.$client as Pool;
  expect(pool).toBeInstanceOf(Pool);
  // No connection is opened. Exercise pg's actual EventEmitter contract for
  // errors outside an awaited query, which otherwise terminate the process.
  expect(() => pool!.emit("error", new Error("private connection failure"))).not.toThrow();
  expect(getDb()).toBe(db);
});

test("public catalog reads hide provider diagnostics and distinguish configuration", async () => {
  const { readCatalog } = await import("@/server/catalog/read");
  const { CatalogUnavailableError } = await import("@/server/catalog");
  const secret = "postgres://private-credentials@private-host/database";
  expect(await readCatalog(async () => { throw new Error(secret); })).toEqual({ status: "unavailable" });
  expect(await readCatalog(async () => { throw new CatalogUnavailableError("database-not-configured"); })).toEqual({ status: "unconfigured" });
  expect(await readCatalog(async () => [])).toEqual({ status: "ready", data: [] });
});
