# Deployment Runbook

**Status**: MVP frontend + beta auth; backend features described below are pending implementation. Commands shown are current through the frontend MVP. Integration PRs will update provisional sections before release.

## Overview

Production deployment targets one Neon Postgres project (EU region: Frankfurt). Branching strategy isolates production identity/reviews from development and demo data. Vercel hosts static content and API routes; Resend handles transactional email. No manual provisioning, deployment, or email sending is performed in this runbook — only configuration and smoke verification.

| Environment | Database branch | Data | Vercel | Auth | Email |
|---|---|---|---|---|---|
| **Production** (`main`) | `main` | Real identity + reviews | prod domain | provisioned | live sender |
| **Demo** | `demo-synthetic` | Synthetic demo data | preview URL | mock sessions | test sender |
| **Development** | `dev` | Synthetic dev data | local/branch preview | mock sessions | test sender |

## Prerequisites

- Node.js 22 (LTS), npm 10
- Git worktree isolated from `main`; branch targets `origin/main`
- `neon` CLI signed in (see [BACKEND-SETUP.md](./BACKEND-SETUP.md) CLI authentication)
- `gh` CLI authenticated
- Vercel project connected to this repository
- Resend account active

## Deployment sequence

This sequence applies to all deployments (preview, production) except local development.

### 1. PR dependencies and CI

1. Open a PR targeting `main` with your changes.
2. CI automatically runs: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` (smoke tests on production build).
3. All checks must pass. No merging without CI green.
4. **No manual deploy trigger yet** — deployment is manual after merge.

Current CI commands (see [REPOSITORY-WORKFLOW.md](./REPOSITORY-WORKFLOW.md) for details):
```bash
npm ci              # Install exact locked dependencies
npm run lint        # ESLint
npm run typecheck   # TypeScript type-check
npm run build       # Production build (static generation)
npm test            # Playwright smoke suite (requires prior build; serves on port 3001)
```

### 2. Configure secrets (once per environment)

Secrets are stored in Vercel's environment variables. Do this once per environment; rotate periodically.

#### Production secrets

1. Go to Vercel → Settings → Environment Variables
2. Add for production environment:
   - `DATABASE_URL`: Neon pooled connection string (`main` branch) — PENDING
   - `DATABASE_DIRECT_URL`: Neon direct connection string (`main` branch) — PENDING
   - `RESEND_API_KEY`: Resend API key (production credentials)
   - `EMAIL_FROM`: Verified sender address (e.g., `hello@student-rankz.eu`)
   - `NEON_AUTH_BASE_URL`: Neon Auth endpoint — PENDING
   - `NEON_AUTH_COOKIE_SECRET`: Neon Auth cookie secret (≥32 chars) — PENDING

#### Preview + development secrets

1. Add for preview environment:
   - `DATABASE_URL`: Neon pooled connection string (`dev` branch) — PENDING
   - `DATABASE_DIRECT_URL`: Neon direct connection string (`dev` branch) — PENDING
   - `RESEND_API_KEY`: Resend sandbox/test API key
   - `EMAIL_FROM`: Test sender address
   - `NEON_AUTH_BASE_URL`: Neon Auth endpoint (test/dev) — PENDING
   - `NEON_AUTH_COOKIE_SECRET`: Neon Auth cookie secret — PENDING

#### No NEXT_PUBLIC secrets

Never prefix environment variables with `NEXT_PUBLIC_` for credentials, API keys, or sensitive config. Server-side environment files only.

### 3. Migrate database schema (production only) — PENDING

**Status**: Database foundation PR in progress. Migration commands and scripts are not yet available.

When database integration lands and a PR introduces database schema changes:

1. Review the migration in the PR (exact SQL, no auto-generated ORM scripts).
2. After PR is merged, run migrations against production `main` branch with `DATABASE_DIRECT_URL` set locally:
   ```bash
   npm run db:migrate
   ```
3. Verify schema changes applied:
   ```bash
   neon sql --project-id YOUR_PROJECT_ID "SELECT * FROM information_schema.tables WHERE table_schema='public'"
   ```
4. Never derive production data into development branches. Schema-only branches only (when supported).

### 4. Seed demo data (opt-in, preview only) — PENDING

**Status**: Database foundation PR in progress. Seed command and scripts are not yet available.

Demo data is only seeded into the `demo-synthetic` branch. Never seed production.

When database integration lands:

```bash
# Seed demo only when first setting up preview environment
npm run db:seed -- --scope demo
```

This is opt-in and runs once. Preview deployments do not re-seed on every deploy.

### 5. Deploy preview branch

Preview deploys are automatic when you push to a non-`main` branch (Vercel integration).

For manual preview deploy after merge to `main` (if needed):

```bash
# Via Vercel CLI
vercel deploy --prod=false

