# Database

Status legend: **Implemented** in this PR vs **Planned** (delivered in later PRs, see [BACKEND-ROADMAP.md](./BACKEND-ROADMAP.md)).

The directory foundation is a typed PostgreSQL schema with Drizzle ORM. The application runtime uses the Neon serverless HTTP driver (`drizzle-orm/neon-http`), which works on Vercel serverless and edge runtimes without open TCP connections. Migrations and tests use plain TCP Postgres (`pg`) against an ephemeral server. **Implemented:** schema, migrations, seed, server-only access, tests. **Planned:** serving directory reads from the database, the demo branch workflow, and all auth-owned tables.

## Layout

```
db/schema.ts        Drizzle table definitions (single source of truth)
db/config.ts        Migration connection resolution (direct -> pooled -> empty)
db/seed-data.ts     Synthetic dataset: fictional institutions only
db/seed.ts          Repeatable seedDatabase() (upsert-based)
db/seed-cli.ts      Explicitly opt-in CLI wrapper (npm run db:seed)
server/db.ts        Server-only client, lazy config validation
drizzle/            Generated SQL migrations + snapshots (committed)
drizzle.config.ts   drizzle-kit configuration
tests/db/           Migration, constraint, seed, config, CLI and helper-cleanup tests (node:test)
```

## Schema (implemented)

| Table | Purpose | Key constraints |
| --- | --- | --- |
| `universities` | Directory root entity | `slug` globally unique; founded-year / student-count checks |
| `programmes` | Study programmes of one university | `(university_id, slug)` unique; `level` enum |
| `courses` | Courses of one university | `(university_id, code)` unique; `credits > 0` |
| `programme_courses` | Required/elective status per programme | `(programme_id, course_id)` PK; composite FKs force programme and course to share the university |
| `course_offerings` | Dated instances (academic year + term, optional date range) | `(course_id, academic_year, term)` unique; `ends_on >= starts_on` check; composite FK forces offering and course to share the university |
| `instructors` | Instructor profiles of one university | `(university_id, slug)` unique |
| `offering_instructors` | Who teaches a specific offering | `(offering_id, instructor_id)` PK; composite FKs force offering and instructor to share the university |

Every row belongs to exactly one university. Relations across entity types carry `university_id` and use **composite foreign keys** onto `(id, university_id)` unique constraints, so cross-university links are rejected by the database, not by application code. Deletes cascade from universities down through the whole directory. There are deliberately no rating, review or identity columns and no emails — ratings and identity are deferred to later PRs.

Example: linking a course into a programme requires a shared `university_id` on both sides.

```sql
CREATE TABLE "programme_courses" (
  "programme_id"  uuid NOT NULL,
  "course_id"     uuid NOT NULL,
  "university_id" uuid NOT NULL REFERENCES "universities"("id") ON DELETE cascade,
  "status"        "programme_course_status" NOT NULL,
  CONSTRAINT "programme_courses_pkey" PRIMARY KEY ("programme_id","course_id"),
  CONSTRAINT "programme_courses_programme_fkey" FOREIGN KEY ("programme_id","university_id")
    REFERENCES "programmes"("id","university_id") ON DELETE cascade,
  CONSTRAINT "programme_courses_course_fkey" FOREIGN KEY ("course_id","university_id")
    REFERENCES "courses"("id","university_id") ON DELETE cascade
);
```

## Server access (implemented)

`server/db.ts` imports the `server-only` package, so bundlers reject any client-component import. Configuration is validated **lazily**: importing the module never throws, `getDb()` throws on first use if `DATABASE_URL` is unset. The demo build therefore works with zero credentials.

```ts
import { getDb } from "@/server/db"; // server components/routes only

const db = getDb();
const rows = await db.select().from(universities);
```

## Commands

```bash
npm install                                   # deps (drizzle-orm, @neondatabase/serverless, server-only, drizzle-kit, pg, tsx)

npm run test:db                               # migration, constraint, seed, config, seed-CLI and helper-cleanup tests on an ephemeral Postgres
TEST_DATABASE_URL=postgres://... npm run test:db   # point tests at another admin-capable Postgres

npm run db:generate                           # diff db/schema.ts -> drizzle/*.sql (no DB needed)
DATABASE_URL=postgres://... npm run db:migrate    # apply committed migrations
```

Migration connection resolution: `DATABASE_DIRECT_URL` is preferred; when it is unset or blank, migration commands fall back to `DATABASE_URL` (convenient for local/CI single-connection setups). Values are never logged.

Local ephemeral Postgres for tests (any Postgres works; `TEST_DATABASE_URL` must be admin-capable):

```bash
docker run -d --name student-rankz-pg-test \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -p 15432:5432 postgres:17-alpine
# tests default to postgres://postgres:postgres@localhost:15432/postgres
```

### Seeding — explicitly opt-in (implemented)

The seed inserts **fictional example institutions, programmes, courses, offerings and instructors only** (marked "(fictional example)", `example.com` URLs, no ratings). It is idempotent and repeatable: rows upsert on natural unique keys with fixed UUIDs, so repeated runs converge to identical state.

It **never runs automatically** — not on build, deploy, or in CI (CI invokes `seedDatabase()` directly against an ephemeral database). Two independent, explicit confirmations are required:

```bash
export SEED_SCOPE=development   # or "demo": declares the operator's intended target
npm run db:seed -- --yes        # explicit confirmation flag
```

Without both, the CLI refuses and exits. The CLI loads the project `.env` file automatically (copy `.env.example` to `.env` and fill it in); exported environment variables take precedence over `.env` values (Node semantics). The script cannot verify which physical database or hosted branch a `DATABASE_URL` points at, and does not pretend to — `SEED_SCOPE` is an operator statement, not a URL property. **Never seed a production database**: production (`main`) must contain only real records or be honestly empty, and must never receive synthetic rows.

## Environment (implemented placeholders)

See [.env.example](../.env.example). `DATABASE_URL` (pooled, application) and `DATABASE_DIRECT_URL` (migration tooling) are server-side only; never use `NEXT_PUBLIC_*` for secrets. Values are inert — the app builds and the demo runs without them.

## Planned (not implemented here)

- **Database-backed frontend + demo branch** (next PR after this one): serve directory reads from the database; production shows real records or honest empty states with no fixture fallback; a dedicated Neon demo branch holds synthetic data applied with the seed above; that PR documents seed/reset instructions and demo-versus-production environment separation. The frontend fixture prototype stays in place until then. Production identity data is never copied into demo/development.
- **Auth-owned tables** live under the managed auth provider's own migrations (auth PR runs in parallel); affiliation and draft application tables arrive with the PRs implementing them.
- Rating/review storage, moderation, publication: deferred.

## Test environment boundaries

All database tests run against a **real ephemeral PostgreSQL server** (Docker locally, a Postgres service container in CI) — no SQLite mocks. What this cannot exercise locally/CI:

- Neon platform behaviour itself: the HTTP proxy endpoint, pooled endpoints, autosuspend and Neon auth branching. The `neon-http` driver path (`drizzle-orm/neon-http`) requires Neon's proxy and is only exercised once real Neon credentials exist; the SQL it runs is identical, and the schema/migrations are driver-agnostic.
- Hosted migration workflows (Neon branching, applied-to-production flows). CI proves only that committed migrations apply cleanly to an empty Postgres and that constraints behave.
