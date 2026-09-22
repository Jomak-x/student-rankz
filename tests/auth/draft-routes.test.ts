import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  createNeonAuth: vi.fn(),
  getSession: vi.fn(),
  getDb: vi.fn(),
  createReviewDraft: vi.fn(),
  listReviewDrafts: vi.fn(),
  getReviewDraft: vi.fn(),
  updateReviewDraft: vi.fn(),
  deleteReviewDraft: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/auth/next/server", () => ({ createNeonAuth: boundary.createNeonAuth }));
vi.mock("@/server/db", () => ({ getDb: boundary.getDb }));
vi.mock("@/server/drafts", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/server/drafts")>(),
  createReviewDraft: boundary.createReviewDraft,
  listReviewDrafts: boundary.listReviewDrafts,
  getReviewDraft: boundary.getReviewDraft,
  updateReviewDraft: boundary.updateReviewDraft,
  deleteReviewDraft: boundary.deleteReviewDraft,
}));

import { GET as list, POST } from "@/app/api/drafts/route";
import { GET as get, PATCH, DELETE } from "@/app/api/drafts/[id]/route";
import { DraftServiceError } from "@/server/drafts";
import * as realService from "@/server/drafts/service";
import { MAX_DRAFT_BODY_BYTES } from "@/server/http/draft-request";

const origin = "https://student-rankz.test";
const id = "00000000-0000-4000-8000-000000000001";
const owner = "private-provider-subject";
const secret = "private-token-and-diagnostics";
const db = { insert: vi.fn(), select: vi.fn(), update: vi.fn(), delete: vi.fn() };
const input = {
  universityId: "00000000-0000-4000-8000-000000000002",
  targetType: "university", body: "Private draft", rating: 4, clientRequestKey: "request-1",
};
const update = { body: "Revised private draft", revision: 1 };
const dto = {
  id, universityId: input.universityId, targetType: "university", courseId: null,
  instructorId: null, title: null, body: input.body, rating: 4, revision: 1,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};
const page = { items: [dto], hasMore: true, nextOffset: 20 };
const session = {
  user: { id: owner, name: "Private Name", email: "private@example.test" },
  session: { id: "session", userId: owner, token: secret, expiresAt: "2100-01-01T00:00:00Z" },
};
const context = () => ({ params: Promise.resolve({ id }) });
const routes = [
  { name: "list", method: "GET", run: list, service: boundary.listReviewDrafts, payload: undefined, args: [db, owner, {}], result: page, status: 200 },
  { name: "get", method: "GET", run: (req: Request) => get(req, context()), service: boundary.getReviewDraft, payload: undefined, args: [db, owner, id], result: dto, status: 200 },
  { name: "create", method: "POST", run: POST, service: boundary.createReviewDraft, payload: input, args: [db, owner, input], result: dto, status: 201 },
  { name: "update", method: "PATCH", run: (req: Request) => PATCH(req, context()), service: boundary.updateReviewDraft, payload: update, args: [db, owner, id, update], result: dto, status: 200 },
  { name: "delete", method: "DELETE", run: (req: Request) => DELETE(req, context()), service: boundary.deleteReviewDraft, payload: undefined, args: [db, owner, id], result: { id }, status: 200 },
];
const writes = routes.filter((route) => route.method !== "GET");
const bodyWrites = writes.filter((route) => route.payload !== undefined);

function request(route: typeof routes[number], overrides: RequestInit = {}): Request {
  return new Request(`${origin}/api/drafts/${id}`, {
    method: route.method,
    headers: { origin, "content-type": "application/json", "sec-fetch-site": "same-origin" },
    ...(route.payload ? { body: JSON.stringify(route.payload) } : {}),
    ...overrides,
  });
}

async function errorResponse(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const payload = await response.json();
  expect(payload).toEqual({ error: { code, message: expect.any(String) } });
  expect(JSON.stringify(payload)).not.toContain(owner);
  expect(JSON.stringify(payload)).not.toContain(secret);
  return payload;
}

