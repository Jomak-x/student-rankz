# Managed authentication

This integration adds `/sign-in`, `/sign-up`, `/account`, and `/api/auth/[...path]` independently of the application database. The public demo works with no credentials. Main navigation integration is separate; open the auth URLs directly. Authentication identifies a provider user; it never grants university affiliation, enrollment, review permissions, or publication rights. Personal email addresses are allowed.

## Version and configuration

The SDK is pinned to **`@neondatabase/auth@0.5.0-beta`**, despite the managed service's GA status. Its installed TypeScript declarations are the integration contract; newer online examples can differ. We use `createNeonAuth` from `@neondatabase/auth/next/server`, `auth.handler()` for GET/POST, and `createAuthClient` from `@neondatabase/auth/next`. No self-hosted Better Auth server or database adapter is configured. npm may report upstream optional UI peer dependency warnings; we do not import the SDK's UI package.

Copy `.env.example` to `.env.local` and leave values empty for offline/demo use. Configured service use requires these **server-only** variables:

| Variable | Value |
| --- | --- |
| `NEON_AUTH_BASE_URL` | Exact branch Auth endpoint from Neon Console, e.g. `https://ep-example.neonauth.eu-central-1.aws.neon.tech/neondb/auth` (illustration only) |
| `NEON_AUTH_COOKIE_SECRET` | Random secret of at least 32 characters; generate locally with `openssl rand -base64 32` |

Never prefix these with `NEXT_PUBLIC_`. No `DATABASE_URL`, database migrations, Resend API key, or separate Neon project is required by this integration. Secrets and raw provider failures are not logged. Forms show generic errors, and provider 5xx failures become generic 503 responses; other SDK proxy responses, including provider 4xx error bodies, are forwarded. The browser talks only to the same-origin `/api/auth` proxy; server configuration is lazy and guarded during production builds. Missing/invalid configuration disables forms, shows an unavailable state, and returns HTTP 503 from the API. It never fabricates a session.

Before enabling real traffic, an operator must verify the current regional/service prerequisites, enable managed Auth and email/password, configure trusted application origins, choose an email-verification policy, and use the matching branch endpoint and unique cookie secret per branch/environment (never share production and preview secrets; rotate when changing branch endpoints). Shared SMTP is for limited development/testing; verify production SMTP requirements. No services, email sending, or deployment were performed for this change.

## Routes and API

| Route | Behaviour |
| --- | --- |
| `/sign-in?next=/account` | Custom shadcn email/password form; local return path only |
| `/sign-up?next=/account` | Name/email/password registration; supports a no-session verification outcome |
| `/account` | Server-verified identity only; anonymous users redirected, provider/config errors fail closed |
| `GET /api/auth/get-session` | Provider session endpoint through `auth.handler()` |
| `POST /api/auth/sign-in/email` | JSON `{ "email": "synthetic@example.test", "password": "<synthetic password>" }` |
| `POST /api/auth/sign-up/email` | JSON `{ "name": "Synthetic Tester", "email": "synthetic@example.test", "password": "<synthetic password>" }` |
| `POST /api/auth/sign-out` | Provider sign-out through the same SDK proxy |

API examples describe the contract, not commands to send real mail. The catch-all delegates provider endpoints and cookie/CSRF handling to the SDK; do not build an alternate local login implementation. Client calls use the typed SDK. Pending submission disables controls; provider and network failures show generic messages. Successful login/logout refreshes server navigation. Return paths reject external URLs, protocol-relative URLs, backslashes, encoded escape forms, with `/account` as the fallback.

Password recovery is **deferred**. The pinned SDK declares reset methods, but hosted support has not been exercised and documentation has conflicted. There is no purported working recovery form or reset link. Do not promise recovery until the configured service, reset domains, token expiry, and mail delivery have passed live testing.

## Session boundary and caching

Auth pages, account, and API handlers are dynamic. API responses use `Cache-Control: private, no-store`; do not cache identity HTML at a CDN. `getVerifiedSession()` uses the server SDK, handles provider errors, and checks the returned identity, session owner, and expiry. Only a minimal `{ id, name, email }` identity reaches account UI. The provider subject is not yet an application identity or authorization claim.

The SDK's signed HTTP-only session-data cookie has an explicit **300-second TTL**. `no-store` prevents HTTP response caching, but does **not** remove that signed session cache. Logout clears cookies via the SDK; remote revocation or session changes may remain unseen until cache expiry. This is not immediate revocation. No sensitive writes are enabled here. Future account deletion, affiliation, or posting endpoints must enforce provider-fresh session validity using an API verified against the installed SDK/service, and independently authorize each operation. Do not reuse this cached display helper as proof of immediate revocation.

## Managed schema and branch isolation

Neon owns the `neon_auth` schema, including user, account, session, and verification storage. This PR adds **no auth SQL, password storage, or provider-table migrations**. Enable/configure Auth through the provider; provider migrations remain provider-owned. Future application migrations should map validated provider subjects to opaque application IDs rather than couple themselves to provider table internals.

**Creating a Neon branch COPIES existing identities, sessions, and auth configuration from its parent.** Separate branch endpoints isolate subsequent changes, not the initial copy. Development, previews, and test branches must derive only from a parent containing synthetic identities. Do not branch production identities into development, and do not assume ordinary schema-only database branching automatically solves managed Auth isolation. Validate branch-specific endpoint rejection and cookie separation before real users. Provisioning or branch creation was not performed here.

Application identities, server draft ownership, university verification, moderation gateways, and public posting are deferred. Existing browser drafts stay demo-only.

## Offline verification and remaining live gates

```sh
npm ci
npm run lint
npm run typecheck
npm run test:auth
npm run build
PLAYWRIGHT_PORT=3107 npm test
```

Vitest tests use installed SDK types and mock its provider boundary; unexpected fetches fail. React tests cover validation, provider/network errors, pending states, navigation and sign-out. Playwright runs the full existing smoke suite plus unavailable auth states against a fresh production server with auth env values blanked, on an isolated port. There is no application test-session flag or production-accessible bypass. CI runs auth tests without secrets before building and running browser tests.

Offline tests and screenshots do **not** establish live cookie issuance/security, mail delivery, verification policy, hosted password reset, expiry/remote revocation, CSRF/trusted-origin enforcement, or branch isolation. These are explicit configured-service release gates. This integration is not claimed production-ready until those gates are exercised with synthetic accounts and reviewed.

References: [API-only quick start](https://neon.com/docs/auth/quick-start/nextjs-api-only), [server SDK](https://neon.com/docs/auth/reference/nextjs-server), [branching](https://neon.com/docs/auth/branching-authentication), [production checklist](https://neon.com/docs/auth/production-checklist), [password reset](https://neon.com/docs/auth/guides/password-reset). Earlier architecture/setup documents describe the broader plan; this file records the implemented auth slice and its limits.
