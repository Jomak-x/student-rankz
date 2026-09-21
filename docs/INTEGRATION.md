# Integration checkpoint

This checkpoint joins the database foundation, managed auth, and frontend source work while keeping their ownership boundaries explicit. The public UI currently remains a fixture demo, and the review composer remains local-only. Private draft API and account management are wired; catalog database reads and affiliation are pending approved source integration.

## Source provenance and order

The integration branch preserves these source checkpoints with their authorship and provenance:

| Slice | Commit |
|---|---|
| Database foundation | `e26e7ad4868683e9eaa4b83ea9eb194cc2acf31b` |
| Managed auth | `5fb5bc2c069f8a50ec453ac02885170dc993dcda` |
| Rankings/UI | `a8f90849ddebe7c921fc5f768b59a0afa49b3839` |

Private draft source: `166748e212d46d62045080ac8db462f0ed425239` (PR #8), independently approved.

The user merges those source PRs first. After they land, reconcile this work against the updated `main` with a normal merge where permitted or a fresh final glue branch. Avoid replaying already merged squashed commits. Agents do not merge, force-push, or deploy.

## What is integrated now

- Drizzle schema, committed migration, server-only database access, guarded synthetic seed, and database tests exist as backend foundations.
- Managed Neon Auth provides sign-in, sign-up, account, same-origin proxy, and a verified-session helper when its branch endpoint and cookie secret are configured. Missing configuration fails closed.
- The shared account link is present in desktop and mobile navigation.
- The public catalog, rankings, and review composer still use fixture data or `localStorage`. No public review is posted, moderated, or included in a score.

## Configuration checklist

1. Copy `.env.example` to `.env` for database commands. Use `.env.local` only for local Next.js overrides. Keep secrets server-side.
2. Set `DATABASE_URL` for application access and `DATABASE_DIRECT_URL` for migrations when a database-backed feature is being exercised.
3. Run `npm run db:migrate` against the reviewed target.
4. For a synthetic environment only, verify the branch and run `SEED_SCOPE=development npm run db:seed -- --yes` or use `demo`. Never seed production.
5. For auth, set the exact branch `NEON_AUTH_BASE_URL` and a unique `NEON_AUTH_COOKIE_SECRET`. Configure trusted origins and provider email policy manually; no live auth or mail setup has been performed here.
6. Keep one Neon project with synthetic parent branches. Branching copies auth identities and configuration, so never derive preview/demo/test from production identities.

## Verification matrix

| Area | Command or gate | Meaning |
|---|---|---|
| Frontend | `npm run lint`, `npm run typecheck`, `npm run build` | Local static/tooling checks |
| Auth | `npm run test:auth` | Offline SDK-boundary tests with mocked provider behavior |
| Browser | `PLAYWRIGHT_PORT=3127 npm test` | Demo UI and unavailable-auth browser paths |
| Database | `npm run test:db` | Migration, constraints, seed, and config checks against test Postgres |
| Hosted auth | Configured synthetic accounts, mail, trusted origins, expiry/revocation | Manual release gate, unperformed without provider access |
| Deployment | Environment and branch review, migration application, smoke check | Manual release gate, no deployment claimed |

The default browser port is 3001. This integration worktree uses 3127 to avoid the other local suites on 3107 and 3113. Do not fill in test counts until the exact command has been run at the final head.

## Remaining product gates

The next implementation must add server-side catalog reads with controlled search/pagination and explicit missing-config, empty, outage, and opt-in demo states. Private draft HTTP and account management are implemented; final catalog pages must supply database target IDs to the server composer. Affiliation remains disabled pending approved repairs. Public posting, moderation, publication, reports, and live score aggregation remain deferred. No AI gateway, mail provider, public gateway, provisioning, or deployment is configured by this checkpoint.

The university-verification feature is a separate pending PR and is not integrated or claimed reviewed by this checkpoint.

## Rollback and release limits

Revert application changes through a reviewed PR. Data corrections require a reviewed forward SQL migration; no automatic down migration is promised. Keep synthetic seed data isolated and preserve provider branch boundaries. Record any missing credentials, live-provider checks, or manual deployment steps as unperformed rather than inferring success from local builds.

See [PRIVATE-DRAFT-HTTP.md](./PRIVATE-DRAFT-HTTP.md) for the implemented API, exact-origin configuration, migration order, ownership, and retry/revision contracts.
