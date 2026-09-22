import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Immutable send log for per-email recipient throttling.
// Each row records one send attempt; address changes and new challenges in
// account_verifications do NOT erase these entries.  Pruned after 1 hour.
export const recipientSendLog = pgTable(
  "recipient_send_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    recipientEmail: text().notNull(),
    challengeId: uuid().notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("recipient_send_log_email_sent_idx").on(t.recipientEmail, t.sentAt),
    index("recipient_send_log_challenge_idx").on(t.challengeId),
  ],
);

import { universities } from "./schema";

// Curated registry of approved email domains per university.
// Each domain entry maps exactly to one university; no suffix matching is ever used.
// Domains are normalized to lowercase IDNA form before storage and lookup.
export const universityDomains = pgTable(
  "university_domains",
  {
    id: uuid().primaryKey().defaultRandom(),
    universityId: uuid()
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    // Normalized lowercase IDNA hostname (e.g. "student.uva.nl").
    domain: text().notNull(),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("university_domains_domain_unique").on(t.domain),
    index("university_domains_university_idx").on(t.universityId),
    index("university_domains_domain_active_idx").on(t.domain, t.active),
    // Strict domain format:
    //   • Each label starts and ends with an alnum character; hyphens only inside.
    //   • At least two labels (dot required).
    //   • All lowercase alphanumeric — service normalizes before insert.
    //   • Pure-IPv4 addresses rejected by the second sub-expression.
    // Note: `\\.` inside a JS template literal produces `\.` in the SQL string,
    // which is a literal-dot match in PostgreSQL POSIX regex.
    check(
      "university_domains_domain_format_check",
      sql`${t.domain} ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?)(\\.([a-z0-9]([a-z0-9-]*[a-z0-9])?))+$'
          AND ${t.domain} !~ '^[0-9]+(\\.[0-9]+){3}$'`,
    ),
  ],
);

// Per-account, per-university verification state.
//
// One row per (account_subject, university_id).  The challenge lifecycle uses
// three fields that work together atomically:
//
//   challenge_id    — UUID regenerated on every initiate; scopes failure cleanup.
//   code_hmac       — HMAC-SHA256 of (subject ‖ universityId ‖ email ‖ code).
//   delivery_state  — 'pending' while email is in-flight; 'sent' once confirmed.
//
// consume() only accepts a challenge when delivery_state = 'sent', preventing
// consumption before the email is confirmed delivered.  The failure-cleanup
// UPDATE uses WHERE challenge_id = X AND delivery_state = 'pending', so it
// cannot clobber a newer challenge written by a concurrent resend.
export const accountVerifications = pgTable(
  "account_verifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Opaque provider subject string from the auth layer.
    // Set by the server; never inferred from the request body.
    accountSubject: text().notNull(),
    universityId: uuid()
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    // Specific email address being verified for this account+university pair.
    // Immutable once verified=true (initiate blocks on the FOR UPDATE lock and
    // returns ALREADY_VERIFIED before touching the row).
    emailAddress: text().notNull(),
    // Per-challenge identity.  Regenerated on every initiate; used to scope
    // the delivery confirmation and failure-cleanup UPDATEs.
    challengeId: uuid(),
    // 'pending': HMAC written, email not yet confirmed sent.
    // 'sent':    email confirmed delivered; consume() may proceed.
    // null:      no active challenge (post-consume, post-failure, or fresh row).
    deliveryState: text(),
    // HMAC-SHA256 hex of (subject ‖ universityId ‖ email ‖ code).
    // null when no challenge is active.
    codeHmac: text(),
    codeExpiresAt: timestamp({ withTimezone: true }),
    // Consecutive failed consume attempts on the current challenge.
    attemptCount: smallint().notNull().default(0),
    // Codes sent within the current rolling hourly send window (per account).
    sendCount: smallint().notNull().default(0),
    sendWindowStartsAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    verified: boolean().notNull().default(false),
    verifiedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("account_verifications_account_university_unique").on(
      t.accountSubject,
      t.universityId,
    ),
    index("account_verifications_subject_idx").on(t.accountSubject),
    index("account_verifications_university_idx").on(t.universityId),
    // Partial index for per-email throttle lookups (best-effort).
    index("account_verifications_email_delivery_idx").on(
      t.emailAddress,
      t.deliveryState,
    ),
    check(
      "account_verifications_attempt_count_check",
      sql`${t.attemptCount} >= 0`,
    ),
    check(
      "account_verifications_send_count_check",
      sql`${t.sendCount} >= 0`,
    ),
    check(
      "account_verifications_delivery_state_check",
      sql`${t.deliveryState} IS NULL OR ${t.deliveryState} IN ('pending', 'sent')`,
    ),
  ],
);
