import "server-only";

import { getVerifiedWriteSession } from "@/lib/auth/server";
import { DRAFT_LIMITS, isDraftServiceError, type DraftListOptions } from "@/server/drafts";

export const MAX_DRAFT_BODY_BYTES = 64 * 1024;

const errors = {
  UNAUTHENTICATED: [401, "Sign in to access private drafts."],
  UNAVAILABLE: [503, "Private drafts are temporarily unavailable."],
  FORBIDDEN: [403, "Request origin is not allowed."],
  INVALID_INPUT: [400, "Invalid draft request."],
  INVALID_TARGET: [400, "Invalid draft target."],
  NOT_FOUND: [404, "Draft not found."],
  CONFLICT: [409, "Draft has changed. Reload and try again."],
  UNSUPPORTED_MEDIA_TYPE: [415, "A JSON request body is required."],
  PAYLOAD_TOO_LARGE: [413, "Request body is too large."],
} as const;

class RequestError extends Error {
  constructor(readonly code: keyof typeof errors) {
    super(code);
  }
}

function privateJson(value: unknown, status: number): Response {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** All private reads also bypass the provider's signed session-cookie cache. */
export async function draftResponse(
  request: Request,
  write: boolean,
  action: (owner: string) => Promise<unknown>,
  status = 200,
): Promise<Response> {
  try {
    const session = await getVerifiedWriteSession();
    if (session.status === "anonymous") throw new RequestError("UNAUTHENTICATED");
    if (session.status !== "authenticated") throw new RequestError("UNAVAILABLE");
    if (write) requireWriteOrigin(request);
    return privateJson(await action(session.user.id), status);
  } catch (error) {
    const code = error instanceof RequestError || isDraftServiceError(error)
      ? error.code
      : "UNAVAILABLE";
    const [status, message] = errors[code];
    // Never return or log provider, database, or service diagnostics/identity.
    return privateJson({ error: { code, message } }, status);
  }
}

function requireWriteOrigin(request: Request): void {
  const configured = process.env.APP_ORIGIN;
  if (!configured) throw new RequestError("UNAVAILABLE");
  try {
    const url = new URL(configured);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== configured) {
      throw new Error();
    }
  } catch {
    throw new RequestError("UNAVAILABLE");
  }
  // The deployment configuration is the only authority, never Host/forwarded headers.
  if (
    request.headers.get("origin") !== configured ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new RequestError("FORBIDDEN");
  }
}

/** Count actual streamed bytes, including when Content-Length is absent or dishonest. */
export async function readDraftJson(request: Request): Promise<unknown> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw new RequestError("UNSUPPORTED_MEDIA_TYPE");

  const length = request.headers.get("content-length");
  if (length !== null) {
    if (!/^[0-9]+$/.test(length)) throw new RequestError("INVALID_INPUT");
    if (Number(length) > MAX_DRAFT_BODY_BYTES) throw new RequestError("PAYLOAD_TOO_LARGE");
  }
  if (!request.body) throw new RequestError("INVALID_INPUT");

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_DRAFT_BODY_BYTES) {
        // Cancellation must not let an uncooperative sender delay the rejection.
        void reader.cancel().catch(() => {});
        throw new RequestError("PAYLOAD_TOO_LARGE");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof RequestError) throw error;
    void reader.cancel().catch(() => {});
    throw new RequestError("INVALID_INPUT");
  } finally {
    reader.releaseLock();
  }
}

export function readDraftListOptions(request: Request): DraftListOptions {
  const params = new URL(request.url).searchParams;
  const options: DraftListOptions = {};
  for (const key of params.keys()) {
    if (key !== "limit" && key !== "offset") throw new RequestError("INVALID_INPUT");
    const values = params.getAll(key);
    if (values.length !== 1 || !/^(0|[1-9][0-9]*)$/.test(values[0])) {
      throw new RequestError("INVALID_INPUT");
    }
    const value = Number(values[0]);
    if (!Number.isSafeInteger(value)) throw new RequestError("INVALID_INPUT");
    options[key] = value;
  }
  const limit = options.limit ?? DRAFT_LIMITS.listLimitDefault;
  if (
    limit < 1 || limit > DRAFT_LIMITS.listLimitMax ||
    (options.offset ?? 0) > Number.MAX_SAFE_INTEGER - limit
  ) throw new RequestError("INVALID_INPUT");
  return options;
}
