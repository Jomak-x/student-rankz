import "server-only";

import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";
import { readAuthConfig } from "@/lib/auth/config";

export type VerifiedSession =
  | { status: "authenticated"; user: { id: string; name: string; email: string } }
  | { status: "anonymous" }
  | { status: "unavailable" };

/** No module-level configuration or network calls, and no mutable session singleton. */
export function getAuth(): NeonAuth | null {
  const config = readAuthConfig();
  if (!config) return null;
  try {
    return createNeonAuth(config);
  } catch {
    return null;
  }
}

export function getAuthAvailability(): boolean {
  return getAuth() !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Trust only the managed SDK's verified session, never client/localStorage identity.
 * SDK signed-cookie caching can delay revocation by 300 seconds. This read-only
 * identity check does not authorize affiliation, posting, or other sensitive writes.
 * Callers must independently enforce resource ownership, affiliation, and permissions.
 */
export async function getVerifiedSession(): Promise<VerifiedSession> {
  return verifySession(false);
}

/**
 * Revalidate with the provider before a write; never fall back to cached identity.
 * Use in a Route Handler or Server Action so the SDK can refresh response cookies.
 * Callers must still enforce ownership, affiliation, and operation permissions.
 */
export async function getVerifiedWriteSession(): Promise<VerifiedSession> {
  return verifySession(true);
}

async function verifySession(providerFresh: boolean): Promise<VerifiedSession> {
  const auth = getAuth();
  if (!auth) return { status: "unavailable" };

  try {
    // 0.5.0-beta checks the string "true" to skip its local signed-cookie cache,
    // then forwards the same query to the provider to bypass its cookie cache.
    // Boolean true does not bypass the local cache. Keep the SDK regression test.
    const { data, error } = providerFresh
      ? await auth.getSession({ query: { disableCookieCache: "true" } })
      : await auth.getSession();
    if (error) return { status: "unavailable" };
    if (!data) return { status: "anonymous" };

    // Validate runtime data too: upstream JSON dates are strings despite SDK Date types.
    const payload: unknown = data;
    if (!isRecord(payload) || !isRecord(payload.user) || !isRecord(payload.session)) {
      return { status: "anonymous" };
    }
    const { user, session } = payload;
    const expiry = session.expiresAt;
    const expiresAt = expiry instanceof Date
      ? expiry.getTime()
      : typeof expiry === "string" ? Date.parse(expiry) : NaN;
    if (
      !nonemptyString(user.id) ||
      !nonemptyString(user.name) ||
      !nonemptyString(user.email) ||
      !nonemptyString(session.id) ||
      session.userId !== user.id ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) return { status: "anonymous" };

    return {
      status: "authenticated",
      user: { id: user.id, name: user.name, email: user.email },
    };
  } catch {
    return { status: "unavailable" };
  }
}
