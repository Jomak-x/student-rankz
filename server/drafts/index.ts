// Server-side private review drafts service.
//
// Import from server code only (routes, server actions). The future route
// derives the owner subject from a verified managed-auth session and hands
// it to the service functions below; it must never read ownership from the
// request body.

export { DraftServiceError, isDraftServiceError } from "./errors";
export type { DraftServiceErrorCode } from "./errors";
export type {
  DraftDeleteResult,
  DraftDto,
  DraftListOptions,
  DraftListResult,
  DraftTargetType,
} from "./types";
export { DRAFT_TARGET_TYPES } from "./types";
export { DRAFT_LIMITS } from "./validate";
export type { DraftsDatabase } from "./service";
export {
  createReviewDraft,
  deleteReviewDraft,
  getReviewDraft,
  listReviewDrafts,
  updateReviewDraft,
} from "./service";
