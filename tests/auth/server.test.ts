import type { createNeonAuth } from "@neondatabase/auth/next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type NeonAuth = ReturnType<typeof createNeonAuth>;
type GetSessionResponse = Awaited<ReturnType<NeonAuth["getSession"]>>;

const sdk = vi.hoisted(() => ({
  createNeonAuth: vi.fn(),
  getSession: vi.fn(),
  handlerGet: vi.fn(),
  handlerPost: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: sdk.createNeonAuth,
}));

import { readAuthConfig } from "@/lib/auth/config";
import {
  getAuth,
  getAuthAvailability,
  getVerifiedSession,
} from "@/lib/auth/server";
import { GET, POST } from "@/app/api/auth/[...path]/route";

const VALID_BASE_URL = "https://ep-auth-test.neon.tech";
const VALID_SECRET = "offline-test-secret-with-at-least-32-characters";

const validProviderSession = {
  data: {
    session: {
      id: "session-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      userId: "user-1",
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
      token: "provider-token-must-not-be-returned",
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: "user-1",
      name: "Ada Student",
      email: "ada@example.edu",
      emailVerified: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      image: null,
    },
  },
  error: null,
} satisfies GetSessionResponse;

function configureValidEnvironment() {
  vi.stubEnv("NEON_AUTH_BASE_URL", VALID_BASE_URL);
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", VALID_SECRET);
  vi.stubEnv("NEXT_PHASE", "");
}

function providerResult(data: unknown, error: unknown = null): GetSessionResponse {
  return { data, error } as GetSessionResponse;
}

function routeContext(path: string[] = ["get-session"]) {
  return { params: Promise.resolve({ path }) };
}

describe("lazy Neon Auth server configuration", () => {
  beforeEach(() => {
    configureValidEnvironment();
    sdk.createNeonAuth.mockReturnValue({
      getSession: sdk.getSession,
      handler: () => ({ GET: sdk.handlerGet, POST: sdk.handlerPost }),
    });
  });

  it("constructs the SDK from the installed declaration-compatible config", () => {
    expect(readAuthConfig()).toEqual({
      baseUrl: VALID_BASE_URL,
      cookies: {
        secret: VALID_SECRET,
        sessionDataTtl: 300,
        sameSite: "lax",
      },
      logLevel: "silent",
    });

    expect(getAuthAvailability()).toBe(true);
    expect(sdk.createNeonAuth).toHaveBeenCalledOnce();
    expect(sdk.createNeonAuth).toHaveBeenCalledWith(readAuthConfig());
  });

  it.each([
    ["missing base URL", "", VALID_SECRET],
    ["missing secret", VALID_BASE_URL, ""],
    ["short secret", VALID_BASE_URL, "too-short"],
    ["non-HTTPS endpoint", "http://ep-auth-test.neon.tech", VALID_SECRET],
    ["unmanaged hostname", "https://auth.example.com", VALID_SECRET],
    ["hostname suffix trick", "https://ep-auth-test.neon.tech.evil.example", VALID_SECRET],
    ["endpoint with credentials", "https://user:pass@ep-auth-test.neon.tech", VALID_SECRET],
    ["endpoint with port", "https://ep-auth-test.neon.tech:8443", VALID_SECRET],
    ["endpoint with query", "https://ep-auth-test.neon.tech?secret=1", VALID_SECRET],
    ["endpoint with fragment", "https://ep-auth-test.neon.tech#fragment", VALID_SECRET],
    ["endpoint with whitespace", " https://ep-auth-test.neon.tech", VALID_SECRET],
    ["endpoint with a raw newline", "https://ep-auth-test.neon.tech\n", VALID_SECRET],
    ["endpoint with a raw tab", "https://ep-auth-test.neon.tech\t", VALID_SECRET],
    ["endpoint with a backslash", "https:\\ep-auth-test.neon.tech", VALID_SECRET],
    ["malformed endpoint", "not a URL", VALID_SECRET],
  ])("fails closed for %s without constructing or calling the provider", (_label, baseUrl, secret) => {
    vi.stubEnv("NEON_AUTH_BASE_URL", baseUrl);
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", secret);

    expect(getAuth()).toBeNull();
    expect(sdk.createNeonAuth).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("normalizes provider endpoints with trailing slashes", () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", `${VALID_BASE_URL}///`);

    expect(readAuthConfig()?.baseUrl).toBe(VALID_BASE_URL);
    expect(getAuth()).not.toBeNull();
    expect(sdk.createNeonAuth).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: VALID_BASE_URL }),
    );
  });

  it("disables auth during the production build even when credentials exist", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");

    expect(readAuthConfig()).toBeNull();
    expect(getAuth()).toBeNull();
    expect(sdk.createNeonAuth).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed when SDK construction rejects the runtime config", () => {
    sdk.createNeonAuth.mockImplementation(() => {
      throw new Error("provider details must not escape");
    });

    expect(getAuth()).toBeNull();
    expect(getAuthAvailability()).toBe(false);
  });
});

