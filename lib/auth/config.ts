import "server-only";

import type { createNeonAuth } from "@neondatabase/auth/next/server";

type AuthConfig = Parameters<typeof createNeonAuth>[0];

/** Read at request time: the public demo needs no credentials, even at build time. */
export function readAuthConfig(): AuthConfig | null {
  // This guard also prevents accidental provider requests when build hosts have secrets.
  if (process.env.NEXT_PHASE === "phase-production-build") return null;

  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret || secret.trim().length < 32) return null;

  try {
    const url = new URL(baseUrl);
    if (
      baseUrl !== baseUrl.trim() ||
      baseUrl.includes("\\") ||
      Array.from(baseUrl).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".neon.tech") ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) return null;

    return {
      baseUrl: url.toString().replace(/\/+$/, ""),
      cookies: { secret, sessionDataTtl: 300, sameSite: "lax" },
      // Provider errors may carry sensitive request details. Never print them.
      logLevel: "silent",
    };
  } catch {
    return null;
  }
}
