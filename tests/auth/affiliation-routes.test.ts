import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  createNeonAuth: vi.fn(), getSession: vi.fn(), service: vi.fn(), initiate: vi.fn(), consume: vi.fn(), list: vi.fn(), db: vi.fn(), cleanup: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/auth/next/server", () => ({ createNeonAuth: boundary.createNeonAuth }));
vi.mock("@/server/affiliation/runtime", () => ({
  getVerificationService: boundary.service, listOwnedVerifications: boundary.list, getVerificationDatabase: boundary.db,
}));
vi.mock("@/server/affiliation/cleanup", () => ({ cleanupRecipientSendLog: boundary.cleanup }));
import { GET as list } from "@/app/api/affiliation/route";
import { POST as initiate } from "@/app/api/affiliation/initiate/route";
import { POST as consume } from "@/app/api/affiliation/consume/route";
import { GET as cleanup, HEAD as cleanupHead } from "@/app/api/internal/affiliation-cleanup/route";

const origin = "https://preview.example.test";
const owner = "provider-owner";
const universityId = "00000000-0000-4000-8000-000000000001";
const email = "student@university.example";
const session = { user: { id: owner, name: "Test", email }, session: { id: "provider-session", userId: owner, expiresAt: new Date(Date.now() + 600_000).toISOString() } };
const routes = [
  { name: "list", method: "GET", handler: list, operation: boundary.list },
  { name: "initiate", method: "POST", handler: initiate, operation: boundary.initiate },
  { name: "consume", method: "POST", handler: consume, operation: boundary.consume },
] as const;
type Route = typeof routes[number];
function request(route: Route, options: { body?: unknown; headers?: Record<string, string>; query?: string } = {}) {
  return new Request(`${origin}/api/affiliation${route.name === "list" ? "" : `/${route.name}`}${options.query ?? ""}`, {
    method: route.method,
    headers: { "content-type": "application/json", origin, ...options.headers },
    ...(route.method === "POST" ? { body: JSON.stringify(options.body ?? (route.name === "consume" ? { email, code: "123456" } : { email })) } : {}),
  });
}
beforeEach(() => {
  Object.values(boundary).forEach(mock => mock.mockReset());
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("NEON_AUTH_BASE_URL", "https://ep-auth-test.neon.tech");
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "offline-secret-at-least-32-characters");
  vi.stubEnv("NEXT_PHASE", "");
  vi.stubEnv("CRON_SECRET", "offline-maintenance-secret-at-least-32-characters");
  boundary.createNeonAuth.mockReturnValue({ getSession: boundary.getSession });
  boundary.getSession.mockResolvedValue({ data: session, error: null });
  boundary.service.mockReturnValue({ initiate: boundary.initiate, consume: boundary.consume });
  boundary.initiate.mockResolvedValue({ ok: true, universityId });
  boundary.consume.mockResolvedValue({ ok: true, universityId });
  boundary.list.mockResolvedValue({ items: [], hasMore: false, nextOffset: null });
  boundary.cleanup.mockResolvedValue(3);
});

describe.each(routes)("verification $name boundary", route => {
  it("uses a provider-fresh subject and private responses", async () => {
    const response = await route.handler(request(route));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(boundary.getSession).toHaveBeenCalledWith({ query: { disableCookieCache: "true" } });
    expect(route.operation.mock.calls[0][0]).toBe(owner);
    expect(await response.text()).not.toContain(owner);
  });
  it.each(["anonymous", "outage", "throw"])("denies %s without touching the service", async state => {
    if (state === "throw") boundary.getSession.mockRejectedValue(new Error("private provider diagnostic"));
    else boundary.getSession.mockResolvedValue({ data: null, error: state === "outage" ? { message: "private diagnostic" } : null });
    const response = await route.handler(request(route));
    expect(response.status).toBe(state === "anonymous" ? 401 : 503);
    expect(route.operation).not.toHaveBeenCalled();
    expect(boundary.service).not.toHaveBeenCalled();
    expect(await response.text()).not.toMatch(/private diagnostic|provider-owner/);
  });
  it("hides unexpected infrastructure errors", async () => {
    route.operation.mockRejectedValue(new Error("secret@database-private-host"));
    const response = await route.handler(request(route));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("database-private-host");
  });
});

