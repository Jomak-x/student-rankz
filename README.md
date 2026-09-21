# Student Rankz

Student Rankz is a Next.js application for university, course, and instructor student-experience reviews. Public catalog pages read from the database; demo mode uses explicitly seeded synthetic sample data and labels it as such. Public posting and AI moderation are deferred.

## Prerequisites

- Node.js 22
- npm 10
- PostgreSQL only for database, catalog, draft, migration, and integration suites

## Local checks

```bash
npm ci
npm run lint
npm run typecheck
npm run build
PLAYWRIGHT_PORT=3127 npm test
```

## Database setup

Set `DATABASE_URL` for application reads and `DATABASE_DIRECT_URL` for migrations, then apply the consolidated journal:

```bash
npm run db:migrate
```

This includes `0000`, `0001` private drafts, and `0002` public catalog sample data. Do not run a separate feature migration.

For a confirmed synthetic demo database only:

```bash
SEED_SCOPE=demo npm run db:seed -- --yes
SEED_SCOPE=demo node --env-file=.env --import tsx db/demo-ratings-seed-cli.ts --yes --acknowledge-demo-data
```

The `db:seed:demo` npm script does not load `.env`; use the command above or explicitly export `DATABASE_URL` and `SEED_SCOPE=demo` before using it. Never seed production.

## Product behavior

- Public university, course, instructor, home, and ranking routes use database-backed catalog reads with honest unconfigured, unavailable, and empty states.
- Demo scores and reviews are synthetic stored samples. Production starts empty and must not fall back to fixtures.
- Review composers use real catalog UUID targets and save authenticated private drafts. Drafts do not change public scores or rankings.
- Compare stores up to three university slugs locally in `student-rankz-catalog-compare`.
- University affiliation remains unavailable pending approval. Public posting and AI moderation are deferred.

See [docs/TESTING.md](docs/TESTING.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/INTEGRATION.md](docs/INTEGRATION.md), and [docs/FRONTEND.md](docs/FRONTEND.md). No live provider, deployment, or production validation is claimed here.
