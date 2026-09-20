# University Affiliation Service

Server-side email-domain verification that lets a signed-in user prove they have
mailbox control at an approved university address.  Verifying an email address
proves mail control, not enrollment or attendance.

**Status: service implemented, no public routes yet.**  Routes and UI are
delivered by the integration PR once both the auth and directory foundation PRs
are merged.  All behaviour described as "planned" below is explicitly not wired
up in this PR.

---

## Table of contents

1. [Threat model and design decisions](#1-threat-model-and-design-decisions)
2. [Schema](#2-schema)
3. [Migration asset and integration order](#3-migration-asset-and-integration-order)
4. [Service API](#4-service-api)
5. [Configuration and environment variables](#5-configuration-and-environment-variables)
6. [Email transport](#6-email-transport)
7. [Running tests](#7-running-tests)
8. [Planned route integration (not yet implemented)](#8-planned-route-integration-not-yet-implemented)

---

## 1. Threat model and design decisions

### Exact domain matching only

The `university_domains` registry maps email domains to universities with
**exact equality** — no suffix matching.  `evil-student.westhaven.nl` never
matches the entry for `student.westhaven.nl`.

Domains are normalized to lowercase WHATWG URL hostname form before storage and
lookup, so IDN / punycode input round-trips safely.

### Mail control, not enrollment

Verifying an address proves that the user can receive email at that address
within the registered domain.  It does not imply enrollment, graduation, or
affiliation in any other sense.

### One university per verification, no cross-grant

A user verified for Westhaven University is not thereby verified for Ostbrück
Institute even if both domains are in the registry.  Each `(account_subject,
university_id)` pair has an independent record.

### Atomic consume with row-level locking

The `consume` operation runs inside a real PostgreSQL transaction with
`SELECT … FOR UPDATE`.  Two concurrent consumes for the same account+university
pair are serialized: the second client waits for the first to commit, then sees
`verified = true` and returns `ALREADY_VERIFIED`.

This requires an interactive-transaction transport:
- **Tests**: `drizzle-orm/node-postgres` (full pg protocol)
- **Production**: `drizzle-orm/neon-serverless` (Neon WebSocket Pool)
- **Not compatible**: `drizzle-orm/neon-http` (HTTP-only; no interactive transactions)

The production factory is in `server/affiliation/db.ts`.

### Timing-safe code comparison

Stored codes are HMAC-SHA256 (hex) of the 6-digit numeric code under
`AFFILIATION_HMAC_SECRET`.  Comparison uses `crypto.timingSafeEqual` to prevent
timing oracle attacks.  The secret is required at service construction; the
service throws on startup if it is missing.

### Send failure is safe

The HMAC is stored **before** calling the email transport.  If the transport
throws, the HMAC is immediately cleared from the database.  The service returns
`SEND_FAILED`; `verified` is never set.  No stale or undelivered code can be
consumed.

### Enumeration-safe responses

The `consume` operation returns `INVALID_CODE` for: wrong code, expired code,
locked-out code (max attempts reached), and mismatched address.  Distinguishing
these would let an attacker enumerate state; the generic error prevents that.

---

## 2. Schema

Defined in `db/affiliation-schema.ts`.  Imports `universities` from the base
schema (`db/schema.ts`) for the foreign key reference.

### `university_domains`

Curated registry: one row per approved email domain.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `university_id` | `uuid` FK → `universities.id` | CASCADE on delete |
| `domain` | `text` UNIQUE | Normalized lowercase hostname, e.g. `student.uva.nl` |
| `active` | `boolean` | Inactive rows are ignored by lookups |
| `created_at` | `timestamptz` | |

**Constraint** `university_domains_domain_format_check`: domain must match
`^[a-z0-9][a-z0-9\-]*(\.[a-z0-9][a-z0-9\-]*)+$` — no bare labels, no IP
addresses, must have at least one dot.

### `account_verifications`

One record per `(account_subject, university_id)` pair.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `account_subject` | `text` | Provider subject from auth layer; never from request body |
| `university_id` | `uuid` FK → `universities.id` | CASCADE on delete |
| `email_address` | `text` | The specific address being verified |
| `code_hmac` | `text` nullable | HMAC-SHA256 hex of current code; null when none pending |
| `code_expires_at` | `timestamptz` nullable | |
| `attempt_count` | `smallint` | Consecutive wrong-code attempts on the current code |
| `send_count` | `smallint` | Codes sent in the current hourly send window |
| `send_window_starts_at` | `timestamptz` | When the current hourly window began |
| `verified` | `boolean` | Whether affiliation is confirmed |
| `verified_at` | `timestamptz` nullable | When `verified` was set to `true` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Unique constraint**: `(account_subject, university_id)`.

---

## 3. Migration asset and integration order

Raw SQL: `db/feature-migrations/affiliation.sql`

Apply order:
1. `drizzle/0000_old_iron_fist.sql` — base directory schema (universities, programmes, …)
2. `db/feature-migrations/affiliation.sql` — affiliation tables and indexes

**Integration PR** (`deployment-and-integration` branch): add
`db/feature-migrations/affiliation.sql` as `drizzle/0001_affiliation.sql` and
update the Drizzle journal.  Do not generate a new snapshot from scratch — copy
the SQL asset.

The migration SQL uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT
EXISTS` guards so it is safe to apply to a previously-migrated database.  The
`ALTER TABLE ADD CONSTRAINT` statements assume a fresh database; on a
previously-migrated server the integration PR Drizzle journal handles
idempotency.

---

## 4. Service API

All operations live in `AffiliationService` (imported from
`@/server/affiliation`).

### Construction

```ts
import { AffiliationService, MockTransport } from "@/server/affiliation";
import { createAffiliationDb } from "@/server/affiliation/db";

// Production:
const db = createAffiliationDb();            // Neon WebSocket Pool
const transport = ResendTransport.fromEnv(); // from @/server/affiliation/resend
const service = new AffiliationService({
  db,
  transport,
  hmacSecret: process.env.AFFILIATION_HMAC_SECRET!, // required
  // codeExpiryMinutes: 15,   // default
  // maxAttempts: 5,          // default
  // maxSendsPerHour: 3,      // default
});
```

Throws immediately if `hmacSecret` is empty — the service never starts without it.

### `initiate(principal, email): Promise<InitiateResult>`

Validates the email address, looks up the domain in the curated registry, applies
send-rate throttling, generates and stores an HMAC-SHA256 code, sends it via the
transport.

```ts
const result = await service.initiate("sub|auth0|abc123", "alice@student.westhaven.nl");

if (result.ok) {
  console.log("Code sent. universityId:", result.universityId);
} else {
  // result.error: "INVALID_EMAIL" | "UNKNOWN_DOMAIN" | "ALREADY_VERIFIED"
  //             | "RATE_LIMITED" | "SEND_FAILED"
}
```

**`principal`** must be the server-supplied auth-provider subject.  It is never
read from the request body.

### `consume(principal, email, code): Promise<ConsumeResult>`

Validates and atomically consumes the code within a transaction.

```ts
const result = await service.consume("sub|auth0|abc123", "alice@student.westhaven.nl", "847291");

if (result.ok) {
  // result.universityId, result.accountSubject
} else {
  // result.error: "INVALID_EMAIL" | "UNKNOWN_DOMAIN" | "NOT_PENDING"
  //             | "INVALID_CODE" | "ALREADY_VERIFIED"
}
```

`INVALID_CODE` is returned for: wrong code, expired code, max-attempts lockout,
and mismatched email address (enumeration-safe).

### `getStatus(principal, universityId): Promise<VerificationStatus | null>`

```ts
const status = await service.getStatus("sub|auth0|abc123", "00000000-...");
// null → no record; { verified, universityId, verifiedAt } otherwise
```

Returns a DTO without hashes, codes, or other private fields.

---

## 5. Configuration and environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes (production) | Pooled Neon connection string (WebSocket-capable) |
| `AFFILIATION_HMAC_SECRET` | Yes | Minimum 32 random bytes, base64 or hex; service refuses to start without it |
| `RESEND_API_KEY` | Yes (production) | Resend API key for email delivery |
| `RESEND_FROM` | Yes (production) | Verified sender address (e.g. `noreply@student-rankz.eu`) |
| `TEST_DATABASE_URL` | Tests | Defaults to Docker Postgres at `localhost:15432` |

### Generating AFFILIATION_HMAC_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Email transport

`EmailTransport` interface (in `server/affiliation/email.ts`):

```ts
interface EmailTransport {
  sendVerificationCode(params: {
    to: string;
    code: string;
    universityName: string;
  }): Promise<void>;
}
```

| Transport | Module | Use |
|---|---|---|
| `MockTransport` | `server/affiliation/email` | Tests: captures sent messages, never delivers |
| `FailingTransport` | `server/affiliation/email` | Tests: always throws to verify safe-send behavior |
| `ResendTransport` | `server/affiliation/resend` (server-only) | Production: Resend API |

`ResendTransport.fromEnv()` reads `RESEND_API_KEY` and `RESEND_FROM` and throws if
either is missing — fail-closed.

---

## 7. Running tests

Tests use `node:test` (Node's built-in runner) against an ephemeral real
Postgres.  Start the Docker Postgres from `docs/DATABASE.md` first:

```bash
docker compose -f docker/compose.test.yml up -d  # or equivalent from DATABASE.md
```

```bash
# Affiliation service tests (25 test cases)
npm run test:affiliation

# Base directory tests (must still pass — regression check)
npm run test:db

# All verification
npm run typecheck && npm run lint && npm run build && npm run test:db && npm run test:affiliation
```

### Test coverage

| Category | Tests |
|---|---|
| Schema migration | Tables, constraints, and foreign keys present |
| `initiate` validation | Malformed email, IP domain, unknown domain, suffix spoofing |
| `initiate` happy path | Code sent, EU domain accepted, ALREADY_VERIFIED guard |
| `initiate` send failure | No verified state set, HMAC cleared, NOT_PENDING after |
| `initiate` rate limiting | Blocks after `maxSendsPerHour` |
| `consume` happy path | Correct code marks verified, status updated |
| `consume` replay | Second consume returns ALREADY_VERIFIED |
| `consume` expiry | Zero-minute expiry returns INVALID_CODE |
| `consume` brute force | Wrong code increments; locked after `maxAttempts` |
| `resend` | Old code invalidated; attempt counter reset; new code works |
| Cross-account | Mismatched principal returns NOT_PENDING |
| Cross-address | Mismatched address returns INVALID_CODE |
| Cross-university | Westhaven verification does not grant Ostbrück |
| Concurrency | Two simultaneous consumes: exactly one succeeds |
| Concurrency | Two wrong codes: attempt count is exactly 2 (no lost updates) |

---

## 8. Planned route integration (not yet implemented)

The following behaviour is **planned but not yet wired up** in this PR.  It
requires both the auth (managed Neon session) and directory foundation PRs to be
merged.

- `POST /api/affiliation/initiate` — accepts `{ email }` in body; reads
  principal from the server session (never from body).
- `POST /api/affiliation/consume` — accepts `{ email, code }` in body; same
  principal source.
- `GET /api/affiliation/status?universityId=…` — returns verification status.
- Minimal UI pages: pending / success / expiry / error states for the
  verification flow.

The route layer is responsible for:
- Extracting the principal from the authenticated server session.
- Instantiating `AffiliationService` with `createAffiliationDb()` (WebSocket
  Neon) and `ResendTransport.fromEnv()`.
- Translating service result types to HTTP response codes (e.g. `RATE_LIMITED →
  429`, `INVALID_CODE → 422`).
