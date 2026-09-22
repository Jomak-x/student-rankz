// Domain normalization and validation for university affiliation.
//
// Only exact domain matches are ever used — suffix matching is explicitly
// forbidden.  Input is normalized to a lowercase WHATWG-URL hostname so
// internationalised domains (IDN / punycode) round-trip safely.
//
// The raw domain string is pre-validated before being handed to the URL
// constructor.  This prevents the parser from silently stripping ports,
// paths, fragments, and percent-encoded sequences that would cause an
// attacker-controlled hostname to appear to match a legitimate registry entry.

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
  // Basic shape guard: exactly one @, no whitespace.
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
 * Returns null for:
 *   - IP addresses (v4 or v6)
 *   - Bare labels (no dot)
 *   - Inputs containing URL-special characters (`:`, `/`, `@`, `#`, `?`, `%`)
 *   - Inputs containing control characters
 *   - Inputs where the URL parser resolves extra components (port, path, …)
 *   - Labels that start or end with a hyphen (RFC 1123 / RFC 5891)
 *   - Overlong inputs
 */
export function normalizeDomain(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 253) return null;

  // Reject control characters (\x00-\x1F and DEL).
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null;

  // Reject characters that are special in URLs and that the WHATWG URL parser
  // would silently consume rather than reject:
  //   :  → stripped port (e.g. "evil.com:443" → hostname "evil.com")
  //   /  → path separator
  //   \  → treated as / in special schemes (backslash normalization)
  //   @  → userinfo separator
  //   #  → fragment
  //   ?  → query string
  //   %  → percent-encoded sequences (e.g. "%40" → "@")
  //   _  → not valid in DNS hostnames (RFC 952); DB CHECK also rejects
  if (/[:/@#?%\\_]/.test(trimmed)) return null;

  let url: URL;
  try {
    // WHATWG URL handles punycode / IDN encoding, normalises case, and rejects
    // structurally invalid hostnames.
    url = new URL(`https://${trimmed}`);
  } catch {
    return null;
  }

  // Belt-and-suspenders: reject if the parser resolved any URL component
  // beyond the authority (hostname).  port is '' for the scheme default (443)
  // but the ':' pre-check above already blocks port-containing inputs.
  if (
    url.port !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/"
  )
    return null;

  const hostname = url.hostname;
  if (!hostname) return null;

  // Reject bare labels (no dot → no TLD).
  if (!hostname.includes(".")) return null;

  // Reject IPv4 addresses (pure-numeric labels).
  if (/^\d+(\.\d+){3}$/.test(hostname)) return null;

  // Reject IPv6 literals (URL parser brackets them).
  if (hostname.startsWith("[")) return null;

  // Reject labels that start or end with a hyphen (RFC 1123 § 2.1).
  const labels = hostname.split(".");
  for (const label of labels) {
    if (!label || label.startsWith("-") || label.endsWith("-")) return null;
  }

  return hostname;
}
