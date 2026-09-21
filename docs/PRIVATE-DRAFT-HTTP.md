# Private draft integration

The draft service and HTTP routes store private university, course, and instructor drafts. Login is sufficient; university email verification is not required. Nothing is published and drafts never contribute to rankings.

## Configuration and migration

Set `DATABASE_URL`, managed auth variables from `AUTH.md`, and `APP_ORIGIN` to the exact browser origin, such as `https://preview.example.test` (no path or trailing slash). Missing configuration denies writes. Origins are never inferred from request Host or forwarded headers. Use a different provider endpoint and cookie secret for each environment.

Run `npm run db:migrate` with the direct database connection. The journal applies directory migration `0000` then private drafts `0001`. The draft schema and generated snapshot declare exactly three named foreign keys. Do not separately apply `db/feature-migrations/private-drafts.sql` in a new installation: that asset is retained for the source service's independent tests. For an environment where that feature asset was already manually applied, reconcile the migration journal through a reviewed migration plan before running `0001`; do not delete tables to bypass it. No automatic down migrations exist.

## API

All responses use `Cache-Control: private, no-store`. Private reads and writes call `getVerifiedWriteSession()` so a cached display identity cannot override provider revocation or outage. Each service operation constrains ownership using the validated provider subject. The subject is never accepted from request data or returned in draft DTOs.

| Method and route | Input | Result |
|---|---|---|
| `GET /api/drafts` | Optional `limit` and `offset` query integers | `{ items, hasMore, nextOffset }` owned page |
| `POST /api/drafts` | Create fields below | Private draft DTO |
| `GET /api/drafts/[id]` | Draft UUID | Owned DTO or 404 |
| `PATCH /api/drafts/[id]` | `revision` plus `title`, `body`, and/or `rating` | Updated DTO; stale revision returns 409 |
| `DELETE /api/drafts/[id]` | Draft UUID | `{ id }`; owner only |

Example POST body (synthetic IDs must exist in the configured directory):

```json
{
  "targetType": "course",
  "universityId": "00000000-0000-4000-9000-00000000a001",
  "courseId": "00000000-0000-4000-9000-00000000c001",
  "title": "My course notes",
  "body": "A private draft of my experience.",
  "rating": 4,
  "clientRequestKey": "a-new-client-generated-uuid"
}
```

Mutation requests must send the exact allowed Origin. POST and PATCH require `Content-Type: application/json` and a bounded body. Cross-site requests are rejected. The browser supplies Origin automatically; no client identity or CSRF bypass flag exists. Error payloads contain generic `{ error: { code, message } }`, never provider/database diagnostics. Oversized bodies are 413 and unsupported content types are 415. Invalid input is 400, anonymous access 401, disallowed origin 403, missing/foreign resources 404, revision conflict 409, and unavailable dependencies 503.

The service rejects unknown fields, invalid IDs, cross-university targets, and owner injection. A create retry uses the same client request key and returns the original draft, without applying a changed payload. Updates must include the revision last read. Deletion wins over later stale updates; targets are immutable.

## UI boundary

`/account/drafts` lists, edits, and deletes owned drafts, with empty, error, retry, and stale-revision feedback. The Account page links to it. Input is retained on a failed save. The server composer is selected by supplying a database `universityId` to `ReviewComposer`, alongside a database target ID. Until the separately owned catalog service and page wiring arrive, current fixture pages continue to use the explicitly labelled local demo composer. No fixture identifier is sent as a database ID and old local drafts are never imported.

Offline auth/HTTP/React tests mock provider or request boundaries. Database tests use ephemeral PostgreSQL and real constraints. Browser screenshots show unconfigured states unless explicitly labelled as component fixtures. None establish live provider cookies, hosted session revocation, email, or Neon HTTP transport behavior.
