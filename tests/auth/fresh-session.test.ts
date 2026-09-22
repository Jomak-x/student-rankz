import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestContext = vi.hoisted(() => ({ headers: new Headers(), setCookie: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => requestContext.headers,
  cookies: async () => ({ set: requestContext.setCookie }),
}));

// Exercise the installed SDK, including its real local-cookie validation and query
// serialization. Only the request context and provider transport are mocked.
import { getVerifiedSession, getVerifiedWriteSession } from "@/lib/auth/server";

const BASE_URL = "https://ep-auth-test.neon.tech/neondb/auth";
const SECRET = "offline-test-secret-with-at-least-32-characters";
const providerSession = {
  session: {
    id: "session-1",
    userId: "user-1",
    token: "synthetic-provider-token",
    expiresAt: "2100-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  user: {
    id: "user-1",
    name: "Synthetic Student",
    email: "student@example.test",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};
const identity = { status: "authenticated", user: {
  id: "user-1", name: "Synthetic Student", email: "student@example.test",
} };

// Test-only HS256 cache fixture, signed with an explicitly synthetic secret. It is
// never injected into production code or sent to a live provider.
function signedCache() {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = encode({ ...providerSession, sub: "user-1", exp: Math.floor(Date.now() / 1000) + 300 });
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${payload}`;
  return `${unsigned}.${createHmac("sha256", SECRET).update(unsigned).digest("base64url")}`;
}

describe("provider-fresh write boundary with installed Neon SDK", () => {
  beforeEach(() => {
    vi.stubEnv("NEON_AUTH_BASE_URL", BASE_URL);
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", SECRET);
    vi.stubEnv("NEXT_PHASE", "");
    requestContext.headers = new Headers({
      cookie: `__Secure-neon-auth.session_token=synthetic-token; __Secure-neon-auth.local.session_data=${signedCache()}`,
      origin: "https://student-rankz.test",
    });
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockImplementation(() => { throw new Error("Unexpected provider request"); });
  });

  it("keeps cached reads but asks the provider to bypass its cache for every write check", async () => {
    await expect(getVerifiedSession()).resolves.toEqual(identity);
    expect(fetch).not.toHaveBeenCalled();

    vi.mocked(fetch).mockImplementation(async () => Response.json(providerSession));
    await expect(getVerifiedWriteSession()).resolves.toEqual(identity);
    await expect(getVerifiedWriteSession()).resolves.toEqual(identity);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(1, `${BASE_URL}/get-session?disableCookieCache=true`, {
      method: "GET",
      headers: expect.objectContaining({ Cookie: requestContext.headers.get("cookie") }),
      body: undefined,
    });
  });

  it("denies a revoked session even while its signed display cache is valid", async () => {
    await expect(getVerifiedSession()).resolves.toEqual(identity);
    vi.mocked(fetch).mockResolvedValue(Response.json(null));

    await expect(getVerifiedWriteSession()).resolves.toEqual({ status: "anonymous" });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing session", { user: providerSession.user }],
    ["missing user", { session: providerSession.session }],
    ["blank user id", { ...providerSession, user: { ...providerSession.user, id: " " } }],
    ["blank name", { ...providerSession, user: { ...providerSession.user, name: "" } }],
    ["blank email", { ...providerSession, user: { ...providerSession.user, email: " " } }],
    ["blank session id", { ...providerSession, session: { ...providerSession.session, id: "" } }],
    ["mismatched subject", { ...providerSession, session: { ...providerSession.session, userId: "other" } }],
    ["invalid expiry", { ...providerSession, session: { ...providerSession.session, expiresAt: "invalid" } }],
    ["expired session", { ...providerSession, session: { ...providerSession.session, expiresAt: "2020-01-01T00:00:00.000Z" } }],
    ["malformed payload", "invalid"],
  ])("denies %s despite a valid local cookie", async (_label, data) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(data));
    await expect(getVerifiedWriteSession()).resolves.toEqual({ status: "anonymous" });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([401, 403, 500, 503])("denies provider HTTP %s without falling back to cached identity", async (status) => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "private provider error" }, { status }));
    await expect(getVerifiedWriteSession()).resolves.toEqual({ status: "unavailable" });
  });

  it("denies a transport failure without falling back to cached identity", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
    await expect(getVerifiedWriteSession()).resolves.toEqual({ status: "unavailable" });
  });

  it("denies malformed provider JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("not JSON"));
    await expect(getVerifiedWriteSession()).resolves.toEqual({ status: "anonymous" });
  });

  it.each(["", "too-short"])("denies missing or invalid configuration (%s) without network access", async (secret) => {
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", secret);
    await expect(getVerifiedWriteSession()).resolves.toEqual({ status: "unavailable" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not turn provider claims into ownership or affiliation permissions", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({
      ...providerSession,
      user: { ...providerSession.user, role: "admin", affiliation: "verified-university" },
    }));
    await expect(getVerifiedWriteSession()).resolves.toEqual(identity);
  });
});
