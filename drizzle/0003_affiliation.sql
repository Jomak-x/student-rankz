-- Consolidate the affiliation asset, including the durable send log.
-- Share the feature runner's lock through DDL, validation and tracking writes.
SELECT pg_advisory_xact_lock(5731);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.feature_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.feature_migrations WHERE filename = 'affiliation.sql') THEN
    CREATE TABLE "account_verifications" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "account_subject" text NOT NULL,
      "university_id" uuid NOT NULL,
      "email_address" text NOT NULL,
      "challenge_id" uuid,
      "delivery_state" text,
      "code_hmac" text,
      "code_expires_at" timestamp with time zone,
      "attempt_count" smallint DEFAULT 0 NOT NULL,
      "send_count" smallint DEFAULT 0 NOT NULL,
      "send_window_starts_at" timestamp with time zone DEFAULT now() NOT NULL,
      "verified" boolean DEFAULT false NOT NULL,
      "verified_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "account_verifications_account_university_unique" UNIQUE("account_subject","university_id"),
      CONSTRAINT "account_verifications_attempt_count_check" CHECK ("account_verifications"."attempt_count" >= 0),
      CONSTRAINT "account_verifications_send_count_check" CHECK ("account_verifications"."send_count" >= 0),
      CONSTRAINT "account_verifications_delivery_state_check" CHECK ("account_verifications"."delivery_state" IS NULL OR "account_verifications"."delivery_state" IN ('pending', 'sent'))
    );

    CREATE TABLE "recipient_send_log" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "recipient_email" text NOT NULL,
      "challenge_id" uuid NOT NULL,
      "sent_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "university_domains" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "university_id" uuid NOT NULL,
      "domain" text NOT NULL,
      "active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "university_domains_domain_unique" UNIQUE("domain"),
      CONSTRAINT "university_domains_domain_format_check" CHECK ("university_domains"."domain" ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?)(\.([a-z0-9]([a-z0-9-]*[a-z0-9])?))+$'
              AND "university_domains"."domain" !~ '^[0-9]+(\.[0-9]+){3}$')
    );

    ALTER TABLE "account_verifications" ADD CONSTRAINT "account_verifications_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "university_domains" ADD CONSTRAINT "university_domains_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "account_verifications_subject_idx" ON "account_verifications" USING btree ("account_subject");
    CREATE INDEX "account_verifications_university_idx" ON "account_verifications" USING btree ("university_id");
    CREATE INDEX "account_verifications_email_delivery_idx" ON "account_verifications" USING btree ("email_address","delivery_state");
    CREATE INDEX "recipient_send_log_email_sent_idx" ON "recipient_send_log" USING btree ("recipient_email","sent_at");
    CREATE INDEX "recipient_send_log_challenge_idx" ON "recipient_send_log" USING btree ("challenge_id");
    CREATE INDEX "university_domains_university_idx" ON "university_domains" USING btree ("university_id");
    CREATE INDEX "university_domains_domain_active_idx" ON "university_domains" USING btree ("domain","active");

    INSERT INTO public.feature_migrations (filename) VALUES ('affiliation.sql');
  ELSE
    -- Older, unreviewed assets shared this filename but had no durable log.
    -- Never mark those installations complete or fabricate an empty ledger:
    -- that would erase the evidence needed to enforce recipient throttles.
    IF to_regclass('public.recipient_send_log') IS NULL THEN
      RAISE EXCEPTION 'Unsupported tracked affiliation.sql schema: recipient_send_log is missing; explicit reconciliation required';
    END IF;
    PERFORM id, recipient_email, challenge_id, sent_at FROM public.recipient_send_log LIMIT 0;
    PERFORM id, university_id, domain, active, created_at FROM public.university_domains LIMIT 0;
    PERFORM id, account_subject, university_id, email_address, challenge_id,
      delivery_state, code_hmac, code_expires_at, attempt_count, send_count,
      send_window_starts_at, verified, verified_at, created_at, updated_at
      FROM public.account_verifications LIMIT 0;
    IF (SELECT count(*) FROM pg_index
        WHERE indrelid = 'public.recipient_send_log'::regclass AND indisvalid
          AND indexrelid IN (to_regclass('public.recipient_send_log_email_sent_idx'),
                             to_regclass('public.recipient_send_log_challenge_idx'))) <> 2 THEN
      RAISE EXCEPTION 'Unsupported tracked affiliation.sql schema: recipient send log indexes are missing; explicit reconciliation required';
    END IF;
  END IF;
END
$migration$;
