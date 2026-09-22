# Repository workflow

Every change goes through a PR. Agents do not auto-merge, force-push, deploy, or claim hosted validation from local checks.

## CI

Frontend CI runs `npm ci`, lint, typecheck, offline auth tests, build, and Playwright. Backend CI retains its current database, migration, seed-safety, draft, and catalog suites and makes `npm run test:affiliation` and `npm run test:verification-integration` mandatory. The verification integration suite uses real PostgreSQL with mocked external auth SDK and mail transport. CI does not provision Neon, Resend, DNS, Vercel cron, or a production auth bypass.

Use `PLAYWRIGHT_PORT=3127 npm test` in this integration worktree. Report exact commands and distinguish local, CI, mocked, and configured-provider evidence.

## Final merge path

Retain source provenance, including recipient-ledger source `6684364`, independently approved cleanup source `b5fb0c9`, and independently approved catalog source `eed5dc9`, but do not merge or cherry-pick their patches separately. Preserve the approved `55aad06` deployment/testing provenance. After final independent integration review and user approval, merge only PR #9 and close source PRs as superseded to avoid duplicate patches.

PR #9's final delta is a draft pending final independent integration review and user approval. Managed Auth, Resend/DNS, authorized mailboxes, and cron must be configured before the configured acceptance gate.
