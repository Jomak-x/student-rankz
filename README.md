# Student Rankz

Student Rankz is a Next.js prototype for university, course, and instructor student-experience reviews. The public UI is still a fixture demo: scores and reviews are illustrative sample data, and the review composer stores drafts in the browser only. Database migrations, an explicit synthetic directory seed, and managed authentication are available as separately configured backend slices; the public catalog and review flows have not yet been wired to them.

## Prerequisites

- Node.js 22 (LTS)
- npm 10

## Quick start

```bash
npm ci
npm run dev      # http://localhost:3000
```

The demo runs without service credentials. Copy `.env.example` to `.env` for database tooling or `.env.local` for local Next.js overrides, then fill only the server-side values needed for the feature being exercised. The scripts load `.env` when present; Next.js also supports `.env.local`.

## Commands

| Command | Description |
|---|---|
| `npm ci` | Install exact locked dependencies |
| `npm run dev` | Start the development server |
| `npm run build` | Build the Next.js application |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run the Playwright smoke suite; defaults to port 3001 |
| `npm run test:auth` | Run offline managed-auth tests |
| `npm run test:db` | Run database migration, constraint, seed, and configuration tests |
| `npm run db:migrate` | Apply committed Drizzle migrations using `DATABASE_DIRECT_URL`, then `DATABASE_URL` |
| `npm run db:seed -- --yes` | Explicitly seed a development or demo database when `SEED_SCOPE` is set |

## Public routes

The public catalog routes are currently backed by `lib/demo-data.ts` and remain usable without a database:

`/`, `/universities`, `/universities/[id]`, `/courses`, `/courses/[id]`, `/instructors/[id]`, `/rankings`, and `/compare`.

`/sign-in`, `/sign-up`, and `/account` are the managed-auth slice. They fail closed and show an unavailable state when the provider is not configured. An authenticated provider identity does not establish affiliation, enrollment, review ownership, or publication permission.

## Current limits

- The public catalog and rankings do not read the database yet. Database-backed reads, explicit empty/error/demo states, and deployment wiring are pending integration work.
- The review composer writes private drafts to `localStorage`. It does not send, publish, moderate, or count reviews.
- There is no public posting, moderation gateway, score aggregation service, admin/reporting flow, or live mail delivery.
- The synthetic database seed is opt-in and contains fictional institutions. It never runs during build, migration, or deploy.

See [docs/INTEGRATION.md](docs/INTEGRATION.md) for the merge and configuration checkpoint, [docs/FRONTEND.md](docs/FRONTEND.md) for the UI boundary, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system ownership, and [docs/AUTH.md](docs/AUTH.md) for the managed-auth contract.

## CI

Frontend CI runs lint, typecheck, offline auth tests, build, and Playwright on its default isolated port 3001. The separate Backend workflow runs database tests and migration/seed safety checks against PostgreSQL with a random mapped host port. Neither workflow provisions services or deploys the application. See [docs/REPOSITORY-WORKFLOW.md](docs/REPOSITORY-WORKFLOW.md).
