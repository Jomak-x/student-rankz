import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";

import { accountVerifications, universityDomains } from "@/db/affiliation-schema";
import { universities } from "@/db/schema";
import { parseEmail } from "./domain.js";
import type { EmailTransport } from "./email.js";
import type {
  ConsumeError,
  ConsumeResult,
  InitiateError,
  InitiateResult,
  VerificationStatus,
} from "./types.js";

export type { ConsumeError, ConsumeResult, InitiateError, InitiateResult, VerificationStatus };

// Accepts both drizzle-orm/node-postgres (tests) and drizzle-orm/neon-serverless
// (production).  NOT compatible with drizzle-orm/neon-http, which lacks the
// interactive transactions required for the atomic consume and initiate operations.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AffiliationDb = PgDatabase<any, Record<string, never>>;

export interface AffiliationServiceConfig {
  db: AffiliationDb;
  transport: EmailTransport;
  /**
   * Required HMAC secret.  Construction throws if empty — fail closed.
   * Supply from AFFILIATION_HMAC_SECRET in production.
   */
  hmacSecret: string;
  /** Minutes before a verification code expires. Default: 15. */
  codeExpiryMinutes?: number;
  /** Maximum wrong-code attempts before a challenge is locked. Default: 5. */
  maxAttempts?: number;
  /** Maximum codes sent per account+university per hour. Default: 3. */
  maxSendsPerHour?: number;
  /**
   * Maximum active (pending or sent) challenges to the same email address
   * across ALL accounts (best-effort anti-spam).  Default: 5.
   */
  maxSendsPerEmailPerHour?: number;
}

const HOUR_MS = 60 * 60 * 1000;
const CODE_MIN = 100_000;
const CODE_MAX = 1_000_000; // exclusive → 6 digits

export class AffiliationService {
  private readonly db: AffiliationDb;
  private readonly transport: EmailTransport;
  private readonly hmacKey: Buffer;
  private readonly codeExpiryMs: number;
  private readonly maxAttempts: number;
  private readonly maxSendsPerHour: number;
  private readonly maxSendsPerEmailPerHour: number;

  constructor(config: AffiliationServiceConfig) {
    if (!config.hmacSecret) {
      throw new Error(
        "AffiliationService: hmacSecret is required — service refuses to start without it",
      );
    }
    this.db = config.db;
    this.transport = config.transport;
    this.hmacKey = Buffer.from(config.hmacSecret, "utf8");
    this.codeExpiryMs = (config.codeExpiryMinutes ?? 15) * 60 * 1000;
    this.maxAttempts = config.maxAttempts ?? 5;
    this.maxSendsPerHour = config.maxSendsPerHour ?? 3;
    this.maxSendsPerEmailPerHour = config.maxSendsPerEmailPerHour ?? 5;
  }

