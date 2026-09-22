# Testing

Run checks against the exact PR #9 head. They establish local behavior, not configured-provider or production readiness.

```bash
npm ci
npm run lint
npm run typecheck
npm run build
PLAYWRIGHT_PORT=3127 npm test
```

Use an ephemeral PostgreSQL server for service suites:

```bash
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:63346/postgres
npm run test:db
npm run test:auth
npm run test:drafts
npm run test:catalog
npm run test:migrations
npm run test:affiliation
npm run test:verification-integration
npm run test:integration
```

`test:affiliation` and `test:verification-integration` are mandatory in backend CI alongside the existing database, auth, draft, catalog, migration, frontend, and integration suites. `test:verification-integration` uses `vitest run --config vitest.integration.config.mts` with real PostgreSQL and mocked external Managed Auth SDK and mail transport. Test transports and fixtures are test-only; there is no production auth or mail bypass.

The verification HTTP suite checks the 4,096-byte JSON body limit; exact initiate and consume bodies; current-subject-only status pages; a maximum 50-item list with `hasMore`/`nextOffset`; `offset <= 10000`; and the cleanup route's no-query/no-body boundary, generic failures, and `HEAD 405` behavior.

## Configured manual acceptance

This gate is unperformed until an operator records it against the configured deployment.

1. Use an authorized Managed Auth account to verify sign-in, sign-out, password reset, and session revocation removes private draft and verification access.
2. Use two accounts: create, reload, edit, and delete a draft with one; confirm the other cannot read, update, or delete it.
3. With a curated, active `university_domains` entry and an authorized mailbox, initiate verification with `{ "email" }`, consume with `{ "email", "code" }`, and check the signed-in account's status pages. Verify invalid, expired, replayed, and rate-limited codes fail safely.
4. Confirm the daily cleanup endpoint receives only authenticated cron calls, reports only a deleted count, returns `405` for `HEAD`, and retains pending and verified verification records.

No live Neon, Resend, DNS, cron, or production result is claimed until checked.
