# Student Rankz — Frontend MVP

A Next.js prototype for EU university, course, and instructor experience reviews. All universities and instructors are real institutions; scores and reviews are illustrative sample data only — not real rankings or published reviews.

## Prerequisites

- Node.js 22 (LTS)
- npm 10

## Quick start

```bash
npm ci
npm run dev      # http://localhost:3000
```

## Commands

| Command | Description |
|---|---|
| `npm ci` | Install exact locked dependencies |
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` | Production build (static generation) |
| `npm run start` | Serve production build at http://localhost:3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm test` | Playwright smoke suite (requires prior `npm run build`; serves on port 3001) |

## Pages

| Route | Description |
|---|---|
| `/` | Home — search + featured university cards |
| `/universities` | List with country filter and sort |
| `/universities/[id]` | Detail: category scores, reviews, courses, instructors |
| `/courses` | Course list with level filter |
| `/courses/[id]` | Course detail with instructor tab |
| `/instructors/[id]` | Instructor detail and reviews |
| `/compare` | Side-by-side comparison of up to 3 universities |

## Runtime versions

- Next.js 16.3.5 (App Router, static generation)
- React 19
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui base-nova (base-ui primitives)
- Playwright latest

## Demo capabilities and limits

- **Data**: 7 EU universities, sample courses and instructors with illustrative scores and fictional student reviews.
- **Review composer**: Saves drafts to `localStorage` only. Nothing is published, sent to a server, or counted in displayed totals.
- **Compare**: Selection persists in `localStorage` across page loads. Capped at 3 universities.
- **Theme**: Light / dark / system preference persists via `next-themes`.
- **No auth, no backend, no environment variables required** — builds and runs entirely offline.

## CI

Every PR and push to `main` runs lint → typecheck → build → Playwright smoke tests (38 cases, desktop + mobile Chromium). Playwright traces and screenshots are uploaded as artifacts on failure. See [docs/REPOSITORY-WORKFLOW.md](docs/REPOSITORY-WORKFLOW.md) for setup and bootstrap steps.

## Related docs

- [docs/FRONTEND.md](docs/FRONTEND.md) — directory map, routes, fixture types, browser persistence, theme, shadcn/base-ui notes, npm commands, screenshot workflow, known limits
- [docs/REPOSITORY-WORKFLOW.md](docs/REPOSITORY-WORKFLOW.md) — CI workflows, labels, branch protection bootstrap, PR process
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system architecture (backend worker, arriving in a separate PR)
- [docs/BACKEND-SETUP.md](docs/BACKEND-SETUP.md) — backend setup guide (backend worker, arriving in a separate PR)
