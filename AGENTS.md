<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository map

```
app/                    Next.js App Router pages
components/             React components (ui/ = shadcn base-nova primitives)
hooks/                  Client-side hooks (localStorage, compare)
lib/                    Fixture data and utilities
tests/                  Playwright smoke suite
docs/FRONTEND.md        Frontend technical reference (routes, data, persistence, theme)
docs/ARCHITECTURE.md    System architecture — backend worker, separate PR
docs/BACKEND-SETUP.md   Backend setup guide — backend worker, separate PR
README.md               Quick start and overview
```

Read the relevant scoped doc before editing. Frontend work: read `docs/FRONTEND.md`. Backend/infrastructure work: read `docs/ARCHITECTURE.md` and `docs/BACKEND-SETUP.md`.

## Delegation guidance

Spawn sub-agents only when tasks are genuinely independent and the benefit outweighs cold-start overhead. A single-file change or a focused bug fix does not need a sub-agent. When you do spawn, give the agent a bounded scope (specific files + acceptance criteria), prefer economical models for simple tasks, and report real blockers rather than guessing.

Work autonomously on routine changes. Stop and report only when:
- The task requires a decision only the user can make (scope, product, credentials)
- A tool call was denied and you cannot proceed without it
- You discover unexpected state that could destroy work if overwritten

## Branching and isolation

- Work in an isolated branch or worktree. Never commit directly to `main`.
- Do not overwrite uncommitted user changes. Run `git status` before any checkout, reset, or rm that could discard work.
- Never auto-merge. Open a PR and wait for review.

## Verification commands

```bash
npm run build      # must pass before any PR
npm run lint       # zero new warnings
npm run typecheck  # zero errors
npm test           # all smoke tests green (runs against production build on port 3001)
```

Run all four before marking a PR ready.

## PR conventions

### Frontend PRs
- Commit screenshots to `.github/previews/<branch-slug>/` (desktop light, desktop dark, mobile, key interaction state; ≤ 500 KB each)
- Embed screenshots in the PR description with raw GitHub URLs pinned to the final HEAD SHA
- Describe implemented flows, demo-only limitations, exact validation results, and known issues
- Distinguish prototype/demo behaviour from shipped production behaviour
- Never include private planning documents, credentials, or browser session data

### Backend PRs
- Explain what changed and why (motivation, not just diff summary)
- Include relevant API endpoint, schema, or env-var examples where useful
- Cover migration steps, compatibility implications, and test strategy
- Distinguish proposals from implemented behaviour

### All PRs
- Run and report build, lint, typecheck, and test results before marking ready
- Never include private research content, credentials, or browser tokens in commits or PR descriptions
- No auto-merge — open the PR and let it be reviewed
