# Frontend

Student Rankz is a Next.js 16 App Router application for university, course, and instructor student-experience reviews.

## Catalog routes

| Route | Behavior |
| --- | --- |
| `/` | GET university search and top three database-backed featured/ranked entries |
| `/universities` | Server-side GET search, country filter, sort, and pagination |
| `/universities/[id]` | Database detail by university slug; the `[id]` segment is a slug |
| `/courses` | Server-side GET search, level filter, sort, and pagination |
| `/courses/[id]` | Database detail by course UUID |
| `/instructors/[id]` | Database detail by instructor UUID |
| `/rankings` | Bounded top-university query from stored sample scores |
| `/compare` | Client-side selection of database catalog slugs, then server comparison read |

Public catalog pages are dynamic server reads through `getCatalogService()` and `readCatalog()`. They distinguish ready, unconfigured, unavailable, and empty states. List queries are bounded by the service. Null scores render as `No score`; rankings do not fabricate rows or totals.

## Demo and persistence

When `CATALOG_MODE=demo`, the layout displays a global banner and catalog copy identifies ratings and reviews as synthetic samples stored in the demo database. Demo sample data is not real ranking or review content.

Private drafts use authenticated server APIs and real catalog UUID targets. They are not saved to browser storage and never appear in public reads or score calculations. Compare is the only catalog `localStorage` state: `student-rankz-catalog-compare` contains selected university slugs and is capped at three selections.

University affiliation is intentionally unavailable pending approval. Public posting and AI moderation are deferred.

## Frontend verification

```bash
npm ci
npm run lint
npm run typecheck
npm run build
PLAYWRIGHT_PORT=3127 npm test
```

See [TESTING.md](TESTING.md) for ephemeral database suites and [DEPLOYMENT.md](DEPLOYMENT.md) for the consolidated migration and demo seed steps.
