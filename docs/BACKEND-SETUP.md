# Student Rankz — Backend Setup Plan

**Purpose:** what to provision today (accounts, DNS, secrets) while the frontend demo is built separately, and what engineering implements next. Budget context: the [$50–150/month technology allowance](CEO-DECISION-AND-ARCHITECTURE.md#8-cost-technology-first-founder-time-separate). Background: [CEO brief](CEO-BRIEF.md) · [current decision](CEO-DECISION-AND-ARCHITECTURE.md) · [research appendix](RESEARCH-APPENDIX.md).

## 1. Set up now (account owner)

- [ ] **Neon account** — create **two projects**, both in **AWS eu-central-1 (Frankfurt)**. Region is fixed at project creation and cannot be changed later ([Neon regions](https://neon.com/docs/introduction/regions)). `studentrankz-dev` for demo/preview, `studentrankz-prod` for real data. Use **branches** within each project for per-feature preview isolation.
- [ ] **Vercel account** — Hobby suffices while the demo is mock-only; Pro before public operation ([plan notes](CEO-DECISION-AND-ARCHITECTURE.md#4-lean-architecture)). Create the app project now so env vars have a home.
- [ ] **Resend account** (transactional email) — add a **sending subdomain** (e.g. `mail.<your-domain>`), add the issued DKIM/SPF/return-path DNS records at your registrar, then verify; optionally add DMARC. Resend recommends subdomains for reputation isolation ([Resend domains](https://resend.com/docs/dashboard/domains/introduction)). Choose the EU sending region; allow a few days for DNS.
- [ ] **AI gateway** (your existing gateway — provider is whatever it is) — record and keep privately: base URL, API token, exact **model IDs** for one cheap and one stronger model, quotas/rate limits, **data region, retention and training defaults**, and price per million tokens. Gateway access is not free inference and not an EU-processing guarantee ([decision §7](CEO-DECISION-AND-ARCHITECTURE.md#7-anonymity-and-minimum-launch-safeguards)). Do not send keys in chat; they go straight into Vercel.
- [ ] **Nothing else.** No Kubernetes, microservices, Redis or separate identity vault in week 1 — one app, one Postgres ([lean architecture](CEO-DECISION-AND-ARCHITECTURE.md#4-lean-architecture)).

## 2. Neon connections

- App/serverless traffic: **pooled** connection string (hostname with `-pooler` suffix, PgBouncer transaction mode).
- Migrations and `pg_dump`: **direct** (non-pooled) string — session-level `SET` and migration tooling are not reliable over the pooler ([Neon pooling](https://neon.com/docs/connect/connection-pooling)).
- Dev and prod use separate credentials; the region is visible in the hostname (…`eu-central-1.aws.neon.tech`).

## 3. Vercel environments and secrets

Store **all** secrets in Vercel, never in the repo and never in the frontend. Scope each variable to the right environment — Production, Preview, Development ([Vercel env docs](https://vercel.com/docs/environment-variables)). Preview deployments point at the **dev** project/branch, Production at **prod**; production credentials never appear in Preview. Env changes apply only to new deployments.

Variables below use **proposed names** (fake placeholder values). The Neon–Vercel integration may issue its own variable names — copy the integration's actual names and keep this table aligned.

| Proposed name | Secret? | Placeholder (fake) | Notes |
|---|---|---|---|
| `DATABASE_URL` | SECRET | `postgresql://USER:PASSWORD@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb` | pooled; app runtime |
| `DATABASE_DIRECT_URL` | SECRET | `postgresql://…@ep-xxx.eu-central-1.aws.neon.tech/neondb` | direct; migrations only, if the ORM needs it |
| `AUTH_SECRET` | SECRET | `<32+ random chars — name per chosen provider>` | session signing; exact name depends on §4 choice |
| `EMAIL_API_KEY` | SECRET | `re_EXAMPLE_ONLY` | Resend API key |
| `EMAIL_FROM` | public | `reviews@mail.example-domain.eu` | verified sending subdomain |
| `MODEL_GATEWAY_BASE_URL` | internal | `https://gateway.example.internal/v1` | never `NEXT_PUBLIC_` |
| `MODEL_GATEWAY_TOKEN` | SECRET | `gw_EXAMPLE_ONLY` | existing gateway credential |
| `MODERATION_MODEL` | public | `provider/cheap-model-id` | exact ID from gateway |
| `ESCALATION_MODEL` | public | `provider/strong-model-id` | exact ID from gateway |
| `MAIL_HMAC_SECRET` | SECRET | `<random 32+ chars>` | HMAC for mailbox dedup; kept outside the DB ([appendix §7](RESEARCH-APPENDIX.md#7-authentication-affiliation-and-anonymity)) |
| `WORKER_SECRET` | SECRET | `<random>` | authenticates cron/worker calls |

`NEXT_PUBLIC_*` values are **inlined into the client bundle at build time** ([Next.js docs](https://nextjs.org/docs/app/guides/environment-variables)) — use it only for genuinely public values (e.g. `NEXT_PUBLIC_APP_URL`). No database, gateway, mail, auth or HMAC secret may carry this prefix.

## 4. Authentication — provisional recommendation

**Primary: Neon Managed Better Auth** (formerly "Neon Auth"), pending a short day-1 integration check. Built on the mature open-source Better Auth library, it stores users/sessions in our own Neon database (identity data sits in Frankfurt with the rest), and auth state **branches with the database** — a natural fit for preview isolation; the free tier covers 60,000 MAU ([Neon Auth overview](https://neon.com/docs/auth/overview)).
**Check on day 1, before committing:** email sign-in, verification and password-reset support; roadmap gaps we cannot accept; no IP-Allow/Private-Networking dependency (unused by us).
**Fallback if a check fails:** self-host Better Auth in the Next.js server against the same Neon DB — same library and data location, full plugin set, slightly more ops. Do not pick a second managed vendor beyond this.

**University affiliation is a separate layer, not login.** Personal login email is independent; university-email verification adds a per-university membership record (approved exact domain + source evidence + verified date + expiry, proposed 6 months) via a single-use account-bound code. **"University email verified" means mailbox control — not current enrollment, attendance, or one person per mailbox.** Reviewers also declare first-hand participation ([decision §5](CEO-DECISION-AND-ARCHITECTURE.md#5-verification-and-source-data)). Expiry blocks new submissions; it never silently erases valid past reviews.

## 5. What engineering implements next

Conceptual schema (private tables; public pages read explicit projections only):

| Area | Records |
|---|---|
| Directory | university (ROR id, aliases), approved_email_domain (exact domain, evidence, status), programme (+version), programme_course (required/elective), course, offering (period/group/language), instructor, teaching_assignment |
| Identity (private) | account (auth provider ref), affiliation (account × university, domain, source, verified_at, expires_at, email_hmac) |
| Feedback (private) | review (target type/id, private author ref), immutable review_revision (dimension answers, text, state) |
| Moderation | outbox job (revision, state, model+policy versions, findings, retries), human decisions |
| Trust & safety | report, appeal |

Key invariants:

- **Atomic admission:** the immutable revision and its moderation job are written in one transaction — or neither exists.
- **Two-tier check, fail-closed:** every admitted revision runs local lexical flags, then the cheap gateway model; uncertain/serious/unsupported-language cases escalate to the stronger model. Timeout, malformed output or gateway outage ⇒ the revision stays unpublished.
- **Idempotent publish:** publishing re-checks revision currency, affiliation validity and deletion; retries cannot duplicate content.
- **Edit/delete races:** an edit is a new revision that is re-moderated; unreviewed text never replaces published text; deletion wins over in-flight worker results.

**Rankings honesty:** withhold ordered university scores until a proposed 20 distinct verified contributors per university; always show sample size and recency. These are voluntary, self-selected, one-person opinions — no method turns them into representative quality measures ([product direction](PRODUCT-DIRECTION.md#reviews-and-rankings)).

## 6. Wiring order

1. Neon projects + branches → 2. Vercel project + env table above → 3. Resend subdomain DNS → 4. auth day-1 check (§4) → 5. schema/migrations → 6. gateway model evaluation (language-quality tests) → 7. moderation worker + admin queue → 8. acceptance checks below.

**Acceptance checks before real submissions:**

1. **Verification replay/access:** a consumed or expired code cannot re-verify; an affiliation for university A does not authorize posting to university B; verification never grants login or account recovery.
2. **Prepublication fail-closed:** with the gateway unreachable or returning garbage, no revision publishes; jobs hold and retry without partial state.
3. **Private data containment:** public API responses, pages, error messages and logs contain no author identity, emails, HMACs, or pending/rejected text.

## 7. Cost shape

Stay broadly inside the [$50–150/month allowance](CEO-DECISION-AND-ARCHITECTURE.md#8-cost-technology-first-founder-time-separate): Vercel Pro, modest Neon usage, Resend (small tier) and gateway tokens. No moderation staffing is assumed — the founder handles exceptions; model spend is pennies per thousand reviews under the decision doc's illustrative calculation.
