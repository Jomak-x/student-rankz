# Rankings

`/rankings` shows a top-10 list of universities by **student experience** — how
students rate day-to-day life (teaching, support, value, social life), not
academic prestige. A compact top-3 preview with a link to the full page appears
on the home page, and "Rankings" is a first-class nav item in the header.

All scores, review counts and rankings are **demo sample data** from
`lib/demo-data.ts`. The page states this inline ("sample data", "demo data",
"sample reviews") and shows an honest empty state when no institutions exist —
it never invents placeholder records.

## Methodology

Ordering lives in `lib/rankings.ts` (`rankUniversities`) and is fully
deterministic:

1. Higher `scores.overall` first.
2. Tie → higher `reviewCount` first.
3. Still tied → name A–Z (`localeCompare`).

The list is capped at `RANKINGS_LIMIT` (10). The page shows the actual number
of entries — with 7 fixture universities it displays 7, never padded to 10.

## Files

| File | Purpose |
|---|---|
| `lib/rankings.ts` | Pure ranking/sort/cap logic, no UI |
| `components/rankings-list.tsx` | `RankingsList` (ranked rows) + `RankingsEmpty` (empty state) |
| `app/rankings/page.tsx` | Static `/rankings` page |
| `tests/rankings.spec.ts` | Sort/tie-break/cap/empty-state units + page, nav, preview, overflow, composer-save-error regression |

## Known limits

- No backend read yet — the list is computed from fixtures at build/render
  time. A later PR swaps fixtures for DB data; `rankUniversities` already
  accepts any `University[]`.
- Rankings update only when fixture data changes; there is no recalculation
  from locally saved reviews (those are never published or counted).

## Parallel test runs

The Playwright suite serves on port 3001 by default. To run it from a second
worktree without clashing with another local server:

```bash
PLAYWRIGHT_PORT=3113 npx playwright test
```
