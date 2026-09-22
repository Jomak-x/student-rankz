export { AffiliationService } from "./service";
export type { AffiliationServiceConfig } from "./service";
export type {
  ConsumeError,
  ConsumeResult,
  InitiateError,
  InitiateResult,
  VerificationStatus,
} from "./types";
export { MockTransport, FailingTransport } from "./email";
export type { EmailTransport } from "./email";
export { parseEmail, normalizeDomain } from "./domain";
