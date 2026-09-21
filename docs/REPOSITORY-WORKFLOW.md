# Repository workflow

## CI workflows

Frontend CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, typecheck, offline auth tests, build, and Playwright. Playwright starts a fresh production server on port 3001 unless `PLAYWRIGHT_PORT` is supplied. The integration worktree uses 3127; 3107 and 3113 are reserved for other parallel worktrees.

Backend CI (`.github/workflows/backend.yml`) is separate. It starts PostgreSQL with a random mapped host port, runs `npm run test:db`, applies committed migrations with Drizzle, and verifies that the seed CLI refuses an unconfirmed invocation. It does not provision a Neon project or seed a hosted environment.

Both workflows use read-only repository permissions and do not deploy. Playwright failure traces and screenshots are uploaded as failure artifacts.

## Local gates

```bash
npm run lint
npm run typecheck
npm run test:auth
npm run build
npm test
npm run test:db       # requires TEST_DATABASE_URL or the documented local Postgres
```

Use `PLAYWRIGHT_PORT=3127 npm test` when the integration worktree is sharing a machine with the other browser suites. Report exact commands and whether a check was local, hosted CI, mocked auth, or a configured-provider check. Do not claim live auth, mail delivery, database reads, or deployment from offline tests.

## Change ownership and merge order

Keep database, auth, UI, affiliation, private-draft, catalog integration, and deployment work in their scoped changes. The source checkpoints are database `e26e7ad4868683e9eaa4b83ea9eb194cc2acf31b`, auth `5fb5bc2c069f8a50ec453ac02885170dc993dcda`, and UI `d05e80a6a88e2e0fb489bb13c3a65639f99d849e`. User merges source PRs first. The final wiring is then reconciled against the updated `main` using a normal merge where allowed or a fresh final glue branch; preserve source authorship and avoid duplicate squashed cherry-picks.

Every change goes through a PR. Do not auto-merge, force-push, or deploy from an agent. A PR description should state the implemented behavior, demo-only limits, exact validation, and any unperformed hosted gates. Keep private planning, credentials, browser session data, and financial details out of commits and PRs.

## Deployment and rollback checklist

Before enabling a configured environment:

1. Confirm the target Neon branch contains the reviewed migration and has the correct environment-specific connection strings.
2. Apply migrations with the direct migration connection and inspect the resulting schema.
3. Seed only a named development/demo branch with fictional data after independently verifying the target.
4. Configure managed auth with a branch-specific endpoint, cookie secret, trusted origin, and tested mail policy.
5. Run the relevant backend, frontend, and configured-provider checks; record missing credentials or manual gates as unperformed.

Rollback means reverting application code through the normal PR process and forwarding a reviewed SQL migration when data changes require correction. This project does not promise automatic down migrations. Do not delete production data or copy production identities into preview/demo branches as a rollback shortcut.

## Stacked feature PR checks

Both test workflows run for every pull request base and pushes to `main` or `polly/**`. Push checks validate branch heads even when merge conflicts prevent GitHub from creating the PR merge ref. The label workflow uses `pull_request_target` and can succeed despite conflicts; label success is not test success. Source owners must resolve conflicts with their prerequisite branch and carry the workflow updates into their source branch before relying on these triggers. Integration changes do not retroactively update other open PRs.

Backend CI runs the private-draft script and runs affiliation when its script is present, so the same workflow supports independent source slices and the combined branch. Private draft tests are now mandatory in the integration workflow; affiliation is absent until its approved repair is integrated. Final integration must expose all landed service scripts and pass them.

Random PostgreSQL port URLs are configured in a step, where GitHub exposes `job.services`. Job-level `env` cannot access the `job` context; the earlier core checkpoint workflow failed before creating a database job for this reason. No PR-head code is run under `pull_request_target`.
