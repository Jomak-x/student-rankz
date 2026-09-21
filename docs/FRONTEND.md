# Frontend technical reference

The frontend is a Next.js 16.3.5 App Router prototype. The public catalog remains a fixture demo while database reads are integrated separately. Managed auth has its own routes and server session helper; it is unavailable until the provider environment is configured.

## Directory map

```text
app/                        App Router pages and layout
  sign-in/, sign-up/        Managed-auth forms
  account/                  Server-verified account view
  api/auth/[...path]/       Same-origin managed-auth proxy
  rankings/                 Fixture-backed rankings page
  universities/, courses/,
  instructors/, compare/   Public fixture-backed catalog routes
components/                 UI and feature components
  auth/                     Auth forms, shell, unavailable state, sign-out
  review-composer.tsx       Local-only review draft form
hooks/                      SSR-safe localStorage and compare state
lib/demo-data.ts             Public fixture data and types
lib/auth/                    Client/server auth adapters and session boundary
server/db.ts                 Lazy server-only Neon database access
db/                          Drizzle schema, migration config, and synthetic seed
tests/                       Playwright, auth, and database tests
```

## Runtime boundary

The public routes currently import fixture data. They do not silently fall back from a database failure because they do not query the database yet. The pending catalog integration owns server-side reads, controlled search/pagination, and distinct missing-config, empty-database, outage, and explicitly selected demo states. Do not document or build an interface for that work until its owner lands it.

The review composer saves to `student-rankz-pending-reviews` in `localStorage`. These drafts are private to the browser, are not read back into the public UI, and do not alter scores or review counts. The account draft manager uses the private HTTP API. Database catalog pages will select the server composer by passing database university and target IDs. See [PRIVATE-DRAFT-HTTP.md](./PRIVATE-DRAFT-HTTP.md).

The compare list uses `student-rankz-compare`; the theme uses `theme`. The SSR-safe local-storage hook reads browser state only after hydration.

## Fixture model and routes

The fixture model contains `University`, `Course`, `Instructor`, `Review`, and `PendingReview` values. Universities carry identity, location, description, student count, category scores, tags, and a sample review count. Courses belong to a university and carry code, credits, level, term, instructor IDs, scores, tags, and a sample review count. Instructors belong to a university and carry role, department, course IDs, scores, and a sample review count. Fixture review bodies and aliases are illustrative and are not published records.

The route behavior is:

| Route | Behavior |
|---|---|
| `/` | Search entry point and featured fixture universities |
| `/universities` | Fixture list with country filter and sort |
| `/universities/[id]` | Fixture detail, scores, tabs, and local review composer |
| `/courses`, `/courses/[id]` | Fixture course list and detail |
| `/instructors/[id]` | Fixture instructor detail and reviews |
| `/rankings` | Deterministic fixture ordering by score, sample review count, then name |
| `/compare` | Up to three fixture universities from browser storage |

Dynamic fixture routes obtain static params from `lib/demo-data.ts`; they are not database slugs or a server data contract.

## Auth navigation

Account is available from the shared desktop and mobile navigation. The account page displays only a provider-verified identity. Missing or invalid auth configuration produces a short unavailable state. See [AUTH.md](./AUTH.md) for the pinned SDK, `getVerifiedSession()` boundary, cookie-cache limitation, and configured-provider release gates.

## UI conventions

- `@base-ui/react` primitives back the base-nova components; they are not Radix components.
- `Select.onValueChange` can return `null`; callers coalesce it before setting state.
- Dialog backdrop and popup z-index rules are defined in `components/ui/dialog.tsx` and `app/globals.css`.
- Light, dark, and system themes use `next-themes` and the CSS tokens in `app/globals.css`.

The `base-nova` components use `@base-ui/react`. They do not support Radix's `asChild`; use the component's `render` prop where needed. Dialog overlays use explicit z-indexes and disable pointer events on the base-ui inert backdrop so headless browser clicks reach the popup.

## Verification

```bash
npm run lint
npm run typecheck
npm run test:auth
npm run build
npm test                         # default Playwright port 3001
PLAYWRIGHT_PORT=3127 npm test   # integration worktree port
```

The integration worktree uses 3127 for browser checks to avoid the other reserved local ports (3001, 3107, and 3113). Playwright starts a fresh production server; run `npm run build` first.

Screenshots used for frontend review belong under `.github/previews/<branch-slug>/`, are limited to 500 KB each, and must describe demo behavior accurately. No screenshot establishes live database, auth, email, or deployment behavior.

The Playwright projects are desktop Chromium and a Pixel 5 mobile Chromium viewport. To refresh local screenshots after a visual change, run the build and browser suite, then copy selected files from `test-screenshots/desktop/` or `test-screenshots/mobile/` into the branch preview directory. Keep preview assets small and describe them as demo states.
