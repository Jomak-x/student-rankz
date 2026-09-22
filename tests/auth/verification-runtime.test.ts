import { afterEach, expect, test, vi } from "vitest";
import { Pool } from "pg";
vi.mock("server-only", () => ({}));
import { closeVerificationRuntime, getVerificationDatabase, getVerificationService } from "@/server/affiliation/runtime";

afterEach(async () => { await closeVerificationRuntime(); });

test("standard PostgreSQL verification uses a bounded reusable transaction-capable pool", async () => {
  vi.stubEnv("DATABASE_URL", "postgres://unused:unused@localhost:1/unused");
  vi.stubEnv("DATABASE_TRANSPORT", "postgres");
  const db = getVerificationDatabase();
  const pool = db.$client as Pool;
  expect(pool).toBeInstanceOf(Pool);
  expect(typeof db.transaction).toBe("function");
  expect(pool.options.max).toBe(5);
  expect(pool.totalCount).toBe(0); // No network is opened by construction.
  expect(() => pool.emit("error", new Error("private idle failure"))).not.toThrow();
  expect(getVerificationDatabase()).toBe(db);
  await closeVerificationRuntime();
  expect(getVerificationDatabase()).not.toBe(db);
});

test("Neon runtime uses interactive transactions rather than the catalog HTTP client", () => {
  vi.stubEnv("DATABASE_URL", "postgres://unused:unused@ep-test.example/unused");
  vi.stubEnv("DATABASE_TRANSPORT", "neon-http");
  const db = getVerificationDatabase();
  expect(typeof db.transaction).toBe("function");
  expect(typeof db.$client.connect).toBe("function");
  expect(db.$client.totalCount).toBe(0);
  expect(() => db.$client.emit("error", new Error("private idle failure"))).not.toThrow();
});

test.each(["", "   "])("missing database %s refuses runtime construction", url => {
  vi.stubEnv("DATABASE_URL", url);
  expect(() => getVerificationDatabase()).toThrow("Verification database unavailable");
});
test.each(["", "short", " ".repeat(40)])("missing or weak HMAC never creates a service", secret => {
  vi.stubEnv("AFFILIATION_HMAC_SECRET", secret);
  expect(() => getVerificationService()).toThrow("Verification unavailable");
});
test("missing mail fails before database allocation", () => {
  vi.stubEnv("AFFILIATION_HMAC_SECRET", "offline-secret-at-least-32-characters");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("RESEND_FROM", "");
  vi.stubEnv("DATABASE_URL", "");
  expect(() => getVerificationService()).toThrow("RESEND_API_KEY");
});
