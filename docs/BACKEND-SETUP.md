# Backend setup

Copy `.env.example` to `.env` for local operator commands. Keep every value server-side and branch-specific.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Required runtime database connection |
| `DATABASE_DIRECT_URL` | Preferred direct migration connection |
| `DATABASE_TRANSPORT` | Catalog default is `neon-http`; set `postgres` for standard PostgreSQL |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` | Exact branch Managed Auth configuration |
| `APP_ORIGIN` | Exact origin required for private draft writes |
| `AFFILIATION_HMAC_SECRET` | At least 32 characters for code HMAC binding |
| `RESEND_API_KEY`, `RESEND_FROM` | Resend verification delivery adapter |
| `CRON_SECRET` | At least 32 characters with no whitespace for internal cleanup authorization |
| `CATALOG_MODE` | `demo` only for the synthetic demo branch |

Catalog runtime defaults to `neon-http`. The affiliation adapter needs interactive transactions and uses Neon WebSockets by default; when `DATABASE_TRANSPORT=postgres`, it uses node-postgres instead.

Run migrations explicitly, outside builds and deploys:

```bash
npm run db:migrate
```

The final integration `0003` adds `university_domains`, `account_verifications`, and `recipient_send_log`. Add domains through trusted reviewed SQL using existing university UUIDs. Do not generate IDs from email claims or expect synthetic `.example` domains to receive mail.

For a manual ledger sweep, export the intended `DATABASE_URL`, verify that target, then run:

```bash
npm run affiliation:cleanup -- --yes
```

The CLI requires the URL and `--yes`, accepts no recipient or cutoff options, uses the database clock, and prints only an aggregate count. It does not load `.env`; export values first. The deployed cron route needs `CRON_SECRET`, not a public caller parameter.

The listed sources are independently approved; PR #9's final delta is pending final independent integration review and user approval. No live provider, mail, DNS, cron, or production claim is made here.
