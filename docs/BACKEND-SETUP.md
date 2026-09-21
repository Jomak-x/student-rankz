# Backend setup

Copy `.env.example` to `.env` for local operator commands. Keep values server-side and branch-specific.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled database connection used by the application |
| `DATABASE_DIRECT_URL` | Direct migration connection; falls back to `DATABASE_URL` when blank |
| `DATABASE_TRANSPORT` | `neon-http` or `postgres` |
| `NEON_AUTH_BASE_URL` | Exact Managed Auth endpoint for the selected branch |
| `NEON_AUTH_COOKIE_SECRET` | Unique secret for that branch's auth cookies |
| `APP_ORIGIN` | Exact browser origin required for draft writes |
| `CATALOG_MODE` | `demo` only for the explicit synthetic demo branch |

## Database and seed workflow

Run the consolidated journal before using database-backed catalog or draft routes:

```bash
npm run db:migrate
```

It applies `0000`, `0001` private drafts, and `0002` catalog sample-review tables. No feature migration command is needed for a clean installation. The migration bridge also supports a database where tracked feature assets were applied first, and upgrades a pre-bridge `0001` installation by backfilling tracking without replaying DDL. If manually applied, untracked DDL collides with the journal, stop and use a reviewed migration plan; do not adopt or delete unknown tables.

For a confirmed synthetic demo target only:

```bash
SEED_SCOPE=demo npm run db:seed -- --yes
SEED_SCOPE=demo node --env-file=.env --import tsx db/demo-ratings-seed-cli.ts --yes --acknowledge-demo-data
```

The ratings seed script does not load `.env`; the explicit Node command does. Neither seed runs during build, migration, CI, or deployment. Production remains empty until approved real catalog data is available.

## Runtime boundaries

The catalog is database-backed and returns only public DTOs. Private drafts require a verified managed-auth session, an exact `APP_ORIGIN` for mutations, and real university/course/instructor UUID targets. Drafts are not local browser storage and do not affect public scores. Compare slugs are the only catalog browser persistence.

Affiliation remains unavailable pending approval. Public review posting and AI moderation are deferred. No Neon, Auth, mail, DNS, or deployment validation is claimed here.
