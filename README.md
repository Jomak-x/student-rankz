# Student Rankz

Student Rankz is a Next.js application for university, course, and instructor reviews. Public catalog pages use database reads. Production starts empty; explicit demo branches use synthetic catalog rows and sample ratings. Private drafts and university-email verification use authenticated server APIs. Public posting and AI moderation are deferred.

## Local checks

```bash
npm ci
npm run lint
npm run typecheck
npm run build
PLAYWRIGHT_PORT=3127 npm test
```

For disposable database suites, export `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:63346/postgres` and run `test:db`, `test:auth`, `test:drafts`, `test:catalog`, `test:migrations`, `test:affiliation`, `test:verification-integration`, and `test:integration` as applicable. See [docs/TESTING.md](docs/TESTING.md).

## Runtime and release boundary

`DATABASE_URL` is required by runtime database features. Catalog reads default to `DATABASE_TRANSPORT=neon-http`; set `postgres` for standard PostgreSQL. Affiliation verification uses a transaction-capable Neon WebSocket adapter by default, or node-postgres when `DATABASE_TRANSPORT=postgres`.

Set branch-specific Managed Auth and draft origin values: `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and exact `APP_ORIGIN`. Affiliation also requires `AFFILIATION_HMAC_SECRET` (at least 32 characters), `RESEND_API_KEY`, and `RESEND_FROM`; scheduled cleanup requires `CRON_SECRET` (at least 32 characters, no whitespace).

Run `npm run db:migrate` outside builds and deploys. The final PR #9 migration `0003` creates `university_domains`, `account_verifications`, and `recipient_send_log`. Demo seeding is explicit and never runs in builds or deployments. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/AFFILIATION.md](docs/AFFILIATION.md), and [docs/INTEGRATION.md](docs/INTEGRATION.md).

Sources `b5fb0c9` and `eed5dc9` are independently approved. PR #9 is the sole merge candidate after final independent integration review and user approval; source PRs are closed as superseded. No live provider, delivery, cron, or production claim is made here.
