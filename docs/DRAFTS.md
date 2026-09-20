# Private review drafts — service

Status: **service only** (this PR). No routes, no UI, no publication. The
future composer/route PR wires verified auth sessions to this service; the
final integration PR consolidates the migration journal. See
[BACKEND-ROADMAP.md](./BACKEND-ROADMAP.md) and
[DATABASE.md](./DATABASE.md) for the foundation this builds on.

## What this PR implements

A server-side CRUD service for **private** review drafts targeting one
directory entity each (university, course or instructor). Drafts are visible
only to their owner, forever, in this PR:

- Login (a verified managed-auth session) is the only requirement to keep a
  draft — affiliation is not checked here.
- There is **no** public/submitted/approved state, no moderation, no publish
  action, no score or rating aggregation and no demo fallback data. Draft
  storage never implies permission to publish.
- The existing frontend `localStorage` draft prototype is untouched and is
  never imported into the service.

## Files (feature-owned)

```
db/draft-schema.ts                      Drizzle table for review_drafts
db/feature-migrations/private-drafts.sql  Feature SQL asset (applied AFTER base migrations)
server/drafts/                          Service modules (errors, types, validation, service)
tests/drafts/                           Ephemeral-Postgres tests (node:test)
docs/DRAFTS.md                          This document
```

The base schema (`db/schema.ts`), its migration journal (`drizzle/`) and the
server DB client (`server/db.ts`) are intentionally untouched — parallel
feature branches must not compete over generated Drizzle metadata.

## Schema: `review_drafts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_subject` | varchar(255) NOT NULL | Private provider subject of the owner. **No FK** — the managed auth provider owns its own schema; this column is plain text. |
| `target_type` | `draft_target_type` enum | `university` \| `course` \| `instructor` |
| `university_id` | uuid NOT NULL | FK `universities(id) ON DELETE CASCADE` |
| `course_id` | uuid NULL | FK `(course_id, university_id) → courses(id, university_id) ON DELETE CASCADE` |
| `instructor_id` | uuid NULL | FK `(instructor_id, university_id) → instructors(id, university_id) ON DELETE CASCADE` |
| `title` | varchar(140) NULL | optional |
| `body` | text NOT NULL | 1..5000 chars |
| `rating` | smallint NOT NULL | 1..5 |
| `client_request_key` | varchar(100) NOT NULL | idempotency key; `UNIQUE (owner_subject, client_request_key)` |
| `revision` | integer NOT NULL DEFAULT 1 | optimistic concurrency token |
| `created_at` / `updated_at` | timestamptz NOT NULL | server time |

Target integrity is enforced **by the database**: the composite foreign keys
onto the directory's `(id, university_id)` unique constraints (same pattern
as `programme_courses`/`course_offerings`) reject nonexistent targets and any
course/instructor that belongs to a different university than the draft's
`university_id`. A `target_type` check constraint makes exactly one target
column set per row. Deleting a university (or its course/instructor) cascades
to its drafts.

There are deliberately no status/publication columns and no link to the auth
provider's tables.

## Service API (`server/drafts`)

```ts
import {
  createReviewDraft,
  getReviewDraft,
  listReviewDrafts,
  updateReviewDraft,
  deleteReviewDraft,
  DraftServiceError,
} from "@/server/drafts";
```

| Function | Signature (simplified) | Behaviour |
| --- | --- | --- |
| `createReviewDraft` | `(db, ownerSubject, input) → DraftDto` | Validates strictly, inserts atomically. Idempotent per `(owner, clientRequestKey)`: a retried create — even concurrent — returns the original draft unchanged; retry payloads are never applied. Unknown/foreign target → `INVALID_TARGET` (mapped from the composite FK violation). |
| `getReviewDraft` | `(db, ownerSubject, draftId) → DraftDto` | Owned single read; foreign/nonexistent → `NOT_FOUND`. |
| `listReviewDrafts` | `(db, ownerSubject, { limit?, offset? }) → { items, hasMore, nextOffset }` | Owned page, most recently updated first (`id` tie-break), `limit` 1..50 (default 20), `offset` ≥ 0. |
| `updateReviewDraft` | `(db, ownerSubject, draftId, { title?, body?, rating?, revision }) → DraftDto` | **Target is immutable** (university/course/instructor cannot change — delete and re-create instead). `revision` must match the stored revision or → `CONFLICT` (stale write rejected, never overwrites newer state). After a delete → `NOT_FOUND`: **delete wins** over in-flight stale updates. |
| `deleteReviewDraft` | `(db, ownerSubject, draftId) → { id }` | Owned delete; foreign/nonexistent → `NOT_FOUND`. |

