# University Affiliation Service

Proves that a user controls an email address at a registered university domain.  This is **mail-control verification only** — it does not prove enrollment status.

---

## Status: service layer complete, no public routes yet

The service is implemented and tested.  No Next.js routes or auth UI exist in this PR.  A future PR will wire the service to authenticated API routes; until then, the service cannot be called from the outside.

---

## Design goals

- **Principal from server session only.** The caller supplies the account subject from a validated server-side session.  The subject is never inferred from the request body.
- **Single-row per (account, university).** One slot per pair; re-sending invalidates the previous challenge.
- **Atomic reservation.** `INSERT … ON CONFLICT DO NOTHING` + `SELECT … FOR UPDATE` serializes concurrent initiations; throttle and verified checks run under the row lock.
- **Durable cross-account recipient throttle.** `pg_advisory_xact_lock(hashtext(email))` serializes concurrent requests to the same recipient.  Sends are recorded in the immutable `recipient_send_log` table — independent of the mutable verification row.  Address changes and new challenges do **not** erase log entries.  The per-email count is time-bounded (1-hour window); expired entries are pruned inside the advisory lock.
- **No transaction held across I/O.** The DB transaction commits before the email is sent.  The delivery-state machine coordinates what happens after.
- **Delivery-state guard.** A challenge is only consumable once the transport confirms delivery (`delivery_state = 'sent'`).  A challenge in `delivery_state = 'pending'` (written but not yet confirmed) or `null` (cleared) is not consumable.
- **Scoped failure cleanup.** On transport error, the cleanup `UPDATE` is scoped to the specific `challenge_id` generated for this send.  A concurrent resend that already committed a new challenge is not affected.
- **Context-bound HMAC.** `HMAC-SHA256(secret, principal\0universityId\0normalizedEmail\0code)` — null-byte-separated fields bind the code to the exact (subject, university, address) context.  A code cannot be replayed in a different context.
- **Immutable verified address.** Once `verified = true`, no initiate can change the stored email address.
- **Fail closed.** Empty `hmacSecret` throws at construction.  Send failure never marks the row verified.  Codes, addresses, and HMAC values are never logged.

---

## Architecture

### Driver requirement

Production uses `drizzle-orm/neon-serverless` (WebSocket Pool) — **not** `drizzle-orm/neon-http`.  The HTTP driver cannot run interactive multi-statement transactions (`SELECT … FOR UPDATE`, `SAVEPOINT`).  Tests use `drizzle-orm/node-postgres`.  The `AffiliationService` constructor accepts either; it does **not** accept a neon-http driver.

### Database factory

```ts
import {
  createAffiliationDb,
  getAffiliationDb,
  closeAffiliationDb,
} from "@/server/affiliation/db";

// Singleton (recommended for long-running processes):
const db = getAffiliationDb();
process.on("SIGTERM", () => closeAffiliationDb());

// Standalone (e.g. tests, scripts): close the SAME pool you created.
const { db, pool } = createAffiliationDb();
// ... use db ...
await pool.end();   // NOT closeAffiliationDb() — that only closes the singleton
```

`getAffiliationDb()` returns the lazy singleton `db`.  `closeAffiliationDb()` drains the **singleton** pool only; standalone pools created by `createAffiliationDb()` must close their own `pool.end()`.  Both functions are safe to call multiple times.

### Service construction

```ts
import { AffiliationService } from "@/server/affiliation/service";
import { ResendTransport } from "@/server/affiliation/resend";   // production adapter

const service = new AffiliationService({
  db: getAffiliationDb(),
  transport: ResendTransport.fromEnv(),
  hmacSecret: process.env.AFFILIATION_HMAC_SECRET!,
  codeExpiryMinutes: 15,   // default
  maxAttempts: 5,          // default
  maxSendsPerHour: 3,      // per account+university, enforced under row lock
  maxSendsPerEmailPerHour: 5,  // per email, cross-account, atomic advisory lock
});
```

---

## Challenge lifecycle (`delivery_state`)

```
                        initiate()
                            │
                   Transaction commits
                            │
              ┌─────────────▼──────────────┐
              │  delivery_state = 'pending' │  ← NOT consumable
              └─────────────┬──────────────┘
                            │
               transport.sendVerificationCode()
                      ┌─────┴──────┐
               success│            │failure
                      ▼            ▼
        delivery_state='sent'  delivery_state=null (cleared)
        consumable ✓           row intact, verified=false
```

- `null` — no active challenge (initial state, or after send failure, or after successful consume)
- `'pending'` — challenge written to DB; email not yet confirmed; **not consumable**
- `'sent'` — email confirmed delivered; **consumable**

The scoped cleanup `WHERE challenge_id = X AND delivery_state = 'pending'` only clears the challenge if it is still the one this send wrote AND it has not been confirmed.

---

## `initiate(principal, email): Promise<InitiateResult>`

1. Parse and normalize `email`; reject malformed formats, IPv4 domains, port/path/fragment injections, percent-encoded hostnames.
2. Look up `email.domain` in `university_domains` (active only).
3. (Moved inside the transaction — see step 4.)
4. Begin transaction:
   - `pg_advisory_xact_lock(hashtext(email))` — serializes all senders to same recipient.
   - Prune expired `recipient_send_log` entries (>1 hour old) for this email.
   - Count remaining log entries for this email → `RATE_LIMITED` if `≥ maxSendsPerEmailPerHour`.
   - `INSERT INTO account_verifications … ON CONFLICT DO NOTHING` — creates the slot if absent.
   - `SELECT … FOR UPDATE` — locks the slot.
   - Check `verified = true` → `ALREADY_VERIFIED`.
   - Check per-account send rate → `RATE_LIMITED`.
   - Write `challenge_id = <uuid>`, `delivery_state = 'pending'`, `code_hmac = <context-bound HMAC>`, `code_expires_at`, `attempt_count = 0`.
   - Insert `recipient_send_log` entry (recipient_email, challenge_id) — immutable reservation.
