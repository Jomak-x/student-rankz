# Frontend — Technical Reference

Next.js 16.3.5 App Router prototype for EU university, course, and instructor experience reviews. All data is demo sample data.

## Directory map

```
app/                        Next.js App Router pages and layout
  layout.tsx                Root layout: ThemeProvider, DemoBanner, Header, Toaster
  globals.css               Tailwind v4 import, oklch colour tokens, font variables, base-ui overlay fix
  page.tsx                  Home: search form + 6-card university grid
  universities/
    page.tsx                Filterable/sortable university list
    [id]/page.tsx           University detail: scores, tabs (Overview / Reviews), review composer
  courses/
    page.tsx                Course list with level filter
    [id]/page.tsx           Course detail: scores, instructor tab
  instructors/
    [id]/page.tsx           Instructor detail: scores, affiliated courses, reviews
  compare/page.tsx          Side-by-side comparison table (up to 3 universities)

components/
  ui/                       shadcn base-nova components (base-ui primitives, NOT Radix)
  demo-banner.tsx           Compact dismissible "Demo · sample data" bar
  header.tsx                Nav + mobile hamburger + theme toggle
  review-composer.tsx       Dialog form: star rating, title, body → localStorage only
  compare-toggle.tsx        "Add to comparison" button (reads/writes compare store)
  review-card.tsx           Renders a single fixture review
  score-bar.tsx             Labelled horizontal progress bar for category scores
  star-rating.tsx           Interactive 1–5 star picker
  university-card.tsx       Card used on home and /universities list
  theme-provider.tsx        Re-exports next-themes ThemeProvider

hooks/
  use-local-storage.ts      SSR-safe localStorage hook; returns [value, setter, hydrated]
  use-compare.ts            Compare store (wraps use-local-storage, key student-rankz-compare)

lib/
  demo-data.ts              All fixture data + TypeScript types
  utils.ts                  cn() utility (clsx + tailwind-merge)

tests/
  smoke.spec.ts             Playwright smoke suite (38 test cases, 19 per project)

playwright.config.ts        2 projects: desktop (Desktop Chrome) + mobile (Pixel 5, Chromium)
```

## Routes

| Route | Static params source | Notes |
|---|---|---|
| `/` | — | Home page |
| `/universities` | — | `?q=` pre-fills search from home |
| `/universities/[id]` | `generateStaticParams` over `universities` | |
| `/courses` | — | |
| `/courses/[id]` | `generateStaticParams` over `courses` | |
| `/instructors/[id]` | `generateStaticParams` over `instructors` | |
| `/compare` | — | Client component, localStorage-driven |

All pages are statically generated at build time (`output: "export"` not set; uses default Node server).

## Demo fixture data (`lib/demo-data.ts`)

### Types

```ts
University  { id, name, city, country, countryCode, founded, type,
              website, description, studentCount, scores{…7}, reviewCount, tags }
Course      { id, universityId, code, name, department, credits, level,
              semester, instructorIds, scores{…5}, reviewCount, tags, description }
Instructor  { id, universityId, name, role, department, courses,
              scores{overall,clarity,support,expertise,engagement}, reviewCount }
Review      { id, targetId, targetType, author, date, rating, title, body, helpful }
```

### Fixture universities (7, all EU)

| id | Name | Country |
|---|---|---|
| `tum` | Technical University of Munich | Germany |
| `unibo` | University of Bologna | Italy |
| `kth` | KTH Royal Institute of Technology | Sweden |
| `sorbonne` | Sorbonne University | France |
| `maastricht` | Maastricht University | Netherlands |
| `uhelsinki` | University of Helsinki | Finland |
| `lmu` | LMU Munich | Germany |

Courses and instructors are associated with TUM and Bologna. All scores, review counts, and review bodies are illustrative sample values — not real published data.

## Browser persistence

| localStorage key | Written by | Read by | Cleared by |
|---|---|---|---|
| `student-rankz-compare` | `use-compare.ts` (CompareToggle) | `compare/page.tsx`, CompareToggle | "Remove" button on compare page |
| `student-rankz-pending-reviews` | `review-composer.tsx` (Save Draft) | Not read back by the UI — storage only | Not cleared by the UI |
| `theme` | `next-themes` | `next-themes` | Theme picker (System resets) |

**Hydration guard**: `use-local-storage` returns `hydrated: false` on first render (SSR/server pass) and reads from `window.localStorage` only inside a `useEffect`. Components dependent on stored state should check `hydrated` before rendering compare-count badges or draft restore to avoid hydration mismatch.

Saved reviews are never sent to any server. They do not affect displayed review counts or overall scores.

## Theme

- Provider: `next-themes` with `attribute="class"` — adds `class="dark"` to `<html>`.
- Tokens: defined as CSS custom properties on `:root` / `.dark` in `app/globals.css`.
- Accent: `--primary: oklch(0.65 0.22 52)` (orange, light) / `oklch(0.72 0.20 52)` (dark).
- Font: `--font-sans: var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif)` — Geist Sans loaded via `next/font/google` in `app/layout.tsx`, falls back to system sans.

## shadcn / base-ui notes

The `base-nova` style uses `@base-ui/react` primitives, **not Radix UI**. Key differences:

- No `asChild` prop — use `render` prop instead: `<DialogTrigger render={<Button />} />`
- `Select.onValueChange` returns `string | null` (not `string`) — always null-coalesce: `(v) => setState(v ?? "all")`
- `Dialog.Backdrop` renders as a `position:fixed; inset:0` div with `data-base-ui-inert` **before** the dialog popup in the portal. Without explicit z-index it falls below `z-50` but can intercept pointer events in headless browsers. Fixed via:
  - Dialog overlay: `z-[55]`, popup: `z-[60]` (in `components/ui/dialog.tsx`)
  - `[data-base-ui-inert] { pointer-events: none }` (in `app/globals.css`)

## npm commands

| Command | What it does |
|---|---|
| `npm ci` | Install exact versions from `package-lock.json` |
| `npm run dev` | Next.js dev server at `http://localhost:3000` |
| `npm run build` | Production build (static generation of all routes) |
| `npm run start` | Serve production build at `http://localhost:3000` |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build && npm test` | Build then run the full Playwright smoke suite |
| `npm test` | Run Playwright smoke suite (requires a prior `npm run build`) |

`npm test` starts a **fresh production server** (`reuseExistingServer: false`, port 3001). Always run `npm run build` first — `npm test` alone does not trigger a build.

## Screenshot workflow

Test screenshots land in `test-screenshots/<project>/` (gitignored). Two projects:

- `desktop/` — Desktop Chrome viewport
- `mobile/` — Pixel 5, Chromium

Committed review assets live in `.github/previews/frontend-mvp/` and are embedded in PR descriptions. Regenerate them after any visual change:

```bash
npm test
cp test-screenshots/desktop/01-home-light.png .github/previews/frontend-mvp/home-light.png
# … repeat for home-dark, university-detail, review-dialog
cp test-screenshots/mobile/07-home-mobile.png .github/previews/frontend-mvp/home-mobile.png
```

Keep committed previews ≤ 500 KB each.

## Known prototype limits

- No backend, no auth, no environment variables required.
- Review drafts saved to `localStorage` only — never published or counted.
- Compare is capped at 3 universities by the UI; no API enforces this.
- All fixture scores and review counts are sample values, not real data.
- `docs/ARCHITECTURE.md` and `docs/BACKEND-SETUP.md` are owned by the backend worker and arrive in a separate PR.
