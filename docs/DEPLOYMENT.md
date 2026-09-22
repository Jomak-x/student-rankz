# Deployment

Use one Neon project: production starts empty, while demo and development branches descend only from synthetic parents. No build, startup, Vercel hook, or deployment may migrate or seed a database.

## Vercel setup

Enable Git deployments, select Node.js 22, and set the build command to `npm run build`. Configure every environment with server-side values only:

| Variable | Required use |
| --- | --- |
| `DATABASE_URL` | Runtime database connection |
| `DATABASE_DIRECT_URL` | Direct migration connection; falls back to `DATABASE_URL` |
| `DATABASE_TRANSPORT` | `neon-http` for catalog reads by default; `postgres` for standard PostgreSQL |
| `NEON_AUTH_BASE_URL` | Exact Managed Auth branch endpoint |
| `NEON_AUTH_COOKIE_SECRET` | Branch-specific auth cookie secret |
| `APP_ORIGIN` | Exact browser origin, without path or trailing slash |
| `AFFILIATION_HMAC_SECRET` | At least 32 characters; binds verification codes |
| `RESEND_API_KEY`, `RESEND_FROM` | Authorized Resend delivery configuration |
| `CRON_SECRET` | At least 32 characters with no whitespace; authorizes maintenance cron |
| `CATALOG_MODE` | `demo` only on the explicitly synthetic demo branch |

Never expose these through `NEXT_PUBLIC_*`. There is no mocked production-auth bypass. Production uses real provider configuration and an initially empty catalog.

## Release steps

1. Keep PR #9 as a draft until its final delta has final independent integration review and user approval. Sources `b5fb0c9` and `eed5dc9` are independently approved; that does not approve the final integrated delta.
2. Apply the final migration outside deployment automation:

   ```bash
   npm run db:migrate
   ```

   This applies the consolidated migration sequence `0000_old_iron_fist`, `0001_private_drafts`, `0002_demo_public_reviews`, and `0003_affiliation`. Migration `0003` creates `university_domains`, `account_verifications`, and `recipient_send_log`.
3. Populate `university_domains` only through manually reviewed operator SQL. It must select an existing university row and use the table defaults for `id` and `created_at`; never generate a UUID or infer a university from an email claim.

   ```sql
   -- Replace both reviewed values after confirming the university controls the domain.
   INSERT INTO public.university_domains (university_id, domain, active)
   SELECT id, 'students.reviewed-university.edu', true
   FROM public.universities
   WHERE slug = 'reviewed-university-slug';
   ```

   This is an operator procedure, not deployment automation. Synthetic `.example` domains cannot receive mail.
4. Configure Resend and its DNS records with an authorized sender. Verify delivery only through an authorized mailbox; no delivery or DNS result is claimed by this repository.
5. Deploy via approved Git change and complete the configured acceptance gate in [TESTING.md](TESTING.md). Do not seed production.

## Explicit synthetic demo seeding

Run these only after the operator verifies a synthetic demo target. Neither command runs during builds or deploys.

```bash
SEED_SCOPE=demo npm run db:seed -- --yes
SEED_SCOPE=demo npm run db:seed:demo -- --yes --acknowledge-demo-data
```

`db/seed-cli.ts` loads `.env` when present. `db/demo-ratings-seed-cli.ts` does not, so provide `DATABASE_URL` through an exported variable or load it explicitly:

```bash
SEED_SCOPE=demo node --env-file=.env --import tsx db/demo-ratings-seed-cli.ts --yes --acknowledge-demo-data
```

The ratings command rejects production-looking runtimes but cannot prove that a URL targets a demo database. The operator must verify the target before running either command.

## Daily recipient-ledger cleanup

`vercel.json` schedules `GET /api/internal/affiliation-cleanup` at `0 4 * * *`. The endpoint accepts only `Authorization: Bearer <CRON_SECRET>`: no query parameters or body. It returns `200 {"deleted":N}` or generic `401`, `503`, or `400` errors; `HEAD` returns `405` and does not run cleanup.

The cleanup uses the database clock to delete only `recipient_send_log` entries at least one hour old. It retains pending and verified `account_verifications` and has no caller-controlled recipient or retention cutoff. On Hobby, Vercel permits once-daily jobs and executes with hour-level precision, so a normal sweep can retain reservations for roughly 26 hours; missed jobs can extend retention. It does not promise one-hour deletion. See [Vercel cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) and [cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

For a repeatable manual sweep, explicitly export the target URL and confirm it before invoking the existing CLI:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE'
npm run affiliation:cleanup -- --yes
```

The command runs `server/affiliation/cleanup-cli.ts`, does not load `.env`, requires exactly `--yes`, and accepts no recipient or cutoff argument.

## Rollback

Use a reviewed revert PR for code. Recover data through a separately reviewed forward migration; never push directly to `main` or delete production data as a rollback shortcut.