beforeEach(() => {
  Object.values(boundary).forEach((mock) => mock.mockReset());
  Object.values(db).forEach((mock) => mock.mockReset());
  vi.stubEnv("NEON_AUTH_BASE_URL", "https://ep-auth-test.neon.tech");
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "offline-secret-at-least-32-characters");
  vi.stubEnv("NEXT_PHASE", "");
  vi.stubEnv("APP_ORIGIN", origin);
  boundary.createNeonAuth.mockReturnValue({ getSession: boundary.getSession });
  boundary.getSession.mockResolvedValue({ data: session, error: null });
  boundary.getDb.mockReturnValue(db);
  for (const route of routes) route.service.mockResolvedValue(route.result);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  expect(console.error).not.toHaveBeenCalled();
  expect(console.warn).not.toHaveBeenCalled();
  expect(console.log).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

describe.each(routes)("private draft $name", (route) => {
  it("dispatches only the fresh provider owner and returns the service DTO directly", async () => {
    const response = await route.run(request(route));
    expect(response.status).toBe(route.status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(route.result);
    expect(boundary.getSession).toHaveBeenCalledExactlyOnceWith({ query: { disableCookieCache: "true" } });
    expect(route.service).toHaveBeenCalledExactlyOnceWith(...route.args);
  });

  it.each([
    ["anonymous/revoked", null, null, 401, "UNAUTHENTICATED"],
    ["expired", { ...session, session: { ...session.session, expiresAt: "2020-01-01" } }, null, 401, "UNAUTHENTICATED"],
    ["subject mismatch", { ...session, session: { ...session.session, userId: "other" } }, null, 401, "UNAUTHENTICATED"],
    ["denied provider", session, { message: secret }, 503, "UNAVAILABLE"],
  ])("denies %s before accessing the database/service", async (_label, data, error, status, code) => {
    boundary.getSession.mockResolvedValue({ data, error });
    await errorResponse(await route.run(request(route)), status as number, code as string);
    expect(boundary.getSession).toHaveBeenCalledExactlyOnceWith({ query: { disableCookieCache: "true" } });
    expect(boundary.getDb).not.toHaveBeenCalled();
    expect(route.service).not.toHaveBeenCalled();
  });

  it("fails closed without auth configuration", async () => {
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "");
    await errorResponse(await route.run(request(route)), 503, "UNAVAILABLE");
    expect(boundary.getSession).not.toHaveBeenCalled();
    expect(boundary.getDb).not.toHaveBeenCalled();
  });

  it("revalidates each request and denies a subsequently revoked session", async () => {
    expect((await route.run(request(route))).status).toBe(route.status);
    boundary.getSession.mockResolvedValue({ data: null, error: null });
    await errorResponse(await route.run(request(route)), 401, "UNAUTHENTICATED");
    expect(boundary.getSession).toHaveBeenCalledTimes(2);
    expect(boundary.getSession).toHaveBeenLastCalledWith({ query: { disableCookieCache: "true" } });
    expect(route.service).toHaveBeenCalledOnce();
  });

  it.each(["provider", "database", "service"])("redacts a thrown %s failure", async (source) => {
    if (source === "provider") boundary.getSession.mockRejectedValue(new Error(secret));
    if (source === "database") boundary.getDb.mockImplementation(() => { throw new Error(secret); });
    if (source === "service") route.service.mockRejectedValue(new Error(secret));
    await errorResponse(await route.run(request(route)), 503, "UNAVAILABLE");
  });

  it.each([
    ["UNAUTHENTICATED", 401], ["INVALID_INPUT", 400], ["INVALID_TARGET", 400],
    ["NOT_FOUND", 404], ["CONFLICT", 409],
  ] as const)("maps %s without exposing service diagnostics", async (code, status) => {
    route.service.mockRejectedValue(new DraftServiceError(code, secret, { field: owner, cause: new Error(secret) }));
    await errorResponse(await route.run(request(route)), status, code);
  });
});

describe.each(writes)("write origin protection: $name", (route) => {
  it.each([
    ["missing", undefined], ["cross origin", "https://evil.test"], ["null", "null"],
    ["suffix trick", `${origin}.evil.test`], ["different port", `${origin}:444`],
    ["trailing slash", `${origin}/`], ["different case", "https://STUDENT-RANKZ.test"],
    ["multiple origins", `${origin}, https://evil.test`],
  ])("rejects %s Origin even with spoofed host/forwarded headers", async (_label, supplied) => {
    const headers = new Headers({
      "content-type": "application/json", host: "evil.test", "x-forwarded-host": "evil.test",
      "x-forwarded-proto": "https", forwarded: "host=evil.test;proto=https",
    });
    if (supplied !== undefined) headers.set("origin", supplied);
    await errorResponse(await route.run(request(route, { headers })), 403, "FORBIDDEN");
    expect(boundary.getDb).not.toHaveBeenCalled();
    expect(route.service).not.toHaveBeenCalled();
  });

  it("rejects cross-site fetch metadata even with matching Origin", async () => {
    await errorResponse(await route.run(request(route, {
      headers: { origin, "content-type": "application/json", "sec-fetch-site": "cross-site" },
    })), 403, "FORBIDDEN");
    expect(route.service).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "null", `${origin}/`, `${origin}/path`, `${origin}?a=1`, "https://user:pass@student-rankz.test", "ftp://student-rankz.test", ` ${origin}`])(
    "fails closed for absent/invalid APP_ORIGIN %s", async (configured) => {
      vi.stubEnv("APP_ORIGIN", configured);
      await errorResponse(await route.run(request(route)), 503, "UNAVAILABLE");
      expect(route.service).not.toHaveBeenCalled();
    },
  );

  it("uses configured Origin independently of request URL and forwarding headers", async () => {
    const req = request(route, { headers: { origin, "content-type": "application/json", host: "internal.test", "x-forwarded-host": "evil.test" } });
    const response = await route.run(new Request("https://internal.test/api/drafts", req));
    expect(response.status).toBe(route.status);
    expect(route.service).toHaveBeenCalledOnce();
  });
});

describe.each(bodyWrites)("JSON protection: $name", (route) => {
  it.each(["text/plain", "application/x-www-form-urlencoded", "application/jsonp", ""])("rejects content type %s", async (type) => {
    await errorResponse(await route.run(request(route, { headers: { origin, "content-type": type } })), 415, "UNSUPPORTED_MEDIA_TYPE");
    expect(route.service).not.toHaveBeenCalled();
  });

  it.each(["", "{", '{"body":NaN}', '{"body":"bad"} trailing'])("rejects malformed JSON %s", async (body) => {
    await errorResponse(await route.run(request(route, { body })), 400, "INVALID_INPUT");
    expect(boundary.getDb).not.toHaveBeenCalled();
  });

  it("rejects oversized declared length before reading the body", async () => {
    await errorResponse(await route.run(request(route, {
      headers: { origin, "content-type": "application/json", "content-length": String(MAX_DRAFT_BODY_BYTES + 1) },
    })), 413, "PAYLOAD_TOO_LARGE");
    expect(route.service).not.toHaveBeenCalled();
  });

  it.each(["-1", "1.5", "NaN"])("rejects invalid Content-Length %s", async (length) => {
    await errorResponse(await route.run(request(route, {
      headers: { origin, "content-type": "application/json", "content-length": length },
    })), 400, "INVALID_INPUT");
    expect(route.service).not.toHaveBeenCalled();
  });

  it("cancels an oversized stream without waiting for the sender to finish", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_DRAFT_BODY_BYTES));
        controller.enqueue(new Uint8Array(1));
        // Deliberately never close: the byte bound must end the read.
      },
      cancel,
    });
    await errorResponse(await route.run(request(route, {
      body, duplex: "half",
    } as RequestInit)), 413, "PAYLOAD_TOO_LARGE");
    expect(cancel).toHaveBeenCalledOnce();
    expect(boundary.getDb).not.toHaveBeenCalled();
  });

  it("rejects invalid UTF-8 without passing replacement characters to the service", async () => {
    await errorResponse(await route.run(request(route, {
      body: new Uint8Array([0x22, 0xff, 0x22]),
    })), 400, "INVALID_INPUT");
    expect(route.service).not.toHaveBeenCalled();
  });

  it.each([undefined, "1"])("bounds actual UTF-8 bytes with content-length %s", async (length) => {
    const headers = new Headers({ origin, "content-type": "application/json" });
    if (length) headers.set("content-length", length);
    await errorResponse(await route.run(request(route, { headers, body: JSON.stringify({ body: "é".repeat(MAX_DRAFT_BODY_BYTES / 2) }) })), 413, "PAYLOAD_TOO_LARGE");
    expect(route.service).not.toHaveBeenCalled();
  });

  it("accepts JSON with a charset parameter", async () => {
    const response = await route.run(request(route, { headers: { origin, "content-type": "application/json; charset=utf-8" } }));
    expect(response.status).toBe(route.status);
  });

  it.each(["ownerSubject", "userId", "status", "published"])("passes injected %s to strict service validation without adopting it", async (field) => {
    route.service.mockImplementation(route.method === "POST" ? realService.createReviewDraft : realService.updateReviewDraft);
    const injected = { ...route.payload, [field]: secret };
    await errorResponse(await route.run(request(route, { body: JSON.stringify(injected) })), 400, "INVALID_INPUT");
    expect(route.service.mock.calls[0][1]).toBe(owner);
    expect(route.service.mock.calls[0].at(-1)).toEqual(injected);
    Object.values(db).forEach((mock) => expect(mock).not.toHaveBeenCalled());
  });

  it.each([null, [], "string", 1, {}])("leaves payload-shape validation to the service: %j", async (payload) => {
    route.service.mockImplementation(route.method === "POST" ? realService.createReviewDraft : realService.updateReviewDraft);
    await errorResponse(await route.run(request(route, { body: JSON.stringify(payload) })), 400, "INVALID_INPUT");
    Object.values(db).forEach((mock) => expect(mock).not.toHaveBeenCalled());
  });
});

