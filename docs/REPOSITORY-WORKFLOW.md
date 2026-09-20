# Repository Workflow

## Workflows

### `CI` (`.github/workflows/ci.yml`)

**Triggers**: every `pull_request` event; every push to `main`.

**Concurrency**: one run per ref. A new push cancels any still-running job for the same branch or PR.

**Permissions**: `contents: read` only — no write access, no secrets, no deployment.

**Steps in order**:

| Step | Command | Fails fast |
|---|---|---|
| Install | `npm ci` | yes |
| Lint | `npm run lint` | yes |
| Type-check | `npm run typecheck` | yes |
| Build | `npm run build` | yes |
| Install browsers | `npx playwright install --with-deps chromium` | yes |
| Smoke tests | `npm test` | yes |

`npm test` runs `playwright test`. The Playwright config starts a **fresh** production server on port 3001 (`reuseExistingServer: false`) using the `npm run build` output from the previous step.

**Failure artifacts**: when any step fails, traces (`test-results/`) and screenshots (`test-screenshots/`) are uploaded as artifact `playwright-failure-<run-id>`, retained 7 days. Download from the Actions run page under *Artifacts*.

---

### `Label PR` (`.github/workflows/label.yml`)

**Trigger**: `pull_request_target` — opened, synchronize, reopened.

**What it does**: applies labels from `.github/labeler.yml` based on which files the PR touches. Uses `actions/labeler@v5`, which reads the changed-file list via the GitHub API. **No code is checked out. No PR code is executed.**

**Permissions**: `pull-requests: write` only.

**Label mappings**:

| Label | Matched paths |
|---|---|
| `frontend` | `app/**`, `components/**`, `hooks/**`, `lib/**`, `tests/**`, `playwright.config.ts`, `**/*.css`, `next.config.*`, `.github/previews/**` |
| `backend` | `server/**`, `api/**`, `prisma/**`, `migrations/**` |
| `ci` | `.github/workflows/**`, `.github/labeler.yml` |
| `documentation` | `docs/**`, `README.md`, `AGENTS.md`, `.github/PULL_REQUEST_TEMPLATE.md` |

Existing repo labels `enhancement` and `documentation` are applied manually by contributors or the orchestrator.

---

## Bootstrap: first-time setup (post-merge steps)

The workflow files live on `polly/frontend-mvp` and are **not active until merged to `main`**. Until PR#2 merges:

- CI does not run on PR#2 itself.
- Label automation does not run on PR#2.
- No check runs appear on `main`.

After PR#2 merges to `main`, run these one-time steps:

### 1 — Create missing labels

The `frontend`, `backend`, and `ci` labels do not yet exist. Create them once:

```bash
gh label create frontend  --repo Jomak-x/student-rankz \
  --color "e4710f" --description "App, components, hooks, lib, tests, styles"
gh label create backend   --repo Jomak-x/student-rankz \
  --color "0075ca" --description "Server, API, database, migrations"
gh label create ci        --repo Jomak-x/student-rankz \
  --color "f9c74f" --description "GitHub Actions and CI configuration"
```

Labels are documented in `.github/labels.yml` for reference.

### 2 — Enable branch protection (after first successful check run)

Do not configure required status checks on an empty check history — GitHub will reject PRs permanently if no check has ever run. Wait for the first PR after merge to complete its CI run, then:

1. Go to **Settings → Branches → Add rule** for `main`.
2. Enable **Require status checks to pass before merging**.
3. Search for and add: `build-and-test`.
4. Enable **Require branches to be up to date before merging**.
5. Do **not** enable auto-merge or force-push bypass.

---

## PR process

- Every change goes through a PR. No direct commits to `main`.
- No auto-merge. PRs are merged by a human after review.
- No deployment or production operations are triggered by CI — it is build and test only.
- Use the PR template (`.github/PULL_REQUEST_TEMPLATE.md`): describe the change and why, fill the validation checklist, attach screenshots for frontend changes.

## Action version pinning

The workflows use `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, and `actions/labeler@v5`. These are the current stable major-version tags. For stricter supply-chain security, replace each tag with a full commit SHA from the action's releases page and add a comment with the tag it resolves to.
