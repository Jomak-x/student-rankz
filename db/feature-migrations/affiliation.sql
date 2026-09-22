-- Affiliation feature migration.
--
-- Apply AFTER: drizzle/0000_old_iron_fist.sql  (base directory schema).
-- Integration order: this becomes 0001_affiliation in the Drizzle journal
-- once the base foundation PR is merged.
--
-- Safe to apply to a fresh database; CREATE TABLE / INDEX use IF NOT EXISTS.
-- FK constraints are unconditional (run against a first-time migration only).

CREATE TABLE IF NOT EXISTS "university_domains" (
    "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "university_id" uuid    NOT NULL,
    "domain"        text    NOT NULL,
    "active"        boolean NOT NULL DEFAULT true,
    "created_at"    timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "university_domains_domain_unique"
        UNIQUE ("domain"),
    -- Strict domain format:
    --   Each label: starts and ends with [a-z0-9]; hyphens only in the middle.
    --   Requires at least two labels (one dot).
    --   Pure-IPv4 addresses (all-numeric labels) are explicitly rejected.
    -- The double backslash (\.) in the SQL source is a literal-dot in
    -- PostgreSQL POSIX regex.
    CONSTRAINT "university_domains_domain_format_check"
        CHECK (
            "domain" ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?)(\.([a-z0-9]([a-z0-9-]*[a-z0-9])?))+$'
            AND "domain" !~ '^[0-9]+(\.[0-9]+){3}$'
        )
);

CREATE TABLE IF NOT EXISTS "account_verifications" (
    "id"                    uuid     PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "account_subject"       text     NOT NULL,
    "university_id"         uuid     NOT NULL,
    "email_address"         text     NOT NULL,
    -- Per-challenge UUID; regenerated on every initiate.
    "challenge_id"          uuid,
    -- 'pending': HMAC written, email not yet confirmed delivered.
    -- 'sent':    confirmed delivered; consume() may proceed.
    -- NULL:      no active challenge.
    "delivery_state"        text,
    "code_hmac"             text,
    "code_expires_at"       timestamp with time zone,
    "attempt_count"         smallint NOT NULL DEFAULT 0,
    "send_count"            smallint NOT NULL DEFAULT 0,
    "send_window_starts_at" timestamp with time zone DEFAULT now() NOT NULL,
    "verified"              boolean  NOT NULL DEFAULT false,
    "verified_at"           timestamp with time zone,
    "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"            timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "account_verifications_account_university_unique"
        UNIQUE ("account_subject", "university_id"),
    CONSTRAINT "account_verifications_attempt_count_check"
        CHECK ("attempt_count" >= 0),
    CONSTRAINT "account_verifications_send_count_check"
        CHECK ("send_count" >= 0),
    CONSTRAINT "account_verifications_delivery_state_check"
        CHECK ("delivery_state" IS NULL OR "delivery_state" IN ('pending', 'sent'))
);

ALTER TABLE "university_domains"
    ADD CONSTRAINT "university_domains_university_id_universities_id_fk"
    FOREIGN KEY ("university_id")
    REFERENCES "universities"("id")
    ON DELETE CASCADE;

ALTER TABLE "account_verifications"
    ADD CONSTRAINT "account_verifications_university_id_universities_id_fk"
    FOREIGN KEY ("university_id")
    REFERENCES "universities"("id")
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "university_domains_university_idx"
    ON "university_domains" ("university_id");

CREATE INDEX IF NOT EXISTS "university_domains_domain_active_idx"
    ON "university_domains" ("domain", "active");

CREATE INDEX IF NOT EXISTS "account_verifications_subject_idx"
    ON "account_verifications" ("account_subject");

CREATE INDEX IF NOT EXISTS "account_verifications_university_idx"
    ON "account_verifications" ("university_id");

-- Partial index for per-email recipient throttle lookups.
CREATE INDEX IF NOT EXISTS "account_verifications_email_delivery_idx"
    ON "account_verifications" ("email_address", "delivery_state");

-- Immutable send log for per-email recipient throttling.
-- Independent of the mutable account_verifications row: address changes
-- and new challenges do NOT erase these entries.  Pruned after 1 hour.
CREATE TABLE IF NOT EXISTS "recipient_send_log" (
    "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "recipient_email" text NOT NULL,
    "challenge_id"    uuid NOT NULL,
    "sent_at"         timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "recipient_send_log_email_sent_idx"
    ON "recipient_send_log" ("recipient_email", "sent_at");

CREATE INDEX IF NOT EXISTS "recipient_send_log_challenge_idx"
    ON "recipient_send_log" ("challenge_id");

CREATE INDEX IF NOT EXISTS "recipient_send_log_sent_idx"
    ON "recipient_send_log" ("sent_at");
