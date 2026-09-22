const DEFAULT_REDIRECT = "/account";
const LOCAL_ORIGIN = "https://local.invalid";

function unsafe(value: string): boolean {
  return !value.startsWith("/") || value.startsWith("//") || value.includes("\\") ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

/** Only local absolute paths; reject encoded browser/path normalization tricks. */
export function safeRedirect(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || unsafe(value)) return DEFAULT_REDIRECT;
  try {
    let decoded = value;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (unsafe(decoded)) return DEFAULT_REDIRECT;
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      if (attempt === 4) return DEFAULT_REDIRECT;
      decoded = next;
    }
    const decodedUrl = new URL(decoded, LOCAL_ORIGIN);
    const url = new URL(value, LOCAL_ORIGIN);
    if (decodedUrl.origin !== LOCAL_ORIGIN || unsafe(decodedUrl.pathname) ||
      url.origin !== LOCAL_ORIGIN || unsafe(url.pathname)) return DEFAULT_REDIRECT;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_REDIRECT;
  }
}
