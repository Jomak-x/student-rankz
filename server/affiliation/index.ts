export { AffiliationService } from "./service.js";
export type { AffiliationServiceConfig } from "./service.js";
export type {
  ConsumeError,
  ConsumeResult,
  InitiateError,
  InitiateResult,
  VerificationStatus,
} from "./types.js";
export { MockTransport, FailingTransport } from "./email.js";
export type { EmailTransport } from "./email.js";
export { parseEmail, normalizeDomain } from "./domain.js";
