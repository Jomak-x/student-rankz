# Testing

Run checks against the exact integration commit. These commands have not been run as live deployment validation.

## Application checks

```bash
npm ci
npm run lint
npm run typecheck
npm run build
PLAYWRIGHT_PORT=3127 npm test
```

The Playwright suite uses the production build. Port `3127` avoids the other local worktree ports.

## Ephemeral PostgreSQL suites

Use disposable PostgreSQL only. The test helper creates and drops isolated databases on the server named by `TEST_DATABASE_URL`; point it only at an ephemeral test server.

```bash
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:63346/postgres
npm run test:db
npm run test:auth
npm run test:drafts
npm run test:catalog
npm run test:migrations
npm run test:integration
```

`test:integration` requires a prior production build and provisions migrated demo, empty, and unavailable database states. It checks database-backed catalog routes and their honest availability states. Affiliation has no test command because that feature remains unavailable pending approval.

## What the checks establish

- `test:db` and `test:migrations` exercise the consolidated Drizzle journal and seed behavior.
- `test:catalog` verifies bounded public catalog queries and synthetic sample-rating projections.
- `test:drafts` verifies authenticated private drafts, ownership, validation, retries, revisions, and deletion.
- `test:auth` checks the configured SDK boundary with test doubles.
- Browser tests cover the public catalog, ranking rows, compare behavior, and unavailable/empty states.

Passing local or mocked checks does not validate Neon, managed Auth, email, affiliation, deployment, or production data. Draft-service fixtures and mocked-auth tests are not live validation. Record those as unperformed until they are actually checked.

## Configured manual acceptance

This is an operator gate and is unperformed until recorded against the configured deployment.

1. With an authorized managed-auth account, verify sign-in, sign-out, password reset, and that session revocation removes access to private drafts.
2. Use two separate accounts: create, reload, edit, and delete a draft as the first account; confirm the second account cannot read, edit, or delete it.
3. After affiliation is approved and implemented, configure Resend DNS once from the provider dashboard and verify the flow with an authorized mailbox. Affiliation remains unavailable today.