describe.each(routes.filter(route => route.method === "POST"))("verification $name writes", route => {
  it.each<Record<string, string>>([
    { origin: "" }, { origin: "https://attacker.example" }, { origin: "null" }, { "sec-fetch-site": "cross-site" },
  ])("rejects wrong origins %j", async headers => {
    const response = await route.handler(request(route, { headers }));
    expect(response.status).toBe(403);
    expect(boundary.service).not.toHaveBeenCalled();
  });
  it.each(["", `${origin}/`, "file:///tmp/config"])("fails closed for origin config %s", async config => {
    vi.stubEnv("APP_ORIGIN", config);
    expect((await route.handler(request(route))).status).toBe(503);
    expect(boundary.service).not.toHaveBeenCalled();
  });
  it.each([{ ownerSubject: "other-owner" }, { universityId }, { verified: true }])("rejects client-controlled authority %j", async extra => {
    const body = { email, ...(route.name === "consume" ? { code: "123456" } : {}), ...extra };
    expect((await route.handler(request(route, { body }))).status).toBe(400);
    expect(boundary.service).not.toHaveBeenCalled();
  });
  it.each([null, [], "text", { email: 42 }, { email: "" }, { email: "x".repeat(255) }])("rejects malformed body %j", async body => {
    const req = new Request(`${origin}/api/affiliation`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await route.handler(req)).status).toBe(400);
    expect(boundary.service).not.toHaveBeenCalled();
  });
  it("rejects content types and query options before service access", async () => {
    expect((await route.handler(request(route, { headers: { "content-type": "text/plain" } }))).status).toBe(415);
    expect((await route.handler(request(route, { query: "?owner=other" }))).status).toBe(400);
    expect(boundary.service).not.toHaveBeenCalled();
  });
  it.each([undefined, "1"])("counts actual streamed bytes despite declared length %s", async length => {
    const req = request(route, { body: { email: "x".repeat(5000) }, headers: length ? { "content-length": length } : {} });
    expect((await route.handler(req)).status).toBe(413);
    expect(boundary.service).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON without leaking input", async () => {
    const req = new Request(origin, { method: "POST", headers: { origin, "content-type": "application/json" }, body: '{"private-email"' });
    const response = await route.handler(req);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private-email");
  });
});
it.each(["abc123", "12345", "1234567", 123456, null])("rejects invalid code %s", async code => {
  expect((await consume(request(routes[2], { body: { email, code } }))).status).toBe(400);
  expect(boundary.consume).not.toHaveBeenCalled();
});
it.each(["?offset=-1", "?offset=1.1", "?offset=10001", "?offset=0&offset=1", "?principal=other"])("rejects list scope %s", async query => {
  expect((await list(request(routes[0], { query }))).status).toBe(400);
  expect(boundary.list).not.toHaveBeenCalled();
});
it("passes a bounded offset with only the trusted subject", async () => {
  expect((await list(request(routes[0], { query: "?offset=50" }))).status).toBe(200);
  expect(boundary.list).toHaveBeenCalledWith(owner, 50);
});
it.each([
  ["RATE_LIMITED", 429], ["SEND_FAILED", 503], ["ALREADY_VERIFIED", 409], ["UNKNOWN_DOMAIN", 400], ["INVALID_EMAIL", 400],
])("maps initiate result %s", async (error, status) => {
  boundary.initiate.mockResolvedValue({ ok: false, error });
  expect((await initiate(request(routes[1]))).status).toBe(status);
});
it.each(["INVALID_CODE", "NOT_PENDING"])("maps consume result %s without a success", async error => {
  boundary.consume.mockResolvedValue({ ok: false, error });
  const response = await consume(request(routes[2]));
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: { code: error } });
});

describe("global cleanup authentication", () => {
  function maintenance(header?: string, query = "") {
    return new Request(`${origin}/api/internal/affiliation-cleanup${query}`, { headers: header ? { authorization: header } : {} });
  }
  it.each([undefined, "Bearer wrong", "Basic offline-maintenance-secret-at-least-32-characters"])("rejects %s before opening database", async header => {
    expect((await cleanup(maintenance(header))).status).toBe(401);
    expect(boundary.db).not.toHaveBeenCalled();
    expect(boundary.cleanup).not.toHaveBeenCalled();
  });
  it.each(["", "short", "has spaces".repeat(8)])("fails closed with invalid configured secret", async secret => {
    vi.stubEnv("CRON_SECRET", secret);
    expect((await cleanup(maintenance())).status).toBe(503);
    expect(boundary.db).not.toHaveBeenCalled();
  });
  it("returns only the aggregate and does not consult a browser session", async () => {
    const response = await cleanup(maintenance(`Bearer ${process.env.CRON_SECRET}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 3 });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(boundary.getSession).not.toHaveBeenCalled();
  });
  it.each(["?recipient=any", "?cutoff=2099-01-01", "?token=secret"])("does not accept caller policy %s", async query => {
    expect((await cleanup(maintenance(`Bearer ${process.env.CRON_SECRET}`, query))).status).toBe(400);
    expect(boundary.cleanup).not.toHaveBeenCalled();
  });
  it("hides database diagnostics and HEAD cannot run cleanup", async () => {
    boundary.cleanup.mockRejectedValue(new Error("private-address@example.test"));
    const response = await cleanup(maintenance(`Bearer ${process.env.CRON_SECRET}`));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-address");
    boundary.cleanup.mockClear();
    expect(cleanupHead().status).toBe(405);
    expect(boundary.cleanup).not.toHaveBeenCalled();
  });
});
