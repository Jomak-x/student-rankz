// Owned private review draft service.
//
// Transport contract (see docs/DRAFTS.md): every operation is a single
// atomic, fully parameterized SQL statement, so the service runs unchanged
// on both supported Drizzle transports — the Neon HTTP driver used by
// server/db.ts in production and the node-postgres driver used by the
// ephemeral-Postgres tests. The service never opens interactive
// transactions (the Neon HTTP transport has none) and never needs one: all
// multi-step guarantees (idempotent create, stale-write rejection,
// delete-wins) are enforced by single-statement atomics plus database
// constraints.
//
// Ownership contract: callers pass the server-validated provider subject of
// the signed-in account (the future route derives it from the managed auth
// session). The subject is stored only in review_drafts.owner_subject and is
// never present in any returned DTO, and no input payload can set ownership.
// Every read, update and delete constrains by owner in the statement itself,
// so foreign records are indistinguishable from nonexistent ones.
//
// Scope: drafts are private forever in this PR. There is no publication,
// submission, approval, moderation or score update path, and no demo
// fallback data — drafts are only ever shown to their own owner.

import { and, desc, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { reviewDrafts, type ReviewDraftRow } from "@/db/draft-schema";
import { DraftServiceError } from "./errors";
import type { DraftDeleteResult, DraftDto, DraftListResult } from "./types";
import {
  parseCreateInput,
  parseDraftId,
  parseListOptions,
  parseOwnerSubject,
  parseUpdateInput,
} from "./validate";

// Driver-agnostic slice of a Drizzle PgDatabase instance: the four query
// builders the service uses. Typed against the abstract result-kind base so
// BOTH supported transports satisfy it — Neon HTTP (production, via
// server/db.ts) and node-postgres (tests, real ephemeral Postgres). The
// schema-carrying properties are deliberately not part of the contract;
// every operation is a single atomic statement, so no interactive
// transactions (which Neon HTTP does not provide) are ever used. Verified
// by tests/drafts/transport.dbtest.ts.
export type DraftsDatabase = Pick<
  PgDatabase<PgQueryResultHKT>,
  "select" | "insert" | "update" | "delete"
>;

const NOT_FOUND = () =>
  new DraftServiceError("NOT_FOUND", "Draft not found.");

/** Extracts a Postgres SQLSTATE from a driver error (Drizzle wraps causes). */
function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current !== null && depth < 5; depth += 1) {
    if (typeof current === "object") {
      const candidate = current as { code?: unknown; cause?: unknown };
      if (typeof candidate.code === "string" && candidate.code.length === 5) {
        return candidate.code;
      }
      current = candidate.cause;
    } else {
      break;
    }
  }
  return undefined;
}