# Or via Vercel dashboard: Settings → Git → Deployments
```

Vercel redeploys automatically when code is pushed or merged.

### 6. Smoke verification

After preview deploys to a Vercel URL (shown in PR or Vercel dashboard):

1. **Light/dark mode**: Toggle theme in header, verify colors render correctly in both modes.
2. **Mobile**: Test on Pixel 5 (375px width) — hamburger menu visible, text readable.
3. **Rankings/scores**: View university detail page, verify category score bars render.
4. **Empty state**: If no data (demo not seeded), confirm empty-state message displays.
5. **Sign-in** (when auth integrated): Attempt sign-in flow; verify success or expected beta limitations.
6. **University verification** (when auth integrated): Test sending verification link; confirm email mock does not auto-send.
7. **Private draft ownership**: If private draft feature is live, verify only the author can edit; others see "not your draft".
8. **Publication disabled**: Confirm "Publish" button is disabled or absent (moderation gate not yet live).

See [TESTING.md](./TESTING.md) for detailed acceptance checklist.

### 7. Production deployment

Production deploys happen only after a successful merge to `main`.

```bash
# After merge and all secrets configured
vercel deploy --prod
```

Or via Vercel dashboard: Production deployments run once the build is complete.

**Pre-production checklist**:
- All smoke tests pass against production build (`npm test`)
- Production database `main` branch is healthy (when available)
- Migrations applied successfully (when available)
- `RESEND_API_KEY` uses production-verified domain sender
- No `NEXT_PUBLIC_*` environment variables contain secrets
- Verify production is intentionally empty (no production users/identity yet during MVP)
- Confirm UI displays empty-state messaging if no data

**Post-deployment verification**:
1. Visit production URL
2. Verify demo banner is absent (or displays only if intentionally branded for production)
3. Confirm data loads correctly and empty states render if no data yet
4. Run a spot check on key routes: `/`, `/universities`, `/universities/[id]`

## Environment isolation

| Concern | Production | Preview/Dev |
|---|---|---|
| **Database** | `main` branch, real identity | `dev` or temporary branches, synthetic data |
| **Email** | Verified production domain | Test/sandbox sender, test email only |
| **Auth sessions** | Real auth provider (when live) | Mock sessions or isolated provider credentials |
| **Data origin** | User-submitted (when live) | Seed scripts, demo data only |

Users/sessions copied from production into development branches must never happen. Production identity is sacred and isolated; development branches always use synthetic data.

## Rollback

If production has a critical issue post-deployment:

1. **Identify the commit**: `git log main --oneline | head`
2. **Revert PR**:
   ```bash
   git revert <commit-sha>
   git push origin main
   ```
3. **Re-deploy** (Vercel redeploys from `main` automatically or via manual trigger).
4. **Verify rollback**: Confirm previous behavior restored and no data corruption.

No force-push to `main`. All rollbacks go through new PRs.

## Branch lifecycle

### Temporary feature branches

For backend schema or auth changes (when available):

1. Create a temporary Neon branch from `dev`:
   ```bash
   neon branches create --parent dev --name feature/my-schema
   ```
2. Apply changes and test locally
3. After PR merge to `main`, delete the temporary branch:
   ```bash
   neon branches delete --project-id YOUR_PROJECT_ID feature/my-schema
   ```

No persistent branches for frontend-only changes.

### Schema-only branching

When available in Neon, schema-only branches can be used for large schema changes without copying rows:

```bash
neon branches create --parent main --name schema-only-branch --schema-only
```

Use this to test migrations before applying to production.

## Monitoring and alerts

In Neon project settings:

1. Monitor compute usage (CPU, RAM, storage) — alert if approaching limits
2. Set spending alerts (if applicable to plan)
3. Review connection pool stats regularly
4. Monitor Vercel build times and deployment frequency

Alerts are advisory only; they do not block deployment.

## Known limitations (MVP)

- **Database integration**: Database schema, migrations, and seed scripts are not yet available. Planned in database foundation PR.
- **Auth**: Auth package is beta. Neon Auth provider endpoints and configuration required before live login. Session helpers and form integration pending. Password reset recovery status depends on Neon Auth hosted provider support — to be verified.
- **Moderation**: Review publication gate is disabled. No lexical checks or AI gateway integration yet. Submission/publication endpoints do not exist.
- **Email**: Resend setup is verified for DNS/domain. Transactional emails are not yet sent to real user addresses. Test sender domain only during MVP.
- **Gateway**: AI gateway is not yet provisioned. Moderation model calls and escalation are deferred until a gateway is available.

Backend features listed in [ARCHITECTURE.md](./ARCHITECTURE.md) gap list are not yet implemented and are marked as pending.

## Troubleshooting

| Issue | Diagnosis | Resolution |
|---|---|---|
| **Build fails in CI** | Check log output in GitHub Actions | Review error, fix in branch, push to re-run CI |
| **Frontend tests fail** | Check Playwright test output | Review smoke.spec.ts, confirm localhost:3001 access, check test traces/screenshots in artifacts |
| **Neon connection timeout** (when available) | Check if pooler/direct URL is correct | Verify URL in Vercel environment variables matches branch |
| **Email not sent** | Resend sandbox mode or missing configuration | Confirm `RESEND_API_KEY` and `EMAIL_FROM` are set; check Resend dashboard for errors |
| **Database migration conflicts** (when available) | Multiple PRs altering schema simultaneously | Resolve conflicts in migration files, re-run migration against fresh branch |
| **Production data leaked into preview** | Manual copy or code bug | Do not copy production branches. Use schema-only branching only. Report immediately. |

For urgent production incidents, post in the team channel with the error log and affected route.
