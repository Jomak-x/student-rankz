// Typed, privacy-safe error surface for the catalog read service.
//
// The service never leaks internal errors to callers: connection failures,
// driver errors and configuration problems are normalised into
// CatalogUnavailableError with a generic message. The original error travels
// only in `cause` for server-side logging; the final UI integration renders
// `reason`-based states and must not surface `cause` text to users.

export type CatalogUnavailableReason =
  | "database-not-configured"
  | "database-unreachable";

const REASON_MESSAGES: Record<CatalogUnavailableReason, string> = {
  "database-not-configured":
    "The catalog database is not configured. Set DATABASE_URL to enable database-backed catalog reads.",
  "database-unreachable":
    "The catalog database is currently unavailable. Please try again later.",
};

export class CatalogUnavailableError extends Error {
  readonly reason: CatalogUnavailableReason;

  constructor(reason: CatalogUnavailableReason, cause?: unknown) {
    super(REASON_MESSAGES[reason], cause === undefined ? undefined : { cause });
    this.name = "CatalogUnavailableError";
    this.reason = reason;
  }
}

export function isCatalogUnavailableError(
  error: unknown,
): error is CatalogUnavailableError {
  return error instanceof CatalogUnavailableError;
}