5. Transaction commits.
6. Call `transport.sendVerificationCode({ to, code, universityName })`.
   - On success: `UPDATE … SET delivery_state = 'sent' WHERE challenge_id = X AND delivery_state = 'pending'`.
   - On failure: delete the `recipient_send_log` entry for this challenge_id, then `UPDATE … SET challenge_id = null, delivery_state = null, code_hmac = null, code_expires_at = null WHERE challenge_id = X AND delivery_state = 'pending'`.  Returns `SEND_FAILED`.

Returns:
- `{ ok: true, universityId }` on success
- `{ ok: false, error: "INVALID_EMAIL" | "UNKNOWN_DOMAIN" | "ALREADY_VERIFIED" | "RATE_LIMITED" | "SEND_FAILED" }` on error

---

## `consume(principal, email, code): Promise<ConsumeResult>`

1. Parse `email`; look up domain in registry.
2. Begin transaction with `SELECT … FOR UPDATE`.
3. Reject if no record (`NOT_PENDING`), already verified (`ALREADY_VERIFIED`), `delivery_state ≠ 'sent'` (`NOT_PENDING`), address mismatch or no HMAC (`INVALID_CODE` / `NOT_PENDING`), expired (`INVALID_CODE`), attempts exhausted (`INVALID_CODE`).
4. Timing-safe context-bound HMAC comparison.  Mismatch: increment `attempt_count`, return `INVALID_CODE`.
5. Match: set `verified = true`, `verified_at = now()`, clear challenge fields.

Returns:
- `{ ok: true, universityId }` — **`accountSubject` is intentionally absent** from the public DTO
- `{ ok: false, error: "INVALID_EMAIL" | "UNKNOWN_DOMAIN" | "ALREADY_VERIFIED" | "NOT_PENDING" | "INVALID_CODE" }` on error

---

## `getStatus(principal, universityId): Promise<VerificationStatus | null>`

Returns `null` if no record exists.  Returns `{ verified, universityId, verifiedAt }` otherwise.  Private fields (`codeHmac`, `challengeId`, `accountSubject`) are never projected.

---

## Domain validation

Before any IDNA/URL-parse step, `parseEmail` rejects input containing:
- Characters that would be reinterpreted by URL parsers: `:`, `/`, `\`, `@` (second occurrence), `#`, `?`, `%`
- Characters not valid in DNS hostnames: `_` (RFC 952)
- Control characters `[\x00–\x1F\x7F]`

After URL parsing:
- `url.port`, `url.search`, `url.hash`, `url.username`, `url.password` must all be empty.
- `url.pathname` must be `"/"`.
- Every dot-separated label is checked: no label may begin or end with a hyphen (RFC 1123 § 2.1).

DB-level constraints (enforced independently):
- Domain labels must begin and end with `[a-z0-9]` and may contain hyphens in the middle.
- At least two labels required (no bare TLD or single-label hostname).
- IPv4 addresses (matching `^[0-9]+(\.[0-9]+){3}$`) are rejected by a separate check constraint.

---

## HMAC binding

```
HMAC-SHA256(hmacSecret, "${principal}\0${universityId}\0${normalizedEmail}\0${code}")
```

Null-byte field separators prevent concatenation collisions (e.g., `"a\0b" + "c"` ≠ `"a" + "\0b\0c"`).

The binding means a code for Alice cannot be replayed as Bob, a code for university A cannot be used at university B, and a code issued to `alice@a.edu` cannot be replayed for `alice@b.edu`.

---

## `recipient_send_log` (durable throttle ledger)

The `recipient_send_log` table records each send reservation independently of the mutable `account_verifications` row.  This prevents the address-switch attack: if an account initiates for `victim@domain` and then re-initiates for `other@domain`, the original send-log entry for `victim@domain` survives the address change.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `recipient_email` | text | Normalized email the send was targeted at |
| `challenge_id` | UUID | Links to the challenge that triggered this send |
| `sent_at` | timestamptz | When the reservation was created (defaults to `now()`) |

Entries older than 1 hour are pruned inside the advisory lock during initiate.  On send failure, the log entry for the failed challenge_id is deleted to release capacity.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Pooled Neon connection string (WebSocket-capable) |
| `AFFILIATION_HMAC_SECRET` | Yes | 32+ byte secret for challenge HMAC; construction throws if empty |
| `RESEND_API_KEY` | Yes (production) | Resend API key for the email transport |
| `RESEND_FROM` | Yes (production) | Sender address for verification emails (e.g. `verify@studentrankz.com`) |

---

## Running tests

Tests require a local PostgreSQL instance.  Set `TEST_DATABASE_URL` or `DATABASE_URL` to a superuser connection string; the helpers create and drop ephemeral databases per test.

```bash
npm run test:affiliation
```

Concurrency tests use two separate DB connections per test to exercise the real row-lock serialization — in-process mocks are insufficient.

---

## Owned files

This service exclusively owns the following files (do not edit from other features):

```
server/affiliation/         Service, domain parser, email transport, DB factory, types
db/affiliation-schema.ts    Drizzle schema for affiliation tables
db/feature-migrations/affiliation.sql   SQL DDL for affiliation tables
tests/affiliation/          Integration and concurrency tests
docs/AFFILIATION.md         This document
```

Do not add FKs from affiliation tables to managed identity/auth tables.  The `account_subject` column stores the provider subject string only; it is never joined to an external auth table.
