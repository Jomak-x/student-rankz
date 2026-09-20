# Backend implementation roadmap

The backend is delivered in small pull requests. Each PR documents its schema/API changes, setup, tests and dependencies. The frontend remains usable with demo data while integrations are developed. No PR provisions hosted services or enables public posting by default.

| Delivery | Scope | Depends on | Acceptance |
| --- | --- | --- | --- |
| Database foundation | Typed Postgres directory schema, migrations, synthetic directory seed, server-only access and database tests | Frontend toolchain PR #2 | Clean database migrates successfully; constraints and repeatable seed tested; demo builds without credentials |
| Database-backed frontend + demo branch | Directory reads served from the database in server routes with honest empty states where there is no data; dedicated Neon demo branch seeded with the repeatable synthetic seed; seed/reset instructions and demo-versus-production environment separation | Database foundation | Production branch contains no synthetic rows; demo branch reproducible from seed; no fixture fallback once integrated; production identity data never copied |
| Authentication | Managed auth provider (its own schema and migrations), sign-in/sign-out, server sessions and protected-route helpers | Independent of the database foundation — runs in parallel with it | Invalid/expired sessions rejected; local test doubles clearly separated from real provider validation; login independent of university affiliation |
| University affiliation | Curated exact-domain registry, account-bound email verification, expiry, single-use codes and rate limits | Authentication and database foundation, both stable | Replay, expiration, address changes, cross-account and cross-university attempts tested; no real email sent in CI |
| Private review drafts | Authenticated create/read/update/delete, author-only access and validation for supported review targets | Authentication, affiliation and directory schema, all stable | Cross-user access rejected; drafts excluded from public data; publication unavailable |

## Sequence and ownership

1. The database foundation and authentication are independent and proceed in parallel worktrees: the directory schema owns no identity tables, and managed auth owns its own schema and migrations. Neither PR modifies the other's files.
2. Application identity, affiliation and draft tables are added only after both the directory schema and the auth provider contract are stable, in the PRs that implement their behavior. Each owns its own routes, service modules, tests and migration files.
3. The database-backed frontend and demo branch integration follows the database foundation; it documents seed/reset instructions and demo-versus-production environment separation, and retires the fixture prototype.
4. Every implementation gets independent review from another model provider. Humans review and merge the PRs; agents never merge them.

The first code PR targets the frontend branch until PR #2 lands. Dependent PR descriptions must name their base PR and merge order. Retarget to `main` only after dependencies land; do not bundle unrelated changes or rewrite published history without authorization. Technical setup guides are delivered separately in PR #3.

## Database and configuration

Use one Neon project, with synthetic development data isolated from production. The production branch (`main`) never receives synthetic rows: it serves real records or honest empty states. The dedicated demo branch holds the synthetic example data, applied only by explicitly opt-in seeding. Run migration and constraint tests against an ephemeral local or CI Postgres instance. Hosted credentials are optional for the frontend demo and must never appear in code, logs, screenshots or PRs. A `DATABASE_URL` string cannot prove which hosted branch it points at, so seeding never claims branch safety from the URL — the operator confirms the target explicitly. Seeding never runs automatically on deploy.

Keep auth-owned tables under the chosen provider's migrations. The directory foundation contains only directory tables; affiliation and draft tables arrive in later PRs once the provider contract is known. Directory tables support programme-specific compulsory/elective status, dated course offerings and multiple instructors.

## Deferred work

The AI gateway, model moderation, public review submissions, publication, rating aggregation and administrative moderation tools are not part of these PRs. Define those separately once the gateway is available. Draft storage never implies permission to publish. Material sharing, paid queues and independent worker services remain out of scope.
