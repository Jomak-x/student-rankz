# Backend setup

The repository contains database and managed-auth foundations, but the public catalog still uses fixtures and the review composer still uses browser storage. No service, database branch, email sender, or deployment is provisioned by these instructions.

## Environment files

Copy `.env.example` to `.env` for the database scripts. Next.js also supports `.env.local` for local application overrides. Keep all values server-side and out of commits.

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | app and migration fallback | Pooled application connection |
| `DATABASE_DIRECT_URL` | migration tooling | Preferred direct migration connection |
| `TEST_DATABASE_URL` | `npm run test:db` | Ephemeral or local PostgreSQL test connection |
| `NEON_AUTH_BASE_URL` | managed auth | Exact provider endpoint for the selected branch |
| `NEON_AUTH_COOKIE_SECRET` | managed auth | Random server-only cookie secret, at least 32 characters |

Auth values may remain blank for the offline demo. Database values may remain blank until a database command or database-backed feature is exercised. Never use `NEXT_PUBLIC_` for these values. See [AUTH.md](./AUTH.md) for provider-specific setup and its live-service limitations.

## Database workflow

```bash
npm ci
npm run test:db
npm run db:migrate
SEED_SCOPE=development npm run db:seed -- --yes
```

`DATABASE_DIRECT_URL` takes precedence for migrations, then `DATABASE_URL`. The seed requires both an explicit `SEED_SCOPE` of `development` or `demo` and `--yes`. Verify the physical target yourself: a connection string cannot prove which Neon branch it names. The seed is repeatable, fictional, and never runs automatically.

The schema covers universities, programmes, courses, programme-course status, dated offerings, instructors, and offering-instructor links. Affiliation, application identity, private drafts, reviews, ratings, and moderation are separate pending work.

## Neon branch isolation

Use one Neon project with synthetic parent data for development, preview, and demo environments. A Neon branch copies existing auth identities and configuration from its parent, so never branch production identities into a non-production environment. Keep each environment's database URL, auth endpoint, and cookie secret separate. No branch or project is created by this repository.

## Email and deployment gates

The repository does not send live email, configure SMTP/Resend, deploy to Vercel, or enable a production auth provider. Before real traffic, an operator must configure the provider and trusted origins, choose the email-verification policy, validate cookie and branch isolation, confirm mail delivery, and run the configured-service checks in [AUTH.md](./AUTH.md). Password recovery and affiliation verification remain unclaimed until exercised against the configured service.

There is no public posting or moderation gateway. Do not treat a seeded directory as published student reviews or real ratings.
