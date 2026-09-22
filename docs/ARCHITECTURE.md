# Architecture

```mermaid
flowchart TB
  Browser --> CatalogPages[Database-backed catalog pages]
  CatalogPages --> Catalog[Catalog service]
  Catalog --> DB[(PostgreSQL)]
  Browser --> DraftAPI[Private draft API]
  Browser --> Verification[Account verification pages]
  DraftAPI --> Auth[Managed Neon Auth]
  Verification --> Auth
  DraftAPI --> DB
  Verification --> Affiliation[Affiliation service]
  Affiliation --> TxDB[Interactive transaction adapter]
  TxDB --> DB
  Affiliation --> Resend[Resend]
  Cron[Vercel daily cron] --> Cleanup[/api/internal/affiliation-cleanup]
  Cleanup --> DB
```

`DATABASE_URL` supplies runtime database access. Catalog reads use `neon-http` by default and use node-postgres when `DATABASE_TRANSPORT=postgres`. Affiliation verification requires interactive transactions, so it uses the Neon WebSocket adapter by default or node-postgres when `DATABASE_TRANSPORT=postgres`; it does not use neon-http.

The affiliation service verifies control of a curated university email domain, never enrollment. It binds codes to subject, university, address, and code with `AFFILIATION_HMAC_SECRET`; records send reservations in `recipient_send_log`; and uses the database clock to prune expired reservations. It does not expose a production mock-auth path.

Migration `0003` is the final integration migration for `university_domains`, `account_verifications`, and `recipient_send_log`. Its domain registry is trusted operator data: each reviewed insert must use an existing university UUID and an active, vetted domain. Synthetic `.example` rows cannot establish deliverability.

The daily cleanup route removes expired ledger rows only. Pending and verified verification records retain their own lifecycle and are not swept by this job. With a daily Hobby cron, reservation retention is normally about 26 hours and can be longer after missed work; it is not a one-hour deletion guarantee.

See [AFFILIATION.md](AFFILIATION.md) for route, environment, and maintenance contracts. The listed sources are independently approved; PR #9's final delta remains a draft pending final independent integration review and user approval.
