-- Affiliation feature migration.
--
-- Apply AFTER: drizzle/0000_old_iron_fist.sql  (base directory schema).
-- Integration order: this becomes 0001_affiliation in the Drizzle journal
-- once the base foundation PR is merged.
--
-- Safe to apply to a fresh database; use IF NOT EXISTS guards for tables and
-- indexes. FK constraints are added unconditionally because each run targets
-- a freshly-created test database or a first-time migration on a new server.

CREATE TABLE IF NOT EXISTS "university_domains" (
    "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "university_id" uuid    NOT NULL,
    "domain"        text    NOT NULL,
    "active"        boolean NOT NULL DEFAULT true,
    "created_at"    timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "university_domains_domain_unique"
        UNIQUE ("domain"),
    CONSTRAINT "university_domains_domain_format_check"
        CHECK ("domain" ~ '^[a-z0-9][a-z0-9\-]*(\.[a-z0-9][a-z0-9\-]*)+$')
);

CREATE TABLE IF NOT EXISTS "account_verifications" (
    "id"                   uuid     PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "account_subject"      text     NOT NULL,
    "university_id"        uuid     NOT NULL,
    "email_address"        text     NOT NULL,
    "code_hmac"            text,
    "code_expires_at"      timestamp with time zone,
    "attempt_count"        smallint NOT NULL DEFAULT 0,
    "send_count"           smallint NOT NULL DEFAULT 0,
    "send_window_starts_at" timestamp with time zone DEFAULT now() NOT NULL,
    "verified"             boolean  NOT NULL DEFAULT false,
    "verified_at"          timestamp with time zone,
    "created_at"           timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"           timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "account_verifications_account_university_unique"
        UNIQUE ("account_subject", "university_id"),
    CONSTRAINT "account_verifications_attempt_count_check"
        CHECK ("attempt_count" >= 0),
    CONSTRAINT "account_verifications_send_count_check"
        CHECK ("send_count" >= 0)
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
