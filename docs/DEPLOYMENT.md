# Deployment

Student Rankz uses one Neon project. Production starts empty; demo and development branches must descend from synthetic parents, never production data or identities. The database-backed catalog renders honest unconfigured, unavailable, and empty states. `CATALOG_MODE=demo` enables the synthetic-data banner.

## Vercel and environment setup

Create a Vercel project with Git deployments enabled. Use Node.js 22 and the build command `npm run build`. Do not run migrations or seeds from the Vercel build, application startup, or Git deployment hook.

Set these server-side variables for each deployed branch:

| Variable | Value/purpose |
| --- | --- |
| `DATABASE_URL` | Pooled application database connection |
| `DATABASE_DIRECT_URL` | Direct connection preferred by Drizzle migrations |
| `DATABASE_TRANSPORT` | `neon-http` for Neon, or `postgres` for a standard PostgreSQL server |
| `NEON_AUTH_BASE_URL` | Managed Auth endpoint for this exact Neon branch |
| `NEON_AUTH_COOKIE_SECRET` | Unique server-only cookie secret for this environment |
| `APP_ORIGIN` | Exact `https://` or `http://` browser origin, without path or trailing slash |
| `CATALOG_MODE` | `demo` only for the explicitly synthetic demo branch; unset otherwise |

Never expose these as `NEXT_PUBLIC_*` values. Production uses its own empty database and matching Auth configuration; demo and development use their own synthetic branches and matching Auth configuration.

## Release steps

1. Obtain final integration approval for PR #9 and confirm the exact-head checks in [TESTING.md](TESTING.md).
2. Configure the Vercel Git project, Node.js 22, `npm run build`, and the branch-specific environment table above.
3. Outside the deployment build, apply the consolidated journal to the selected branch:

   ```bash
   npm run db:migrate
   ```

   It applies `0000`, `0001` private drafts, and `0002` public catalog sample data. No additional feature migration command is required for a clean or bridged installation.
4. For an explicitly confirmed synthetic demo branch only, seed directory rows and demo ratings:

   ```bash
   SEED_SCOPE=demo npm run db:seed -- --yes
   SEED_SCOPE=demo node --env-file=.env --import tsx db/demo-ratings-seed-cli.ts --yes --acknowledge-demo-data
   ```

   `npm run db:seed:demo` does not load `.env`; use the command above or explicitly export `DATABASE_URL` and `SEED_SCOPE=demo` first. Never seed production.
5. Deploy through the approved Git change, then complete the configured manual acceptance checks in [TESTING.md](TESTING.md). No live check is claimed until an operator records it.

Managed Auth needs an authorized mailbox gate before email-dependent flows are accepted. After affiliation is approved and implemented, configure Resend and its DNS records once from the provider dashboard, then verify with an authorized mailbox. Affiliation remains pending and unavailable today; mailbox control does not establish affiliation.

Public posting and AI moderation are deferred. Private drafts stay private and do not alter public scores or rankings.

## Rollback

Use a reviewed revert PR for a code regression. A code revert does not undo migrations or seeded data; handle database recovery through a separately reviewed forward plan. Do not push directly to `main`.

No deployment, provider, DNS, authorized-mailbox, or production validation is claimed by this document.
