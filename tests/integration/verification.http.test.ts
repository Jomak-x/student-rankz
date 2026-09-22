import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { universities } from "../../db/schema";
import { accountVerifications, recipientSendLog, universityDomains } from "../../db/affiliation-schema";

const external = vi.hoisted(() => ({
  getSession: vi.fn(),
  send: vi.fn(),
  createNeonAuth: vi.fn(),
}));
vi.mock("@neondatabase/auth/next/server", () => ({ createNeonAuth: external.createNeonAuth }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: external.send };
  },
}));

import { GET as list } from "../../app/api/affiliation/route";
import { POST as initiate } from "../../app/api/affiliation/initiate/route";
import { POST as consume } from "../../app/api/affiliation/consume/route";
import { GET as cleanup, HEAD as cleanupHead } from "../../app/api/internal/affiliation-cleanup/route";
import { closeVerificationRuntime, getVerificationDatabase } from "../../server/affiliation/runtime";

const origin = "http://localhost:3191";
const universityId = "00000000-0000-4000-8000-000000009001";
const secondUniversityId = "00000000-0000-4000-8000-000000009002";
const email = "student@approved.example";
const owner1 = "provider-subject-private-one";
const owner2 = "provider-subject-private-two";
const hmacSecret = "integration-hmac-secret-never-serialize-123456";
const cronSecret = "integration-cron-secret-never-serialize-123456";
const providerToken = "private-provider-session-token";
const unexpectedFetch = vi.fn(() => { throw new Error("Unexpected network request: only PostgreSQL TCP is permitted."); });
let ephemeral: { connectionString: string; databaseName: string } | undefined;
let dropDatabase: ((name: string) => Promise<void>) | undefined;

