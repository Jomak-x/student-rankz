# Integration previews

Catalog images are production-build browser captures against disposable PostgreSQL: explicitly seeded synthetic demo data, a migrated empty database, or a dropped database for the unavailable state. `npm run test:integration` reproduces these states on ports 3128–3130.

Account/sign-in captures use the production build with missing Auth configuration (`PLAYWRIGHT_PORT=3127 npm test`). The failed composer capture is a real HTTP request rejected by that unavailable auth boundary; its entered text remains visible.

The four `draft-editor`, `draft-empty`, `draft-error`, and `draft-success` images are isolated React component previews with synthetic data and mocked transport. Each has an explicit visible preview label. They do not validate live authentication or a successful database write.

All images are below 500 KB. The PR embeds raw URLs pinned to its exact source head.