it("leaves malformed draft IDs to service validation", async () => {
  boundary.getReviewDraft.mockImplementation(realService.getReviewDraft);
  await errorResponse(await get(new Request(`${origin}/api/drafts/invalid`), {
    params: Promise.resolve({ id: "invalid" }),
  }), 400, "INVALID_INPUT");
  expect(boundary.getReviewDraft).toHaveBeenCalledExactlyOnceWith(db, owner, "invalid");
  expect(db.select).not.toHaveBeenCalled();
});

describe("list pagination", () => {
  it.each(["limit=", "limit=0", "limit=51", "limit=1.5", "limit=1e1", "limit=+1", "limit=01", "limit=1x", "limit=1&limit=2", "offset=-1", "offset=1.5", "offset=", "offset=9007199254740992", "offset=9007199254740991", "offset=0&offset=1", "ownerSubject=other"])("rejects %s", async (query) => {
    await errorResponse(await list(new Request(`${origin}/api/drafts?${query}`)), 400, "INVALID_INPUT");
    expect(boundary.listReviewDrafts).not.toHaveBeenCalled();
    expect(boundary.getDb).not.toHaveBeenCalled();
  });

  it("passes valid pagination directly and does not require APP_ORIGIN for private reads", async () => {
    vi.stubEnv("APP_ORIGIN", "");
    const response = await list(new Request(`${origin}/api/drafts?limit=50&offset=10`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(boundary.listReviewDrafts).toHaveBeenCalledExactlyOnceWith(db, owner, { limit: 50, offset: 10 });
  });
});
