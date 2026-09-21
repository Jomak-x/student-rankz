export type InitiateError =
  | "INVALID_EMAIL"
  | "UNKNOWN_DOMAIN"
  | "ALREADY_VERIFIED"
  | "RATE_LIMITED"
  | "SEND_FAILED";

export type ConsumeError =
  | "INVALID_EMAIL"
  | "UNKNOWN_DOMAIN"
  | "NOT_PENDING"
  | "INVALID_CODE"
  | "ALREADY_VERIFIED";

export type InitiateResult =
  | { ok: true; universityId: string }
  | { ok: false; error: InitiateError };

// accountSubject is intentionally absent from the success DTO — the caller
// supplied the principal and already knows it; including it risks inadvertent
// serialisation into a response body.
export type ConsumeResult =
  | { ok: true; universityId: string }
  | { ok: false; error: ConsumeError };

export type VerificationStatus = {
  verified: boolean;
  universityId: string;
  verifiedAt: Date | null;
};
