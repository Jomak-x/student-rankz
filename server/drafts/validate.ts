// Strict payload validation for the drafts service.
//
// The service is the single validation boundary: future routes can hand raw
// parsed JSON straight in. Parsing is strict —
//
//   * only known keys are accepted (a client body cannot smuggle ownership,
//     identity, timestamps or publication state into the service: there is
//     no such field, and unknown keys are rejected outright),
//   * lengths and rating bounds mirror the database constraints exactly,
//   * UUIDs and pagination arguments are shape-checked before any query.

import { DRAFT_TARGET_TYPES, type DraftListOptions, type DraftTargetType } from "./types";
import { DraftServiceError } from "./errors";

export const DRAFT_LIMITS = {
  ownerSubjectMax: 255,
  clientRequestKeyMax: 100,
  titleMax: 140,
  bodyMax: 5000,
  ratingMin: 1,
  ratingMax: 5,
  listLimitDefault: 20,
  listLimitMax: 50,
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function invalid(field: string, message: string): DraftServiceError {
  return new DraftServiceError("INVALID_INPUT", message, { field });
}

function requirePlainObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalid(field, "Expected a JSON object.");
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(
  payload: Record<string, unknown>,
  known: readonly string[],
): void {
  for (const key of Object.keys(payload)) {
    if (!known.includes(key)) {
      throw invalid(key, `Unknown field "${key}" is not accepted.`);
    }
  }
}

function optionalString(
  payload: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = payload[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw invalid(field, `Field "${field}" must be a string.`);
  }
  return value;
}

/**
 * Validates the caller principal. The subject is produced server-side by the
 * future route from a verified managed-auth session — it is never part of a
 * client payload. An empty, blank, oversized or non-string subject is treated
 * as anonymous and rejected: no query is ever run with an empty principal.
 */
export function parseOwnerSubject(value: unknown): string {
  if (typeof value !== "string") {
    throw new DraftServiceError(
      "UNAUTHENTICATED",
      "An authenticated owner subject is required.",
    );
  }
  const subject = value.trim();
  if (
    subject.length === 0 ||
    subject.length > DRAFT_LIMITS.ownerSubjectMax
  ) {
    throw new DraftServiceError(
      "UNAUTHENTICATED",
      "An authenticated owner subject is required.",
    );
  }
  return subject;
}

export function parseDraftId(value: unknown): string {
  if (typeof value !== "string" || !isUuid(value)) {
    throw invalid("draftId", "Draft id must be a UUID.");
  }
  return value;
}

export type ParsedCreateInput = {
  universityId: string;
  targetType: DraftTargetType;
  /** Course/instructor UUID for course/instructor drafts, else null. */
  targetId: string | null;
  title: string | null;
  body: string;
  rating: number;
  clientRequestKey: string;
};

export function parseCreateInput(value: unknown): ParsedCreateInput {
  const payload = requirePlainObject(value, "body");
  rejectUnknownKeys(payload, [
    "universityId",
    "targetType",
    "targetId",
    "title",
    "body",
    "rating",
    "clientRequestKey",
  ]);

  const universityId = optionalString(payload, "universityId");
  if (universityId === undefined || !isUuid(universityId)) {
    throw invalid("universityId", 'Field "universityId" must be a UUID.');
  }

  const rawTargetType = payload["targetType"];
  if (
    typeof rawTargetType !== "string" ||
    !DRAFT_TARGET_TYPES.includes(rawTargetType as DraftTargetType)
  ) {
    throw invalid(
      "targetType",
      'Field "targetType" must be one of: university, course, instructor.',
    );
  }
  const targetType = rawTargetType as DraftTargetType;

  let targetId = optionalString(payload, "targetId") ?? null;
  if (targetId !== null && !isUuid(targetId)) {
    throw invalid("targetId", 'Field "targetId" must be a UUID.');
  }

  if (targetType === "university") {
    // The university is its own target; a provided targetId must agree.
    if (targetId !== null && targetId !== universityId) {
      throw invalid(
        "targetId",
        'Field "targetId" must match "universityId" for university drafts.',
      );
    }
    targetId = null;
  } else if (targetId === null) {
    throw invalid(
      "targetId",
      `Field "targetId" is required for ${targetType} drafts.`,
    );
  }

  let title = optionalString(payload, "title") ?? null;
  if (title !== null) {
    title = title.trim();
    if (title.length === 0) {
      title = null;
    } else if (title.length > DRAFT_LIMITS.titleMax) {
      throw invalid(
        "title",
        `Field "title" must be at most ${DRAFT_LIMITS.titleMax} characters.`,
      );
    }
  }

  const rawBody = optionalString(payload, "body");
  if (rawBody === undefined) {
    throw invalid("body", 'Field "body" is required.');
  }
  const body = rawBody.trim();
  if (body.length === 0) {
    throw invalid("body", 'Field "body" must not be empty.');
  }
  if (body.length > DRAFT_LIMITS.bodyMax) {
    throw invalid(
      "body",
      `Field "body" must be at most ${DRAFT_LIMITS.bodyMax} characters.`,
    );
  }

  const rating = payload["rating"];
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < DRAFT_LIMITS.ratingMin ||
    rating > DRAFT_LIMITS.ratingMax
  ) {
    throw invalid(
      "rating",
      `Field "rating" must be an integer between ${DRAFT_LIMITS.ratingMin} and ${DRAFT_LIMITS.ratingMax}.`,
    );
  }

  const rawKey = optionalString(payload, "clientRequestKey");
  if (rawKey === undefined) {
    throw invalid("clientRequestKey", 'Field "clientRequestKey" is required.');
  }
  const clientRequestKey = rawKey.trim();
  if (
    clientRequestKey.length === 0 ||
    clientRequestKey.length > DRAFT_LIMITS.clientRequestKeyMax
  ) {
    throw invalid(
      "clientRequestKey",
      `Field "clientRequestKey" must be 1 to ${DRAFT_LIMITS.clientRequestKeyMax} characters.`,
    );
  }

  return { universityId, targetType, targetId, title, body, rating, clientRequestKey };
}

