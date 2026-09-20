import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

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
// (production). NOT compatible with drizzle-orm/neon-http, which lacks
// interactive transactions required for the atomic consume operation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AffiliationDb = PgDatabase<any, Record<string, never>>;

export interface AffiliationServiceConfig {
  db: AffiliationDb;
  transport: EmailTransport;
  /**
   * Required HMAC secret.  Construction throws if empty — fail closed.
   * In production, supply from AFFILIATION_HMAC_SECRET environment variable.
   */
  hmacSecret: string;
  /** Minutes before a verification code expires. Default: 15. */
  codeExpiryMinutes?: number;
  /** Maximum wrong-code attempts before a code is locked out. Default: 5. */
  maxAttempts?: number;
  /** Maximum codes sent per account+university per hour. Default: 3. */
  maxSendsPerHour?: number;
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
  }

  /**
   * Initiate university-email verification for a principal.
   *
   * Looks up the email domain in the curated registry, applies send-rate
   * throttling, generates and HMAC-stores a one-time code, then sends it via
   * the injected transport.  On transport failure the stored HMAC is cleared
   * so no undelivered code lingers — verified is never set on failure.
   *
   * @param principal  Server-supplied auth-provider subject; never from body.
   * @param email      Email address to verify (must match registry domain).
   */
  async initiate(principal: string, email: string): Promise<InitiateResult> {
    const parsed = parseEmail(email);
    if (!parsed) return { ok: false, error: "INVALID_EMAIL" as InitiateError };

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
    if (!domainRow) return { ok: false, error: "UNKNOWN_DOMAIN" as InitiateError };
    const { universityId } = domainRow;

    const [uni] = await this.db
      .select({ name: universities.name })
      .from(universities)
      .where(eq(universities.id, universityId));
    if (!uni) return { ok: false, error: "UNKNOWN_DOMAIN" as InitiateError };

    const [existing] = await this.db
      .select()
      .from(accountVerifications)
      .where(
        and(
          eq(accountVerifications.accountSubject, principal),
          eq(accountVerifications.universityId, universityId),
        ),
      );

    if (existing?.verified) return { ok: false, error: "ALREADY_VERIFIED" as InitiateError };

    // Send-rate throttle: reset when the window has elapsed.
    if (existing) {
      const windowAge = Date.now() - existing.sendWindowStartsAt.getTime();
      if (windowAge < HOUR_MS && existing.sendCount >= this.maxSendsPerHour) {
        return { ok: false, error: "RATE_LIMITED" as InitiateError };
      }
    }

    // Generate code and HMAC before touching the DB so a crypto failure
    // never leaves partial state.
    const code = randomInt(CODE_MIN, CODE_MAX).toString();
    const codeHmac = this.computeHmac(code);
    const codeExpiresAt = new Date(Date.now() + this.codeExpiryMs);
    const now = new Date();

    if (existing) {
      const windowAge = Date.now() - existing.sendWindowStartsAt.getTime();
      const resetWindow = windowAge >= HOUR_MS;
      await this.db
        .update(accountVerifications)
        .set({
          emailAddress: normalizedEmail,
          codeHmac,
          codeExpiresAt,
          attemptCount: 0, // resend resets attempt counter on new code
          sendCount: resetWindow ? 1 : sql`${accountVerifications.sendCount} + 1`,
          sendWindowStartsAt: resetWindow ? now : existing.sendWindowStartsAt,
          updatedAt: now,
        })
        .where(eq(accountVerifications.id, existing.id));
    } else {
      await this.db.insert(accountVerifications).values({
        accountSubject: principal,
        universityId,
        emailAddress: normalizedEmail,
        codeHmac,
        codeExpiresAt,
        attemptCount: 0,
        sendCount: 1,
        sendWindowStartsAt: now,
      });
    }

    // Send the code.  On any failure, erase the HMAC so no unsent code can
    // be replayed.  Fail closed: do not mark verified.
    try {
      await this.transport.sendVerificationCode({
        to: normalizedEmail,
        code,
        universityName: uni.name,
      });
    } catch {
      // Redact: never log the code, address, or university.
      await this.db
        .update(accountVerifications)
        .set({ codeHmac: null, codeExpiresAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(accountVerifications.accountSubject, principal),
            eq(accountVerifications.universityId, universityId),
          ),
        );
      return { ok: false, error: "SEND_FAILED" as InitiateError };
    }

    return { ok: true, universityId };
  }

  /**
   * Consume a verification code.
   *
   * Runs inside a real database transaction with a row-level lock (SELECT FOR
   * UPDATE) to prevent concurrent replay — two simultaneous consumes for the
   * same account+university are serialized; the second sees `verified = true`
   * and returns ALREADY_VERIFIED.
   *
   * Uses timing-safe HMAC comparison.  Wrong code, expired, or locked-out
   * codes all return INVALID_CODE to avoid leaking information.
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

    // Atomic consume: the transaction + FOR UPDATE lock serializes concurrent
    // replays.  Requires a real interactive-transaction transport (node-postgres
    // or neon-serverless WebSocket Pool) — NOT neon-http.
    const result = await this.db.transaction(async (tx) => {
      const rows = await (tx as AffiliationDb)
        .select()
        .from(accountVerifications)
        .where(
          and(
            eq(accountVerifications.accountSubject, principal),
            eq(accountVerifications.universityId, universityId),
          ),
        )
        .for("update");

      const record = rows[0];

      if (!record) return { ok: false as const, error: "NOT_PENDING" as ConsumeError };
      if (record.verified) return { ok: false as const, error: "ALREADY_VERIFIED" as ConsumeError };

      // Enumeration-safe: wrong address, no pending code, expired, and max
      // attempts all return the same INVALID_CODE to prevent oracle attacks.
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

      const expectedHmac = this.computeHmac(code);
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
          codeHmac: null,
          codeExpiresAt: null,
          attemptCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(accountVerifications.id, record.id));

      return { ok: true as const, universityId, accountSubject: principal };
    });

    return result;
  }

  /**
   * Return the verification status for a principal+university pair.
   * Returns null if no record exists (not yet initiated).
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

  private computeHmac(code: string): string {
    return createHmac("sha256", this.hmacKey).update(code, "utf8").digest("hex");
  }
}

// Timing-safe hex string comparison.  Both arguments are SHA-256 HMAC hex
// strings (always 64 chars), but we guard against length mismatches.
function hmacEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
