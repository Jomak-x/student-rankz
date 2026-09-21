# Testing

Test the exact commit intended for review or deployment. Local checks, hosted CI, component previews, and real-provider tests establish different things; report each separately.

## Local checks

Use the repository's supported Node.js version and install the lockfile dependencies:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm test
```

The browser suite runs against a production build. Test totals change as features land; use the command output rather than a hardcoded count in documentation. Run the service test scripts supplied by the branch being tested, such as `test:db`, `test:auth`, `test:drafts`, `test:affiliation`, and `test:catalog`. Check `package.json` for the available commands; these are not all present on the frontend-only `main` branch.

Database tests must use disposable PostgreSQL and override every database connection variable consumed by child commands, including a direct connection override. Never run a test with production credentials in its environment.

## Browser coverage

Check both desktop and mobile, light and dark themes:

- Navigation, search, filters, detail pages, comparisons, and rankings.
- Missing configuration, empty database, unavailable database, and valid results.
- Sign-in and account navigation, private draft creation/edit/deletion, retry after failed saves, and stale-update handling.
- Verification pending, successful, expired, invalid-code, and rate-limited states once the feature is enabled.
- No horizontal overflow, inaccessible controls, misleading success messages, or unexpected browser errors.

The frontend prototype uses fixtures and local browser drafts. The integrated release must use database-backed pages and authenticated server-side drafts. Passing prototype tests does not establish backend readiness.

## Isolated automated tests

Use injected authentication and mail doubles only in test processes. No public route, environment switch, special account, or cookie may enable a production authentication bypass.

Service tests should cover ownership, cross-university targets, input validation, concurrent updates, repeated migrations, and seed idempotency. Verification tests should exercise expiry, code replay, cross-account attempts, recipient throttles, concurrent sends, and mail failures without sending real email.

Component preview screenshots can show mocked states when clearly labelled. They demonstrate layout and interactions, not a successful live login, database save, or delivered email.

## Hosted CI

Before marking a PR ready, confirm the current head's required frontend and backend checks have completed successfully. A labeler job alone does not validate code. If checks do not appear, inspect merge conflicts and workflow events rather than treating missing jobs as passed.

Use ordinary `pull_request` CI with least-privilege permissions for PR code. Do not execute untrusted PR code in a privileged `pull_request_target` context. Checkouts used for tests should not persist repository credentials.

See [REPOSITORY-WORKFLOW.md](REPOSITORY-WORKFLOW.md) for repository workflow details. Feature PRs must actually invoke their service suites; a passing database foundation test does not cover drafts or verification automatically.

## Configured demo acceptance

After the reviewed integration is available and services are configured:

1. Confirm Vercel points to the synthetic demo database and that branch's managed Auth endpoint.
2. Apply migrations and explicitly seed the demo branch using the release's documented commands. Repeat the operations to verify the documented behavior without duplicating data.
3. Browse synthetic universities, courses, instructors, comparisons, and student-experience rankings. Confirm scores come from stored sample ratings and that demo data is labelled.
4. Sign up, sign in, sign out, and exercise password reset with real managed Auth. Confirm protected actions fail after session revocation as documented.
5. Complete university-email verification using an authorized test mailbox and its approved domain. Verify expired or replayed codes fail and that one university's verification grants no other affiliation.
6. Save, reload, edit, and delete a private draft. Use a second account to confirm it cannot access that draft. Failed saves must retain input and must not show success.
7. Confirm private drafts never appear publicly or change public ranking totals. Public submission and AI moderation remain unavailable.
8. Confirm the deployed app has no test authentication bypass and no production identities in the demo branch.

Use Resend's [documented test addresses](https://resend.com/docs/dashboard/emails/send-test-emails) to simulate delivery events. Those simulations do not prove that a real mailbox received a message or that its verification link/code works. Live email acceptance needs an actual authorized recipient, correct dashboard-provided DNS records, and confirmed domain verification. Do not invent a separate sandbox API key or claim DNS is verified before checking it.

## Production acceptance

After the approved release deploys:

- Confirm the intended commit, production database branch, Auth endpoint, and exact origin.
- An empty production database must show empty states, not fixture universities, ratings, or demo review content.
- Check public reading and the configured sign-in flow. Use a controlled account for private actions and remove test content afterward where appropriate.
- Confirm no production seeding, test credentials, verification codes, connection strings, or private account data appear in public pages or logs.
- Record any live checks not performed. Do not describe an unconfigured or mock-tested integration as verified in production.

## Troubleshooting

**Port already in use:** inspect the listening process and its owner with `lsof -nP -iTCP:3001 -sTCP:LISTEN`. Stop only the development/test server you identify, preferably with Ctrl+C in its owning terminal. Do not kill every process on a port. Where supported by the branch's Playwright configuration, set `PLAYWRIGHT_PORT` to an unused port.

**Service unavailable:** check configuration and provider status without printing secrets. Preserve the distinction between an empty database and a failed connection. Never add fixture fallbacks or weaken authentication to make a test pass.

**Failed migration:** stop the release, retain the error and migration state, and investigate on a disposable database. Do not delete production schema objects or edit applied migrations to silence an error.

**Missing CI jobs:** inspect the PR's current mergeability and workflow configuration. Report the precise missing check; do not infer success from a clean local build.