  /**
   * Initiate university-email verification for a principal.
   *
   * Design guarantees:
   *   1. All state mutations (slot creation, challenge write, throttle increment)
   *      happen inside a single transaction under a row-level FOR UPDATE lock.
   *      Concurrent initiations for the same account+university are serialised;
   *      throttle and verified checks cannot be bypassed by racing requests.
   *   2. No database transaction is open while the email is being sent.
   *      (Neon enforces a strict transaction time-limit; holding a transaction
   *      across an external HTTP call would also block other queries on the row.)
   *   3. The delivery-confirmation and failure-cleanup UPDATEs are scoped to
   *      the challengeId generated this call.  A concurrent resend that commits
   *      a new challengeId before our cleanup runs will not be affected.
   *   4. send failure does not mark verified.  On transport error, the pending
   *      challenge is cleared; the row is left intact and unverified.
   *
   * @param principal  Server-supplied auth-provider subject; never from body.
   * @param email      Email address to verify (must match registry domain).
   */
  async initiate(principal: string, email: string): Promise<InitiateResult> {
    const parsed = parseEmail(email);
    if (!parsed) return { ok: false, error: "INVALID_EMAIL" as InitiateError };

    const normalizedEmail = `${parsed.localPart}@${parsed.domain}`;

    // Domain registry lookup (no row lock needed — domains are admin-only writes).
    const [domainRow] = await this.db
      .select({ universityId: universityDomains.universityId })
      .from(universityDomains)
      .where(
        and(
          eq(universityDomains.domain, parsed.domain),
          eq(universityDomains.active, true),
        ),
      );
    if (!domainRow) return { ok: false, error: "UNKNOWN_DOMAIN" as InitiateError };
    const { universityId } = domainRow;

    const [uni] = await this.db
      .select({ name: universities.name })
      .from(universities)
      .where(eq(universities.id, universityId));
    if (!uni) return { ok: false, error: "UNKNOWN_DOMAIN" as InitiateError };

    // Generate challenge material before the transaction — no async crypto
    // inside the critical section.
    const challengeId = randomUUID();
    const code = randomInt(CODE_MIN, CODE_MAX).toString();
    const codeHmac = this.computeHmac(principal, universityId, normalizedEmail, code);
    const codeExpiresAt = new Date(Date.now() + this.codeExpiryMs);

    // ── Atomic reservation ──────────────────────────────────────────────────
    // Open a transaction that serializes both the cross-account per-email
    // throttle AND the per-account slot reservation.  No external I/O inside.
    //
    // Lock order (deadlock-free):
    //   1. Advisory lock on email hash — serializes all senders to same email
    //   2. Row-level FOR UPDATE on (account_subject, university_id)
    const reservation = await this.db.transaction(async (tx) => {
      // Advisory lock keyed on the email address.  Serializes concurrent
      // requests to the same recipient across all accounts so the email
      // count below is accurate and not subject to TOCTOU races.
      await (tx as AffiliationDb).execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${normalizedEmail}))`,
      );

      // Per-email recipient throttle — time-bounded to avoid permanent lockout
      // from abandoned/expired challenges.
      const [{ emailCount }] = await (tx as AffiliationDb)
        .select({ emailCount: sql<number>`count(*)::int` })
        .from(accountVerifications)
        .where(
          and(
            eq(accountVerifications.emailAddress, normalizedEmail),
            sql`${accountVerifications.deliveryState} IS NOT NULL`,
            sql`${accountVerifications.updatedAt} > now() - interval '1 hour'`,
          ),
        );
      if (emailCount >= this.maxSendsPerEmailPerHour) {
        return { blocked: "RATE_LIMITED" as InitiateError };
      }

      // Ensure the slot exists — INSERT is a no-op if the row already exists.
      // This avoids the classic "two concurrent firsts both see no row and
      // both try to INSERT" race: the second INSERT ON CONFLICT DO NOTHING
      // blocks until the first transaction commits, then resolves to a no-op.
      await (tx as AffiliationDb).execute(sql`
        INSERT INTO account_verifications
          (account_subject, university_id, email_address, send_window_starts_at)
        VALUES (${principal}, ${universityId}, ${normalizedEmail}, now())
        ON CONFLICT (account_subject, university_id) DO NOTHING
      `);

      // Lock the row exclusively for the remainder of this transaction.
      const [record] = await (tx as AffiliationDb)
        .select()
        .from(accountVerifications)
        .where(
          and(
            eq(accountVerifications.accountSubject, principal),
            eq(accountVerifications.universityId, universityId),
          ),
        )
        .for("update");

      if (!record) return { blocked: "UNKNOWN_DOMAIN" as InitiateError };
      if (record.verified) return { blocked: "ALREADY_VERIFIED" as InitiateError };

      // Per-account rate limit (evaluated under the lock for accuracy).
      const windowAge = Date.now() - record.sendWindowStartsAt.getTime();
      const windowExpired = windowAge >= HOUR_MS;
      const effectiveSendCount = windowExpired ? 0 : record.sendCount;
      if (effectiveSendCount >= this.maxSendsPerHour) {
        return { blocked: "RATE_LIMITED" as InitiateError };
      }

      const newSendCount = effectiveSendCount + 1;
      const newWindowStart = windowExpired ? new Date() : record.sendWindowStartsAt;

      // Write the pending challenge under the lock.  A resend also updates
      // email_address here — verified=true is already blocked above so the
      // address will never be changed on an already-verified row.
      await (tx as AffiliationDb)
        .update(accountVerifications)
        .set({
          emailAddress: normalizedEmail,
          challengeId,
          deliveryState: "pending",
          codeHmac,
          codeExpiresAt,
          attemptCount: 0,
          sendCount: newSendCount,
          sendWindowStartsAt: newWindowStart,
          updatedAt: new Date(),
        })
        .where(eq(accountVerifications.id, record.id));

      return { ok: true as const };
    });

    if (!reservation.ok) return { ok: false, error: reservation.blocked };

    // ── Email delivery (no open transaction) ────────────────────────────────
    try {
      await this.transport.sendVerificationCode({
        to: normalizedEmail,
        code,
        universityName: uni.name,
      });
    } catch {
      // Scoped failure cleanup: only clear THIS challenge.
      // WHERE challenge_id = X ensures a concurrent resend that has already
      // committed a new challenge_id is not affected.
      // WHERE delivery_state = 'pending' ensures we don't clear a challenge
      // that another path already confirmed.
      // Redact: never log the code, address, or university name.
      await this.db
        .update(accountVerifications)
        .set({
          challengeId: null,
          deliveryState: null,
          codeHmac: null,
          codeExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accountVerifications.challengeId, challengeId),
            eq(accountVerifications.deliveryState, "pending"),
          ),
        );
      return { ok: false, error: "SEND_FAILED" as InitiateError };
    }

    // Confirm delivery — challenge is now consumable.
    await this.db
      .update(accountVerifications)
      .set({ deliveryState: "sent", updatedAt: new Date() })
      .where(
        and(
          eq(accountVerifications.challengeId, challengeId),
          eq(accountVerifications.deliveryState, "pending"),
        ),
      );

    return { ok: true, universityId };
  }

  /**
   * Consume a verification code.
   *
   * Runs inside a real database transaction with a row-level FOR UPDATE lock to
   * prevent concurrent replay — two simultaneous consumes for the same
   * account+university are serialised; the second sees verified=true and returns
   * ALREADY_VERIFIED.
   *
   * The challenge is only consumable when delivery_state = 'sent', preventing
   * consumption before the email is confirmed delivered.
   *
   * Uses timing-safe HMAC comparison.  Wrong code, expired, locked-out, pending
   * (not yet delivered), and mismatched address all return INVALID_CODE or
   * NOT_PENDING to avoid leaking state.
   *
   * @param principal  Server-supplied auth-provider subject; never from body.
   * @param email      The email address the code was sent to.
   * @param code       6-digit code from the verification email.
   */
  async consume(
    principal: string,
    email: string,
    code: string,
  ): Promise<ConsumeResult> {
    const parsed = parseEmail(email);
    if (!parsed) return { ok: false, error: "INVALID_EMAIL" as ConsumeError };

    const normalizedEmail = `${parsed.localPart}@${parsed.domain}`;

    const [domainRow] = await this.db
      .select({ universityId: universityDomains.universityId })
      .from(universityDomains)
      .where(
        and(
          eq(universityDomains.domain, parsed.domain),
          eq(universityDomains.active, true),
        ),
      );
    if (!domainRow) return { ok: false, error: "UNKNOWN_DOMAIN" as ConsumeError };
    const { universityId } = domainRow;

    // Atomic consume: FOR UPDATE lock serialises concurrent replays.
    const result = await this.db.transaction(async (tx) => {
      const [record] = await (tx as AffiliationDb)
        .select()
        .from(accountVerifications)
        .where(
          and(
            eq(accountVerifications.accountSubject, principal),
            eq(accountVerifications.universityId, universityId),
          ),
        )
        .for("update");

      if (!record) return { ok: false as const, error: "NOT_PENDING" as ConsumeError };
      if (record.verified) return { ok: false as const, error: "ALREADY_VERIFIED" as ConsumeError };

      // Require delivery_state = 'sent' — prevents consuming a challenge that
      // the transport hasn't confirmed yet ('pending') or that was cleared
      // after a failed send (null).
      if (record.deliveryState !== "sent") {
        return { ok: false as const, error: "NOT_PENDING" as ConsumeError };
      }

      // Enumeration-safe: address mismatch, no active code, expired, and max
      // attempts exhausted all return INVALID_CODE to prevent oracle attacks.
      if (record.emailAddress !== normalizedEmail) {
        return { ok: false as const, error: "INVALID_CODE" as ConsumeError };
      }
      if (!record.codeHmac || !record.codeExpiresAt) {
        return { ok: false as const, error: "NOT_PENDING" as ConsumeError };
      }
      if (record.codeExpiresAt < new Date()) {
        return { ok: false as const, error: "INVALID_CODE" as ConsumeError };
      }
      if (record.attemptCount >= this.maxAttempts) {
        return { ok: false as const, error: "INVALID_CODE" as ConsumeError };
      }

      // Context-bound HMAC comparison — binds principal, universityId, email,
      // and code so a code issued for one context cannot be replayed in another.
      const expectedHmac = this.computeHmac(principal, universityId, normalizedEmail, code);
      if (!hmacEqual(expectedHmac, record.codeHmac)) {
        await (tx as AffiliationDb)
          .update(accountVerifications)
          .set({
            attemptCount: sql`${accountVerifications.attemptCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(accountVerifications.id, record.id));
        return { ok: false as const, error: "INVALID_CODE" as ConsumeError };
      }

