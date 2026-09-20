// Error contract of the drafts service. Routes map these codes onto HTTP
// semantics; the service itself never touches request/response objects.

export type DraftServiceErrorCode =
  // No usable principal was supplied (anonymous or malformed subject).
  | "UNAUTHENTICATED"
  // Payload failed strict field/length/rating validation.
  | "INVALID_INPUT"
  // Target entity missing or belongs to a different university.
  | "INVALID_TARGET"
  // Draft does not exist or is owned by someone else (indistinguishable).
  | "NOT_FOUND"
  // Update rejected: the caller's revision is stale (delete or a newer
  // update won).
  | "CONFLICT";

export class DraftServiceError extends Error {
  readonly code: DraftServiceErrorCode;
  readonly field?: string;

  constructor(
    code: DraftServiceErrorCode,
    message: string,
    options?: { field?: string; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DraftServiceError";
    this.code = code;
    if (options?.field !== undefined) {
      this.field = options.field;
    }
  }
}

export function isDraftServiceError(error: unknown): error is DraftServiceError {
  return error instanceof DraftServiceError;
}
