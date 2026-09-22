import "server-only";
import { getVerifiedWriteSession } from "@/lib/auth/server";

const errors = {
  UNAUTHENTICATED: [401, "Sign in to manage university verification."],
  UNAVAILABLE: [503, "University verification is temporarily unavailable."],
  FORBIDDEN: [403, "Request origin is not allowed."],
  INVALID_INPUT: [400, "Invalid verification request."],
  INVALID_EMAIL: [400, "Enter a valid university email address."],
  UNKNOWN_DOMAIN: [400, "That university email domain is not supported."],
  ALREADY_VERIFIED: [409, "This university email is already verified."],
  RATE_LIMITED: [429, "Too many requests. Please try again later."],
  SEND_FAILED: [503, "We couldn't send a code. Please try again later."],
  NOT_PENDING: [400, "Request a new code before verifying."],
  INVALID_CODE: [400, "The code is invalid or expired. Try again or request a new code."],
  UNSUPPORTED_MEDIA_TYPE: [415, "A JSON request body is required."],
  PAYLOAD_TOO_LARGE: [413, "Request body is too large."],
} as const;

export class VerificationRequestError extends Error {
  constructor(readonly code: keyof typeof errors) { super(code); }
}
export function verificationJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function verificationResponse(request: Request, write: boolean, action: (principal: string) => Promise<unknown>) {
  try {
    const session = await getVerifiedWriteSession();
    if (session.status === "anonymous") throw new VerificationRequestError("UNAUTHENTICATED");
    if (session.status !== "authenticated") throw new VerificationRequestError("UNAVAILABLE");
    if (write) {
      const configured = process.env.APP_ORIGIN;
      let valid = false;
      try {
        const url = new URL(configured ?? "");
        valid = ["http:", "https:"].includes(url.protocol) && url.origin === configured;
      } catch { /* Configuration fails closed. */ }
      if (!valid) throw new VerificationRequestError("UNAVAILABLE");
      if (request.headers.get("origin") !== configured || request.headers.get("sec-fetch-site") === "cross-site") {
        throw new VerificationRequestError("FORBIDDEN");
      }
    }
    return verificationJson(await action(session.user.id));
  } catch (error) {
    const code = error instanceof VerificationRequestError ? error.code : "UNAVAILABLE";
    const [status, message] = errors[code];
    return verificationJson({ error: { code, message } }, status);
  }
}

export function requireNoQuery(request: Request) {
  if (new URL(request.url).search) throw new VerificationRequestError("INVALID_INPUT");
}

export function verificationOffset(request: Request) {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => key !== "offset") || params.getAll("offset").length > 1) throw new VerificationRequestError("INVALID_INPUT");
  const raw = params.get("offset") ?? "0";
  if (!/^(0|[1-9][0-9]*)$/.test(raw) || Number(raw) > 10000) throw new VerificationRequestError("INVALID_INPUT");
  return Number(raw);
}

export async function verificationBody(request: Request, consume: boolean) {
  requireNoQuery(request);
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new VerificationRequestError("UNSUPPORTED_MEDIA_TYPE");
  }
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 4096)) {
    throw new VerificationRequestError(Number(length) > 4096 ? "PAYLOAD_TOO_LARGE" : "INVALID_INPUT");
  }
  if (!request.body) throw new VerificationRequestError("INVALID_INPUT");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  let value: unknown;
  try {
    while (true) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      bytes += chunk.byteLength;
      if (bytes > 4096) throw new VerificationRequestError("PAYLOAD_TOO_LARGE");
      text += decoder.decode(chunk, { stream: true });
    }
    value = JSON.parse(text + decoder.decode());
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof VerificationRequestError) throw error;
    throw new VerificationRequestError("INVALID_INPUT");
  } finally { reader.releaseLock(); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new VerificationRequestError("INVALID_INPUT");
  const data = value as Record<string, unknown>;
  const allowed = consume ? ["email", "code"] : ["email"];
  if (Object.keys(data).some(key => !allowed.includes(key))) throw new VerificationRequestError("INVALID_INPUT");
  if (typeof data.email !== "string" || !data.email.trim() || data.email.length > 254) throw new VerificationRequestError("INVALID_EMAIL");
  if (consume && (typeof data.code !== "string" || !/^\d{6}$/.test(data.code))) throw new VerificationRequestError("INVALID_CODE");
  return { email: data.email.trim(), code: consume ? data.code as string : "" };
}