function asOwner(subject = owner1) {
  external.getSession.mockResolvedValue({
    data: {
      user: { id: subject, name: "Synthetic Account", email: "private-login@example.test" },
      session: { id: "private-session-id", userId: subject, expiresAt: "2100-01-01T00:00:00.000Z", token: providerToken },
    },
    error: null,
  });
}
function configure() {
  vi.stubEnv("DATABASE_URL", ephemeral?.connectionString ?? "");
  vi.stubEnv("DATABASE_TRANSPORT", "postgres");
  vi.stubEnv("NEON_AUTH_BASE_URL", "https://ep-verification-test.neon.tech");
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "integration-cookie-secret-with-32-characters");
  vi.stubEnv("AFFILIATION_HMAC_SECRET", hmacSecret);
  vi.stubEnv("RESEND_API_KEY", "synthetic-resend-key-never-used-on-network");
  vi.stubEnv("RESEND_FROM", "verification@sender.example");
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("CRON_SECRET", cronSecret);
  vi.stubEnv("NEXT_PHASE", "");
}
function request(route = "", data?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/affiliation${route}`, {
    method: data === undefined ? "GET" : "POST",
    headers: { origin, "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
async function json(response: Response, status = 200) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const value = await response.json();
  const serialized = JSON.stringify(value);
  for (const secret of [email, owner1, owner2, hmacSecret, cronSecret, providerToken, "private-login@example.test", "accountSubject", "emailAddress", "codeHmac", "challengeId", "sendWindowStartsAt"]) {
    expect(serialized).not.toContain(secret);
  }
  return value;
}
async function error(response: Response, status: number, code: string) {
  expect(await json(response, status)).toEqual({ error: { code, message: expect.any(String) } });
}
function capturedCode(index = external.send.mock.calls.length - 1) {
  const message = external.send.mock.calls[index][0] as { to: string; text: string };
  expect(message.to).toBe(email);
  const code = message.text.match(/^\s+(\d{6})$/m)?.[1];
  expect(code).toMatch(/^\d{6}$/);
  return code!;
}
async function start() {
  expect(await json(await initiate(request("/initiate", { email })))).toEqual({ ok: true, universityId });
  return capturedCode();
}

beforeAll(async () => {
  vi.stubGlobal("fetch", unexpectedFetch);
  vi.stubEnv("TEST_DATABASE_URL", process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:63346/postgres");
  const helpers = await import("../db/helpers");
  dropDatabase = helpers.dropEphemeralDatabase;
  ephemeral = await helpers.createEphemeralDatabase(path.resolve("drizzle"));
  configure();
  const db = getVerificationDatabase();
  await db.insert(universities).values([
    { id: universityId, slug: "verification-http-example", name: "Verification University (synthetic)", city: "Example", country: "Germany", countryCode: "DE", type: "public" },
    { id: secondUniversityId, slug: "verification-inactive-example", name: "Inactive University (synthetic)", city: "Example", country: "France", countryCode: "FR", type: "public" },
  ]);
  await db.insert(universityDomains).values([
    { universityId, domain: "approved.example", active: true },
    { universityId: secondUniversityId, domain: "inactive.example", active: false },
  ]);
});
beforeEach(async () => {
  configure();
  external.getSession.mockReset();
  external.createNeonAuth.mockReset().mockReturnValue({ getSession: external.getSession });
  external.send.mockReset().mockResolvedValue({ data: { id: "synthetic-mail-acknowledgement" }, error: null });
  unexpectedFetch.mockClear();
  asOwner();
  await getVerificationDatabase().execute(sql`TRUNCATE account_verifications, recipient_send_log`);
});
afterEach(() => {
  // Every route read AND mutation must bypass the signed-cookie cache using
  // the exact SDK string, rather than mocking getVerifiedWriteSession itself.
  for (const args of external.getSession.mock.calls) {
    expect(args).toEqual([{ query: { disableCookieCache: "true" } }]);
  }
  expect(unexpectedFetch).not.toHaveBeenCalled();
});
afterAll(async () => {
  try { await closeVerificationRuntime(); }
  finally {
    try { if (ephemeral && dropDatabase) await dropDatabase(ephemeral.databaseName); }
    finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
  }
});

it("uses provider-fresh identity, delivers a bound code, isolates owners and rejects replay without leaking secrets", async () => {
  const code = await start();
  expect(external.getSession).toHaveBeenCalledTimes(1);
  const [pending] = await getVerificationDatabase().select().from(accountVerifications);
  expect(pending).toMatchObject({ accountSubject: owner1, emailAddress: email, verified: false, deliveryState: "sent" });
  expect(pending.codeHmac).toMatch(/^[a-f0-9]{64}$/);
  expect(pending.codeHmac).not.toContain(code);
  const ownPending = await json(await list(request()));
  expect(ownPending).toEqual({ items: [{ universityId, universityName: "Verification University (synthetic)", verified: false, verifiedAt: null }], hasMore: false, nextOffset: null });

  asOwner(owner2);
  expect(await json(await list(request()))).toEqual({ items: [], hasMore: false, nextOffset: null });
  await error(await consume(request("/consume", { email, code })), 400, "NOT_PENDING");
  await error(await list(request(`?accountSubject=${owner1}`)), 400, "INVALID_INPUT");
  asOwner(owner1);
  expect(await json(await consume(request("/consume", { email, code })))).toEqual({ ok: true, universityId });
  const result = await json(await list(request()));
  expect(result).toEqual({ items: [{ universityId, universityName: "Verification University (synthetic)", verified: true, verifiedAt: expect.any(String) }], hasMore: false, nextOffset: null });
  expect(JSON.stringify(result)).not.toContain(pending.codeHmac);
  expect(JSON.stringify(result)).not.toContain(code);
  await error(await consume(request("/consume", { email, code })), 409, "ALREADY_VERIFIED");
  asOwner(owner2);
  expect(await json(await list(request()))).toEqual({ items: [], hasMore: false, nextOffset: null });
  const [verified] = await getVerificationDatabase().select().from(accountVerifications);
  expect(verified).toMatchObject({ verified: true, codeHmac: null, challengeId: null, deliveryState: null });
  expect(external.send).toHaveBeenCalledTimes(1);
});

it.each([
  ["missing-at", "INVALID_EMAIL"],
  ["student@@approved.example", "INVALID_EMAIL"],
  ["student@unknown.example", "UNKNOWN_DOMAIN"],
  ["student@inactive.example", "UNKNOWN_DOMAIN"],
  ["student@approved.example.attacker.example", "UNKNOWN_DOMAIN"],
])("rejects unsupported or malformed address %s before sending", async (address, code) => {
  await error(await initiate(request("/initiate", { email: address })), 400, code);
  expect(external.send).not.toHaveBeenCalled();
  expect(await getVerificationDatabase().select().from(recipientSendLog)).toEqual([]);
});

it.each(["revoked", "outage", "malformed"] as const)("provider %s fails closed even when a previous fresh request succeeded", async state => {
  const code = await start();
  if (state === "revoked") external.getSession.mockResolvedValue({ data: null, error: null });
  if (state === "outage") external.getSession.mockRejectedValue(new Error("private-provider-diagnostic"));
  if (state === "malformed") external.getSession.mockResolvedValue({ data: { user: { id: owner1 }, session: {} }, error: null });
  const status = state === "outage" ? 503 : 401;
  const failure = state === "outage" ? "UNAVAILABLE" : "UNAUTHENTICATED";
  await error(await list(request()), status, failure);
  await error(await initiate(request("/initiate", { email })), status, failure);
  await error(await consume(request("/consume", { email, code })), status, failure);
  expect(external.send).toHaveBeenCalledTimes(1);
  expect((await getVerificationDatabase().select().from(accountVerifications))[0].verified).toBe(false);
  expect(external.getSession).toHaveBeenCalledTimes(4);
});

it("rejects forged origins and cross-site headers without reserving or sending", async () => {
  const forgedHeaders: Record<string, string>[] = [
    { origin: "https://attacker.example", host: "attacker.example", "x-forwarded-host": "attacker.example" },
    { origin: "", "sec-fetch-site": "same-origin" },
    { origin, "sec-fetch-site": "cross-site" },
  ];
  for (const headers of forgedHeaders) {
    await error(await initiate(request("/initiate", { email }, headers)), 403, "FORBIDDEN");
    await error(await consume(request("/consume", { email, code: "123456" }, headers)), 403, "FORBIDDEN");
  }
  expect(external.send).not.toHaveBeenCalled();
  expect(await getVerificationDatabase().select().from(recipientSendLog)).toEqual([]);
});

it("rejects caller identity injection, caller filters and malformed code", async () => {
  await error(await initiate(request("/initiate", { email, accountSubject: owner2 })), 400, "INVALID_INPUT");
  await error(await initiate(request("/initiate?principal=other", { email })), 400, "INVALID_INPUT");
  await error(await consume(request("/consume", { email, code: "abc123" })), 400, "INVALID_CODE");
  await error(await list(request("?offset=-1")), 400, "INVALID_INPUT");
  expect(external.send).not.toHaveBeenCalled();
});

it("enforces the real account send limit", async () => {
  for (let i = 0; i < 3; i++) await start();
  await error(await initiate(request("/initiate", { email })), 429, "RATE_LIMITED");
  expect(external.send).toHaveBeenCalledTimes(3);
  expect(await getVerificationDatabase().select().from(recipientSendLog)).toHaveLength(3);
});

it("failed delivery acknowledgement preserves recipient reservations across accounts and invalidates the code", async () => {
  external.send.mockResolvedValue({ data: null, error: { message: "Provider accepted mail but acknowledgement failed" } });
  for (let i = 0; i < 5; i++) {
    asOwner(`failed-mail-owner-${i}`);
    await error(await initiate(request("/initiate", { email })), 503, "SEND_FAILED");
    await error(await consume(request("/consume", { email, code: capturedCode() })), 400, "NOT_PENDING");
  }
  asOwner("sixth-recipient-attempt");
  await error(await initiate(request("/initiate", { email })), 429, "RATE_LIMITED");
  expect(external.send).toHaveBeenCalledTimes(5);
  expect(await getVerificationDatabase().select().from(recipientSendLog)).toHaveLength(5);
  const rows = await getVerificationDatabase().select().from(accountVerifications);
  expect(rows).toHaveLength(5);
  for (const row of rows) expect(row).toMatchObject({ verified: false, codeHmac: null, challengeId: null, deliveryState: null, sendCount: 1 });
});

it("missing mail or HMAC configuration fails closed before reservation", async () => {
  for (const name of ["RESEND_API_KEY", "RESEND_FROM", "AFFILIATION_HMAC_SECRET"]) {
    const original = process.env[name]!;
    vi.stubEnv(name, "");
    await error(await initiate(request("/initiate", { email })), 503, "UNAVAILABLE");
    await error(await list(request()), 503, "UNAVAILABLE");
    vi.stubEnv(name, original);
  }
  expect(external.send).not.toHaveBeenCalled();
  expect(await getVerificationDatabase().select().from(recipientSendLog)).toEqual([]);
});

it("trusted cleanup removes expired reservations globally, preserves active rows, and rejects caller cutoffs", async () => {
  const db = getVerificationDatabase();
  const activeId = randomUUID();
  await db.insert(recipientSendLog).values([
    { recipientEmail: "abandoned-one@approved.example", challengeId: randomUUID(), sentAt: sql`now() - interval '2 hours'` },
    { recipientEmail: "abandoned-two@inactive.example", challengeId: randomUUID(), sentAt: sql`now() - interval '3 hours'` },
    { id: activeId, recipientEmail: email, challengeId: randomUUID(), sentAt: sql`now() - interval '30 minutes'` },
  ]);
  const maintenance = (query = "", authorization?: string) => new Request(`${origin}/api/internal/affiliation-cleanup${query}`, { headers: authorization === undefined ? {} : { authorization } });
  const unauthorized = await cleanup(maintenance());
  expect(unauthorized.status).toBe(401);
  expect(await unauthorized.json()).toEqual({ error: "Unauthorized." });
  expect((await cleanup(maintenance("", "Bearer wrong-secret"))).status).toBe(401);
  expect((await cleanup(maintenance("?cutoff=2100-01-01", `Bearer ${cronSecret}`))).status).toBe(400);
  expect((await cleanup(maintenance(`?secret=${cronSecret}`))).status).toBe(401);
  expect(cleanupHead().status).toBe(405);
  expect(await db.select().from(recipientSendLog)).toHaveLength(3);
  vi.stubEnv("CRON_SECRET", "");
  expect((await cleanup(maintenance("", `Bearer ${cronSecret}`))).status).toBe(503);
  vi.stubEnv("CRON_SECRET", cronSecret);
  expect(await json(await cleanup(maintenance("", `Bearer ${cronSecret}`)))).toEqual({ deleted: 2 });
  expect(await db.select().from(recipientSendLog)).toHaveLength(1);
  expect(await db.select().from(recipientSendLog).where(eq(recipientSendLog.id, activeId))).toHaveLength(1);
  expect(await json(await cleanup(maintenance("", `Bearer ${cronSecret}`)))).toEqual({ deleted: 0 });
  expect(external.getSession).not.toHaveBeenCalled();
  expect(external.send).not.toHaveBeenCalled();
});