export type ParsedUpdateInput = {
  /** Present = change (null clears the title); absent = leave unchanged. */
  title?: string | null;
  body?: string;
  rating?: number;
  /** Expected current revision (optimistic concurrency token). */
  revision: number;
};

export function parseUpdateInput(value: unknown): ParsedUpdateInput {
  const payload = requirePlainObject(value, "body");
  rejectUnknownKeys(payload, ["title", "body", "rating", "revision"]);

  const revision = payload["revision"];
  if (
    typeof revision !== "number" ||
    !Number.isInteger(revision) ||
    revision < 1
  ) {
    throw invalid("revision", 'Field "revision" must be a positive integer.');
  }

  const result: ParsedUpdateInput = { revision };

  if ("title" in payload) {
    const title = payload["title"];
    if (title === null) {
      result.title = null;
    } else if (typeof title === "string") {
      const trimmed = title.trim();
      if (trimmed.length === 0) {
        throw invalid("title", 'Field "title" must not be empty; use null to clear it.');
      }
      if (trimmed.length > DRAFT_LIMITS.titleMax) {
        throw invalid(
          "title",
          `Field "title" must be at most ${DRAFT_LIMITS.titleMax} characters.`,
        );
      }
      result.title = trimmed;
    } else {
      throw invalid("title", 'Field "title" must be a string or null.');
    }
  }

  if ("body" in payload) {
    const body = payload["body"];
    if (typeof body !== "string") {
      throw invalid("body", 'Field "body" must be a string.');
    }
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      throw invalid("body", 'Field "body" must not be empty.');
    }
    if (trimmed.length > DRAFT_LIMITS.bodyMax) {
      throw invalid(
        "body",
        `Field "body" must be at most ${DRAFT_LIMITS.bodyMax} characters.`,
      );
    }
    result.body = trimmed;
  }

  if ("rating" in payload) {
    const rating = payload["rating"];
    if (
      typeof rating !== "number" ||
      !Number.isInteger(rating) ||
      rating < DRAFT_LIMITS.ratingMin ||
      rating > DRAFT_LIMITS.ratingMax
    ) {
      throw invalid(
        "rating",
        `Field "rating" must be an integer between ${DRAFT_LIMITS.ratingMin} and ${DRAFT_LIMITS.ratingMax}.`,
      );
    }
    result.rating = rating;
  }

  if (
    result.title === undefined &&
    result.body === undefined &&
    result.rating === undefined
  ) {
    throw invalid(
      "revision",
      "At least one of title, body or rating must be provided for an update.",
    );
  }

  return result;
}

export function parseListOptions(value: unknown): Required<DraftListOptions> {
  const defaults: Required<DraftListOptions> = {
    limit: DRAFT_LIMITS.listLimitDefault,
    offset: 0,
  };
  if (value === undefined || value === null) {
    return defaults;
  }
  const payload = requirePlainObject(value, "options");
  rejectUnknownKeys(payload, ["limit", "offset"]);

  const result = { ...defaults };
  const limit = payload["limit"];
  if (limit !== undefined) {
    if (
      typeof limit !== "number" ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > DRAFT_LIMITS.listLimitMax
    ) {
      throw invalid(
        "limit",
        `Field "limit" must be an integer between 1 and ${DRAFT_LIMITS.listLimitMax}.`,
      );
    }
    result.limit = limit;
  }
  const offset = payload["offset"];
  if (offset !== undefined) {
    if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0) {
      throw invalid("offset", 'Field "offset" must be a non-negative integer.');
    }
    result.offset = offset;
  }
  return result;
}
