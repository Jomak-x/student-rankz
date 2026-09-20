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
  const auth = getAuth();
  if (!auth) return { status: "unavailable" };

  try {
    const { data, error } = await auth.getSession();
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