describe("verified managed session", () => {
  beforeEach(() => {
    configureValidEnvironment();
    sdk.createNeonAuth.mockReturnValue({
      getSession: sdk.getSession,
      handler: () => ({ GET: sdk.handlerGet, POST: sdk.handlerPost }),
    });
  });

  it("returns unavailable without configuration and never calls the provider", async () => {
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "");

    await expect(getVerifiedSession()).resolves.toEqual({ status: "unavailable" });
    expect(sdk.createNeonAuth).not.toHaveBeenCalled();
    expect(sdk.getSession).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns anonymous when the provider has no active session", async () => {
    sdk.getSession.mockResolvedValue(providerResult(null));

    await expect(getVerifiedSession()).resolves.toEqual({ status: "anonymous" });
  });

  it.each([
    ["missing session", { user: validProviderSession.data.user }],
    ["missing user", { session: validProviderSession.data.session }],
    ["blank session id", {
      ...validProviderSession.data,
      session: { ...validProviderSession.data.session, id: " " },
    }],
    ["blank user id", {
      ...validProviderSession.data,
      user: { ...validProviderSession.data.user, id: " " },
    }],
    ["blank name", {
      ...validProviderSession.data,
      user: { ...validProviderSession.data.user, name: "" },
    }],
    ["blank email", {
      ...validProviderSession.data,
      user: { ...validProviderSession.data.user, email: " " },
    }],
    ["invalid expiry", {
      ...validProviderSession.data,
      session: { ...validProviderSession.data.session, expiresAt: "not-a-date" },
    }],
    ["expired Date", {
      ...validProviderSession.data,
      session: { ...validProviderSession.data.session, expiresAt: new Date("2020-01-01") },
    }],
    ["expired serialized date", {
      ...validProviderSession.data,
      session: { ...validProviderSession.data.session, expiresAt: "2020-01-01T00:00:00.000Z" },
    }],
    ["mismatched subject", {
      ...validProviderSession.data,
      session: { ...validProviderSession.data.session, userId: "different-user" },
    }],
  ])("rejects an invalid provider session: %s", async (_label, data) => {
    sdk.getSession.mockResolvedValue(providerResult(data));

    await expect(getVerifiedSession()).resolves.toEqual({ status: "anonymous" });
  });

  it("treats a provider error response as unavailable", async () => {
    sdk.getSession.mockResolvedValue(providerResult(null, {
      message: "upstream rejected the session",
      status: 503,
      statusText: "Unavailable",
      code: "INTERNAL_ERROR",
    }));

    await expect(getVerifiedSession()).resolves.toEqual({ status: "unavailable" });
  });

  it("treats a thrown provider failure as unavailable", async () => {
    sdk.getSession.mockRejectedValue(new Error("private provider failure"));

    await expect(getVerifiedSession()).resolves.toEqual({ status: "unavailable" });
  });

  it("returns only minimal identity for a valid session and never grants affiliation", async () => {
    const dataWithUntrustedClaims = {
      ...validProviderSession.data,
      user: {
        ...validProviderSession.data.user,
        affiliation: "verified-university",
        role: "admin",
      },
    };
    sdk.getSession.mockResolvedValue(providerResult(dataWithUntrustedClaims));

    const result = await getVerifiedSession();

    expect(result).toEqual({
      status: "authenticated",
      user: {
        id: "user-1",
        name: "Ada Student",
        email: "ada@example.edu",
      },
    });
    expect(result).not.toHaveProperty("user.affiliation");
    expect(result).not.toHaveProperty("user.role");
    expect(result).not.toHaveProperty("session");
    expect(result).not.toHaveProperty("token");
  });

  it("accepts an unexpired serialized provider expiry", async () => {
    sdk.getSession.mockResolvedValue(providerResult({
      ...validProviderSession.data,
      session: {
        ...validProviderSession.data.session,
        expiresAt: "2100-01-01T00:00:00.000Z",
      },
    }));

    await expect(getVerifiedSession()).resolves.toMatchObject({ status: "authenticated" });
  });
});

