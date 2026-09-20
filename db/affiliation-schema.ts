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
    // Normalized domains must look like multi-label hostnames: at least one dot,
    // lowercase alphanumeric labels, hyphens allowed mid-label.
    check(
      "university_domains_domain_format_check",
      sql`${t.domain} ~ '^[a-z0-9][a-z0-9\-]*(\.[a-z0-9][a-z0-9\-]*)+$'`,
    ),
  ],
);

// Per-account, per-university verification state.
//
// Bound to a specific email address under the account: mail-control, not
// enrollment. Resend invalidates the previous code. The HMAC is cleared on
// successful consume and on send failure so no stale secret material lingers.
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
    emailAddress: text().notNull(),
    // HMAC-SHA256 hex of the current verification code; null when none is pending.
    codeHmac: text(),
    codeExpiresAt: timestamp({ withTimezone: true }),
    // Consecutive failed consume attempts on the current code.
    attemptCount: smallint().notNull().default(0),
    // Number of codes sent within the current rolling hourly send window.
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
    check(
      "account_verifications_attempt_count_check",
      sql`${t.attemptCount} >= 0`,
    ),
    check(
      "account_verifications_send_count_check",
      sql`${t.sendCount} >= 0`,
    ),
  ],
);
