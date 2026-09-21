# Student Rankz architecture

The Next.js App Router application reads public universities, courses, instructors, reviews, and rankings through the server-only catalog service. `readCatalog()` maps missing configuration and infrastructure failures to public notices; list queries are bounded before reaching SQL. Demo rows are stored in the database and identified as synthetic only when `CATALOG_MODE=demo`.

```mermaid
flowchart TB
  Browser --> Pages[Next.js pages and GET filters]
  Pages --> Catalog[server/catalog]
  Catalog --> DB[(PostgreSQL)]
  Browser --> Composer[Authenticated review composer]
  Composer --> DraftAPI[/api/drafts]
  DraftAPI --> Drafts[server/drafts ownership service]
  Drafts --> DB
  Browser --> Compare[local compare slugs]
  Compare --> CompareAPI[/api/catalog/compare]
  CompareAPI --> Catalog
  Auth[Managed Neon Auth] --> DraftAPI
```

The public catalog has no fixture fallback. Scores and review counts are aggregates of stored public sample reviews in demo mode. A null score is rendered honestly; rankings only use returned catalog rows.

Drafts use verified managed-auth subjects, real catalog UUID targets, strict request validation, exact-origin checks for mutations, ownership constraints, idempotent creates, revisions, and private no-store responses. Drafts never appear in public reads or alter aggregates. Browser catalog persistence is limited to up to three compare slugs in `student-rankz-catalog-compare`.

Production starts empty. Synthetic demo/development branches come from synthetic parents in the same Neon project; no production data or identities may be copied into them. Migrations and seeds are explicit operator actions, never build or deployment steps.

University affiliation remains unavailable pending approval. Public posting, publication, AI moderation, and draft-driven score changes are deferred. See [BACKEND-SETUP.md](BACKEND-SETUP.md), [PRIVATE-DRAFT-HTTP.md](PRIVATE-DRAFT-HTTP.md), and [INTEGRATION.md](INTEGRATION.md).
