// Domain normalization and validation for university affiliation.
//
// Only exact domain matches are ever used — suffix matching is explicitly
// forbidden.  Input is normalized to a lowercase WHATWG-URL hostname so
// internationalised domains (IDN / punycode) round-trip safely.

const EMAIL_SHAPE_RE = /^[^\s@]+@[^\s@]+$/;

export type ParsedEmail = {
  localPart: string;
  /** Normalized lowercase hostname suitable for DB lookup. */
  domain: string;
};

/**
 * Normalize and structurally validate an email address.
 * Returns null for malformed addresses, IP literals, and bare labels.
 * Does NOT check MX records or deliverability.
 */
export function parseEmail(email: string): ParsedEmail | null {
  const trimmed = email.trim();
  // Basic shape guard: exactly one @, nothing obviously wrong.
  if (!EMAIL_SHAPE_RE.test(trimmed)) return null;

  const atIndex = trimmed.lastIndexOf("@");
  const localPart = trimmed.slice(0, atIndex);
  const rawDomain = trimmed.slice(atIndex + 1);

  if (!localPart) return null;

  const domain = normalizeDomain(rawDomain);
  if (!domain) return null;

  return { localPart, domain };
}

/**
 * Normalize a raw hostname to lowercase WHATWG URL form.
 * Returns null for IP addresses, bare labels, overlong inputs, and anything
 * the URL parser rejects.
 */
export function normalizeDomain(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 253) return null;

  let hostname: string;
  try {
    // The WHATWG URL constructor handles punycode / IDN encoding, rejects
    // invalid hostnames, and lowercases ASCII.
    hostname = new URL(`https://${trimmed}`).hostname;
  } catch {
    return null;
  }

  if (!hostname) return null;

  // Reject bare labels (no dot → no university TLD),
  // IPv4, and IPv6 literals (URL parser brackets them).
  if (!hostname.includes(".")) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;
  if (hostname.startsWith("[")) return null;

  return hostname;
}
