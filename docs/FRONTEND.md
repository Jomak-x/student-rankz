# Frontend

Public home, university, course, instructor, and ranking pages use dynamic database-backed catalog reads with bounded GET search, filtering, sorting, and pagination. They render distinct ready, empty, unconfigured, and unavailable states; no fixture fallback is used. `CATALOG_MODE=demo` shows the synthetic-data banner.

Review composers use real catalog UUID targets and save authenticated private drafts. Compare is the only catalog browser persistence and stores up to three university slugs in `student-rankz-catalog-compare`.

The account verification experience is wired in PR #9: initiate with `{ email }`, consume with `{ email, code }`, and view the signed-in account's status pages. It does not grant enrollment or publication permission. Production has no mock-auth bypass; `.example` test domains cannot prove delivery.

```bash
npm ci
npm run lint
npm run typecheck
npm run build
PLAYWRIGHT_PORT=3127 npm test
```

See [TESTING.md](TESTING.md) for the configured acceptance gate. The listed sources are independently approved; PR #9's final delta remains pending final independent integration review and user approval.
