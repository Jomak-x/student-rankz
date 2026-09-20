# Student Rankz — Frontend MVP

A polished Next.js prototype for EU university and course experience reviews. **All data is demo sample data** — no real reviews, rankings, or user data.

## Quick start

```bash
npm install
npm run dev       # http://localhost:3000
```

## Build & check

```bash
npm run build     # production build (static export)
npm run lint      # ESLint
npm run typecheck # TypeScript
npm test          # Playwright smoke suite
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Next.js, port 3000) |
| `npm run build` | Production build with static generation |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Playwright browser smoke tests |

## Pages

| Route | Description |
|---|---|
| `/` | Home — search + featured universities |
| `/universities` | List with country filter + sort |
| `/universities/[id]` | Detail: scores, reviews, courses, instructors |
| `/courses` | Course list with level filter |
| `/courses/[id]` | Course detail with instructor tab |
| `/instructors/[id]` | Instructor detail + reviews |
| `/compare` | Side-by-side comparison of up to 3 universities |

## Prototype behaviour

- **Demo data**: All universities, courses, instructors and reviews are fictional fixtures. No real identities are used.
- **Review composer**: Saves drafts to `localStorage` only — nothing is published, sent to a server, or added to displayed rating totals.
- **Compare**: Selection persists in `localStorage` across page loads.
- **Theme**: Light/dark/system preference persists via `next-themes` (stored in `localStorage`).
- **No auth, no backend, no env vars required** — builds and runs entirely offline.

## Tech stack

- [Next.js 15](https://nextjs.org) (App Router, static generation)
- [React 19](https://react.dev)
- [TypeScript](https://typescriptlang.org)
- [Tailwind CSS v4](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com) (base-nova style, base-ui primitives)
- [next-themes](https://github.com/pacocoursey/next-themes) — theme management
- [lucide-react](https://lucide.dev) — icons
- [Playwright](https://playwright.dev) — browser smoke tests

## Related docs

- [docs/BACKEND-SETUP.md](docs/BACKEND-SETUP.md) — backend architecture (arriving in a separate PR)