`DraftDto` — the only shape returned: `id`, `targetType`, `universityId`,
`courseId`, `instructorId`, `title`, `body`, `rating`, `revision`,
`createdAt`, `updatedAt` (ISO strings). The owner subject and the client
request key are **never** part of any response.

### Error codes → suggested HTTP mapping (route PR's job)

| Code | Meaning | Suggested status |
| --- | --- | --- |
| `UNAUTHENTICATED` | Missing/blank/oversized principal; no query runs | 401 |
| `INVALID_INPUT` | Strict field/length/rating/UUID/pagination validation failed (unknown keys are rejected, including any attempted `ownerSubject`/`id`/`status` field) | 400 |
| `INVALID_TARGET` | Target missing or cross-university (DB-enforced) | 400/404 (route's choice) |
| `NOT_FOUND` | Draft nonexistent **or owned by someone else** — indistinguishable by design | 404 |
| `CONFLICT` | Stale `revision` on update, or a concurrent delete raced an idempotent create retry | 409 |

### Ownership contract

- The route derives `ownerSubject` **server-side** from the verified managed
  auth session. The service accepts it as a function argument only.
- Ownership never comes from the request body: unknown keys are rejected, and
  there is no owner field in create/update input at all.
- Every read/update/delete constrains by `owner_subject` **in the SQL
  statement**; cross-owner access is identical to a missing record.

### Transport contract (per the database foundation contract)

Every service operation is a **single atomic, fully parameterized SQL
statement** (no text interpolation anywhere; Drizzle binds all values). The
service therefore runs unchanged on both Drizzle transports:

- production: Neon HTTP driver via `getDb()` (`server/db.ts`), which has no
  interactive transactions — the service never opens one and never needs one;
- tests: node-postgres against a real ephemeral Postgres.

`DraftsDatabase` is the driver-agnostic Drizzle base type. A compile-time
contract test (`tests/drafts/transport.dbtest.ts`) asserts the production
`AppDatabase` (Neon HTTP) satisfies it, so no node-postgres-only behaviour
can sneak in. Multi-step guarantees are single-statement atomics plus DB
constraints: idempotent create = `INSERT … ON CONFLICT DO NOTHING RETURNING`
backed by the unique constraint; stale-write rejection = `UPDATE … WHERE id
AND owner AND revision RETURNING`; delete-wins = `DELETE … WHERE id AND
owner RETURNING`.

Runtime behaviour against the real Neon platform (HTTP proxy) is **not**
exercised here — that requires configured Neon credentials and is explicitly
recorded as unperformed, exactly as in the database foundation PR.

## Limits (mirrored by DB constraints)

| Field | Rule |
| --- | --- |
| `ownerSubject` | 1..255 chars after trim (else `UNAUTHENTICATED`) |
| `clientRequestKey` | required, 1..100 chars after trim |
| `title` | optional; 1..140 chars after trim; empty → treated as absent on create; `null` clears on update |
| `body` | required, 1..5000 chars after trim |
| `rating` | integer 1..5 |
| `revision` (update) | required positive integer |
| `limit` / `offset` | 1..50 / ≥ 0 |

## Environment

**No new secrets or env vars.** The service uses the existing
`DATABASE_URL` (application) and tests use the existing `TEST_DATABASE_URL`
(default `postgres://postgres:postgres@localhost:15432/postgres`, see
[DATABASE.md](./DATABASE.md)). No auth provider, e-mail or Neon provisioning
is involved.

## Migration integration

Apply the feature asset **after** the base directory migrations, e.g.:

```bash
psql "$DATABASE_URL" -f db/feature-migrations/private-drafts.sql
```

The asset is guarded (idempotent) so re-running is a no-op. This PR does not
touch the Drizzle journal; the final integration PR consolidates
`review_drafts` into the generated migrations once, so application code can
go back to plain `npm run db:migrate`.

## Tests

```bash
npm run test:drafts   # 11 tests: migration asset, transport contract, service behaviour
```

Real ephemeral Postgres (no mocks) per the foundation test harness, one fresh
database per test, feature SQL applied after base migrations. Covered:

- happy CRUD end-to-end, DTO key set (no owner/request-key leakage),
- idempotent create retry (sequential, different payload, concurrent
  `Promise.all`), per-owner key scoping,
- pagination + most-recently-updated ordering, cross-owner empty lists,
- cross-owner get/list/update/delete all `NOT_FOUND`, indistinguishable from
  nonexistent ids,
- target validation: nonexistent university/course, cross-university
  course/instructor mismatch, valid same-university targets,
- strict input validation (rating/lengths/unknown keys/UUIDs/pagination),
  anonymous access rejected for all five operations, boundary values
  accepted,
- stale-write conflicts, future-revision conflicts, delete-wins, no
  resurrection,
- hostile text (quotes, `DROP TABLE`, placeholders, unicode) stored and
  returned verbatim through parameterized queries.
