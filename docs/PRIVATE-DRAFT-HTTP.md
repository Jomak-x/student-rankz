# Private draft HTTP API

Authenticated users can create, read, update, and delete their own private drafts for real catalog UUID targets. Drafts are never public, never use browser `localStorage`, and never affect public scores or rankings.

## Configuration and migration

Set `DATABASE_URL`, branch-specific Managed Auth variables, and `APP_ORIGIN` to the exact browser origin with no path or trailing slash. Missing configuration denies private operations.

```bash
npm run db:migrate
```

The consolidated journal applies `0000`, `0001` drafts, and `0002` catalog sample reviews. The bridge supports tracked feature-first installs and upgrades older pre-bridge `0001` installs without replaying draft DDL. A collision with manually applied, untracked DDL is not adopted automatically: stop and use a reviewed migration plan. `npm run db:migrate:feature` is retained for source-asset testing and prior tracked installs, not required for a clean or bridged deployment.

## API

All responses use `Cache-Control: private, no-store`.

| Method and route | Input | Result |
| --- | --- | --- |
| `GET /api/drafts` | Optional `limit` and `offset` | Owned paginated draft page |
| `POST /api/drafts` | Create payload below | Created private draft |
| `GET /api/drafts/[id]` | Draft UUID | Owned draft or 404 |
| `PATCH /api/drafts/[id]` | `revision` and one or more editable fields | Updated draft; stale revision is 409 |
| `DELETE /api/drafts/[id]` | Draft UUID | Deleted `{ id }`; owner only |

Example course draft payload; `targetId`, not `courseId`, names the course target:

```json
{
  "targetType": "course",
  "universityId": "00000000-0000-4000-9000-00000000a001",
  "targetId": "00000000-0000-4000-9000-00000000c001",
  "title": "My course notes",
  "body": "A private draft of my experience.",
  "rating": 4,
  "clientRequestKey": "a-new-client-generated-uuid"
}
```

The UUIDs above illustrate the payload shape; a real request must use IDs that exist in its configured catalog. Current draft-service fixtures and mocked-auth tests are not live provider or catalog validation.

For a university draft, omit `targetId` or set it to the same UUID as `universityId`. Course and instructor drafts require a `targetId` belonging to that university. The service rejects unknown fields, malformed IDs, cross-university targets, owner injection, and stale writes. Creates are idempotent by `clientRequestKey`; the same retry returns the original draft.

POST, PATCH, and DELETE require `Content-Type: application/json` where a body is present and an exact allowed `Origin`; cross-site requests are rejected. Error responses are generic and never expose provider, database, ownership, or identity details. Statuses are 400 invalid input, 401 anonymous, 403 bad origin, 404 missing or foreign resource, 409 stale revision, 413 oversized body, 415 non-JSON body, and 503 unavailable dependency.

The review composer uses the database-backed catalog targets directly. It retains input after failed saves and provides retry/revision feedback. No fixture identifiers or local drafts are imported.