/** Row -> DTO. Owner subject and client request key never leave the service. */
function toDto(row: ReviewDraftRow): DraftDto {
  return {
    id: row.id,
    targetType: row.targetType,
    universityId: row.universityId,
    courseId: row.courseId,
    instructorId: row.instructorId,
    title: row.title,
    body: row.body,
    rating: row.rating,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Creates a draft. Idempotent per (owner, clientRequestKey): a retried
 * create returns the already-stored draft unchanged, even under concurrent
 * retries — the uniqueness of the pair is enforced by the database and both
 * statements are atomic.
 */
export async function createReviewDraft(
  db: DraftsDatabase,
  ownerSubject: unknown,
  input: unknown,
): Promise<DraftDto> {
  const owner = parseOwnerSubject(ownerSubject);
  const parsed = parseCreateInput(input);

  let inserted: ReviewDraftRow[];
  try {
    inserted = await db
      .insert(reviewDrafts)
      .values({
        ownerSubject: owner,
        targetType: parsed.targetType,
        universityId: parsed.universityId,
        courseId: parsed.targetType === "course" ? parsed.targetId : null,
        instructorId:
          parsed.targetType === "instructor" ? parsed.targetId : null,
        title: parsed.title,
        body: parsed.body,
        rating: parsed.rating,
        clientRequestKey: parsed.clientRequestKey,
      })
      // Atomic idempotency: only one draft per (owner, clientRequestKey).
      .onConflictDoNothing({
        target: [reviewDrafts.ownerSubject, reviewDrafts.clientRequestKey],
      })
      .returning();
  } catch (error) {
    const code = pgErrorCode(error);
    if (code === "23503") {
      // Composite FK rejected: target missing or cross-university.
      throw new DraftServiceError(
        "INVALID_TARGET",
        "The review target does not exist or does not belong to the given university.",
        { cause: error },
      );
    }
    if (code === "23514") {
      // Defense in depth; strict parsing should reject this first.
      throw new DraftServiceError(
        "INVALID_INPUT",
        "Draft payload violates draft constraints.",
        { cause: error },
      );
    }
    throw error;
  }

  if (inserted.length > 0) {
    return toDto(inserted[0]);
  }

  // Idempotent retry: the original create already won; return its draft.
  const existing = await db
    .select()
    .from(reviewDrafts)
    .where(
      and(
        eq(reviewDrafts.ownerSubject, owner),
        eq(reviewDrafts.clientRequestKey, parsed.clientRequestKey),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return toDto(existing[0]);
  }
  // The retried draft was deleted between the conflict and the read — the
  // client must decide whether to retry with a fresh request key.
  throw new DraftServiceError(
    "CONFLICT",
    "The draft was deleted while the create was being retried; use a new client request key.",
  );
}

/** Returns one owned draft; foreign and nonexistent drafts look identical. */
export async function getReviewDraft(
  db: DraftsDatabase,
  ownerSubject: unknown,
  draftId: unknown,
): Promise<DraftDto> {
  const owner = parseOwnerSubject(ownerSubject);
  const id = parseDraftId(draftId);

  const rows = await db
    .select()
    .from(reviewDrafts)
    .where(and(eq(reviewDrafts.id, id), eq(reviewDrafts.ownerSubject, owner)))
    .limit(1);

  if (rows.length === 0) {
    throw NOT_FOUND();
  }
  return toDto(rows[0]);
}

/** Lists the owner's drafts, most recently updated first, paginated. */
export async function listReviewDrafts(
  db: DraftsDatabase,
  ownerSubject: unknown,
  options?: unknown,
): Promise<DraftListResult> {
  const owner = parseOwnerSubject(ownerSubject);
  const { limit, offset } = parseListOptions(options);

  const rows = await db
    .select()
    .from(reviewDrafts)
    .where(eq(reviewDrafts.ownerSubject, owner))
    .orderBy(desc(reviewDrafts.updatedAt), desc(reviewDrafts.id))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(toDto);
  return {
    items,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  };
}

/**
 * Updates one owned draft. The draft's target (university/course/instructor)
 * is immutable — updates change only title, body and rating. `revision` must
 * match the caller's known revision; a stale revision is rejected with
 * CONFLICT and never resurrects or overwrites a newer state. After a delete
 * the update reports NOT_FOUND: delete wins over in-flight stale updates.
 */
export async function updateReviewDraft(
  db: DraftsDatabase,
  ownerSubject: unknown,
  draftId: unknown,
  input: unknown,
): Promise<DraftDto> {
  const owner = parseOwnerSubject(ownerSubject);
  const id = parseDraftId(draftId);
  const parsed = parseUpdateInput(input);

  const rows = await db
    .update(reviewDrafts)
    .set({
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.body !== undefined ? { body: parsed.body } : {}),
      ...(parsed.rating !== undefined ? { rating: parsed.rating } : {}),
      revision: sql`${reviewDrafts.revision} + 1`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(reviewDrafts.id, id),
        eq(reviewDrafts.ownerSubject, owner),
        eq(reviewDrafts.revision, parsed.revision),
      ),
    )
    .returning();

  if (rows.length > 0) {
    return toDto(rows[0]);
  }

  // Zero rows updated: distinguish stale write from missing/foreign draft.
  const existing = await db
    .select({ id: reviewDrafts.id })
    .from(reviewDrafts)
    .where(and(eq(reviewDrafts.id, id), eq(reviewDrafts.ownerSubject, owner)))
    .limit(1);
  if (existing.length > 0) {
    throw new DraftServiceError(
      "CONFLICT",
      "The draft changed since it was loaded; reload the current revision and retry.",
    );
  }
  throw NOT_FOUND();
}

/**
 * Deletes one owned draft. Returns the deleted id; foreign and nonexistent
 * drafts report NOT_FOUND identically. Deletion is final for stale writers:
 * a later stale update observes no draft and cannot resurrect it.
 */
export async function deleteReviewDraft(
  db: DraftsDatabase,
  ownerSubject: unknown,
  draftId: unknown,
): Promise<DraftDeleteResult> {
  const owner = parseOwnerSubject(ownerSubject);
  const id = parseDraftId(draftId);

  const rows = await db
    .delete(reviewDrafts)
    .where(and(eq(reviewDrafts.id, id), eq(reviewDrafts.ownerSubject, owner)))
    .returning({ id: reviewDrafts.id });

  if (rows.length === 0) {
    throw NOT_FOUND();
  }
  return { id: rows[0].id };
}