      // Correct code — mark verified inside the transaction.
      await (tx as AffiliationDb)
        .update(accountVerifications)
        .set({
          verified: true,
          verifiedAt: new Date(),
          challengeId: null,
          deliveryState: null,
          codeHmac: null,
          codeExpiresAt: null,
          attemptCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(accountVerifications.id, record.id));

      return { ok: true as const, universityId };
    });

    return result;
  }

  /**
   * Return the verification status for a principal+university pair.
   * Returns null if no record exists (not yet initiated).
   * The returned DTO omits all private fields (HMAC, challenge, subject).
   */
  async getStatus(
    principal: string,
    universityId: string,
  ): Promise<VerificationStatus | null> {
    const [record] = await this.db
      .select({
        verified: accountVerifications.verified,
        universityId: accountVerifications.universityId,
        verifiedAt: accountVerifications.verifiedAt,
      })
      .from(accountVerifications)
      .where(
        and(
          eq(accountVerifications.accountSubject, principal),
          eq(accountVerifications.universityId, universityId),
        ),
      );

    if (!record) return null;
    return {
      verified: record.verified,
      universityId: record.universityId,
      verifiedAt: record.verifiedAt,
    };
  }

  /**
   * Compute a context-bound HMAC that covers the full challenge context.
   * Null bytes separate fields to prevent concatenation attacks
   * (e.g. subject="a\0b" + univ="c"  ≠  subject="a" + univ="b\0c").
   */
  private computeHmac(
    principal: string,
    universityId: string,
    normalizedEmail: string,
    code: string,
  ): string {
    const message = `${principal}\0${universityId}\0${normalizedEmail}\0${code}`;
    return createHmac("sha256", this.hmacKey).update(message, "utf8").digest("hex");
  }
}

// Timing-safe hex string comparison.  Both arguments are SHA-256 HMAC hex
// strings (always 64 chars) but we guard against length mismatches.
function hmacEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