describe("catch-all auth route", () => {
  beforeEach(() => {
    configureValidEnvironment();
    sdk.createNeonAuth.mockReturnValue({
      getSession: sdk.getSession,
      handler: () => ({ GET: sdk.handlerGet, POST: sdk.handlerPost }),
    });
  });

  it.each([
    ["GET", GET],
    ["POST", POST],
  ] as const)("returns a private 503 for %s when auth is not configured", async (_method, route) => {
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "");
    const request = new Request("https://student-rankz.test/api/auth/get-session");

    const response = await route(request, routeContext());

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      error: { message: "Authentication is temporarily unavailable." },
    });
    expect(sdk.createNeonAuth).not.toHaveBeenCalled();
    expect(sdk.handlerGet).not.toHaveBeenCalled();
    expect(sdk.handlerPost).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", GET, sdk.handlerGet, 200],
    ["POST", POST, sdk.handlerPost, 201],
  ] as const)("forwards %s with the original request and context", async (
    _method,
    route,
    providerHandler,
    status,
  ) => {
    const upstream = new Response("provider response", {
      status,
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Set-Cookie": "neon-auth.session=test; HttpOnly; Secure",
        "X-Provider": "neon",
      },
    });
    providerHandler.mockResolvedValue(upstream);
    const request = new Request("https://student-rankz.test/api/auth/get-session", {
      method: _method,
    });
    const context = routeContext();

    const response = await route(request, context);

    expect(providerHandler).toHaveBeenCalledOnce();
    expect(providerHandler).toHaveBeenCalledWith(request, context);
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toContain("neon-auth.session=test");
    expect(response.headers.get("x-provider")).toBe("neon");
    await expect(response.text()).resolves.toBe("provider response");
  });

  it.each([
    ["empty path", []],
    ["absolute URL injection", ["https:", "evil.example"]],
    ["parent traversal", [".."]],
    ["encoded separator after decoding", ["sign-in/email"]],
  ])("rejects %s before dispatching to the SDK", async (_label, path) => {
    const response = await GET(
      new Request("https://student-rankz.test/api/auth/invalid"),
      routeContext(path),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(sdk.handlerGet).not.toHaveBeenCalled();
  });

  it("converts an upstream server response to a generic private 503", async () => {
    sdk.handlerGet.mockResolvedValue(Response.json(
      { secret: "provider diagnostics" },
      { status: 500, headers: { "X-Provider-Secret": "must-not-escape" } },
    ));

    const response = await GET(
      new Request("https://student-rankz.test/api/auth/get-session"),
      routeContext(),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.has("x-provider-secret")).toBe(false);
    expect(await response.text()).not.toContain("provider diagnostics");
  });

  it.each([
    ["GET", GET, sdk.handlerGet],
    ["POST", POST, sdk.handlerPost],
  ] as const)("fails closed when the %s provider handler throws", async (
    _method,
    route,
    providerHandler,
  ) => {
    providerHandler.mockRejectedValue(new Error("private provider failure"));

    const response = await route(
      new Request("https://student-rankz.test/api/auth/get-session", { method: _method }),
      routeContext(),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).not.toContain("private provider failure");
  });
});
