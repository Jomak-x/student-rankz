# University affiliation verification

PR #9 wires authenticated university-email verification. It proves mailbox control for a vetted domain; it does not prove enrollment, authorize public posting, or change catalog scores.

## Account flow

The signed-in account pages call `POST /api/affiliation/initiate` with exactly `{ "email": "..." }`, `POST /api/affiliation/consume` with exactly `{ "email": "...", "code": "..." }`, and `GET /api/affiliation?offset=N` for the current account's status pages. Write bodies are JSON only, have a 4,096-byte limit, and reject query strings and extra fields. The server takes the account subject from Managed Auth, never from a request body. Codes are HMAC-bound to subject, university UUID, normalized email, and code; delivery must be confirmed before consumption.

The status list contains at most 50 current-subject records, plus `hasMore` and `nextOffset`; `offset` is the only list parameter and cannot exceed 10,000. A caller cannot read another subject's verification history.

`university_domains` is a curated registry. A trusted operator must review and run inserts that use an existing university UUID and a real vetted domain, for example:

```sql
INSERT INTO university_domains (university_id, domain, active)
VALUES ('<existing-university-uuid>', 'students.real-university.edu', true);
```

Do not generate an ID, infer a university from email input, or treat synthetic `.example` domains as deliverable.

## Runtime and migration

`AFFILIATION_HMAC_SECRET` must contain at least 32 characters. `RESEND_API_KEY` and `RESEND_FROM` are required for the production Resend adapter. The service uses interactive Neon WebSocket transactions by default, or node-postgres when `DATABASE_TRANSPORT=postgres`; catalog reads can keep using default neon-http.

The final integration migration `0003` creates `university_domains`, `account_verifications`, and `recipient_send_log`. Do not run migrations as part of build or deployment.

## Recipient-ledger maintenance

`recipient_send_log` reserves recipient send capacity and records a database-clock timestamp. The cleanup removes only entries at least one hour old. It retains pending and verified `account_verifications`, and accepts no caller-provided recipient or cutoff.

The endpoint is exactly `GET /api/internal/affiliation-cleanup`. It requires `Authorization: Bearer <CRON_SECRET>`, accepts no query string or body, and returns `200 {"deleted":N}` or generic `401`, `503`, or `400`. `HEAD` returns `405` and never runs cleanup. `CRON_SECRET` must contain at least 32 characters and no whitespace.

The final `vercel.json` schedule is `0 4 * * *`. On Hobby, Vercel schedules at most once a day and can run within the scheduled hour. A routine sweep therefore normally retains old ledger entries for about 26 hours; missed runs can retain longer. It is not a one-hour deletion promise. See [Vercel cron pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) and [cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

For an explicit operator sweep, export `DATABASE_URL`, verify its target, then run `npm run affiliation:cleanup -- --yes`. The CLI requires that URL and `--yes`, accepts no recipient/cutoff arguments, does not load `.env`, and reports only an aggregate deletion count.

## Readiness

The cleanup source [`b5fb0c9`](https://github.com/Jomak-x/student-rankz/commit/b5fb0c975ddcde84578c33b1fec89489beae263b) is independently approved by Sonnet. The final PR #9 delta still requires final independent integration review and user approval after Managed Auth, Resend/DNS, sender/mailbox, and cron are configured. No live delivery or production readiness is claimed.
