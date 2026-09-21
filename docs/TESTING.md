# Testing Guide

**Status**: Frontend MVP testing framework is live; backend-dependent tests are pending integration PRs. Test suite covers smoke acceptance and browser behavior. Backend feature tests (auth, affiliation, drafts, moderation) documented as pending.

## Quick reference

| Component | Test method | Command | Status |
|---|---|---|---|
| **Build** | CI + local | `npm run build` | ✓ Live |
| **Type-check** | CI + local | `npm run typecheck` | ✓ Live |
| **Lint** | CI + local | `npm run lint` | ✓ Live |
| **Smoke suite** | Playwright (desktop + mobile) | `npm test` | ✓ Live |
| **Auth flow** | Form/session/provider integration | TBD | ⏳ Pending |
| **University affiliation** | Verification codes/email/domain | TBD | ⏳ Pending |
| **Private drafts** | Server auth + ownership checks | TBD | ⏳ Pending |
| **Moderation gate** | Publication checks/model verdicts | TBD | ⏳ Pending |

## Local development testing

### Prerequisites

- Node.js 22 (LTS), npm 10
- Fresh `npm ci` after branch checkout

### Available commands

```bash
npm run dev         # Dev server at http://localhost:3000 (hot reload)
npm run build       # Production build (static generation)
npm run start       # Serve production build at http://localhost:3000
npm run lint        # ESLint (all files)
npm run typecheck   # TypeScript type-check (tsc --noEmit)
npm test            # Playwright suite (requires prior build; serves on port 3001)
```

### Dev server testing

Start the dev server and open http://localhost:3000:

```bash
npm run dev
```

Test manually in browser:
1. **Navigation**: Click links in header, verify routes match URL
2. **Search**: Try home search, verify universities filter/redirect to `/universities?q=`
3. **Filters**: University list country filter, course level filter
4. **Detail pages**: Click university/course/instructor cards, verify detail content
5. **Compare**: Add universities to compare list, verify localStorage persists, test remove
6. **Theme**: Toggle light/dark mode, verify colors and persistence

**Dev server mode**: Hot reload enabled; changes appear immediately. No build required.

### Production build testing (CI path)

```bash
npm run build       # Creates optimized build
npm run start       # Serves on http://localhost:3000
```

Then open http://localhost:3000 and repeat manual tests above.

**Production mode**: Build artifacts are optimized and minified. Matches CI and deployed experience.

### Automated smoke suite

The Playwright test suite runs across two projects (desktop, mobile). See `tests/smoke.spec.ts` for the current test list — do not rely on a hardcoded count here.

```bash
npm run build       # Must build first; smoke suite runs against build output
npm test            # Starts production server on port 3001, runs suite
```

**Smoke suite coverage** (see `tests/smoke.spec.ts` for full list):

Navigation
- Home page loads with demo banner and search
- Home page dark mode toggle
- Header navigation to universities/courses/compare
- University search filters results
- Search empty state shows reset button
- Home search navigates to universities with query

Detail pages
- University detail page loads scores and tabs
- University tabs navigate between overview and reviews
- Course detail page loads
- Instructor detail page loads

Review composer
- Review composer opens and saves to localStorage
- Saved reviews display in localStorage (not sent to server)
- Review composer persists draft on form change

Compare list
- Compare page loads
- Add/remove universities to compare
- Compare list persists in localStorage
- Compare page layout responsive (desktop + mobile)

Empty states
- Missing entity (invalid ID) shows 404-like message
- No results in search shows reset button
- No compare selections shows add-first message

Mobile responsiveness
- Mobile header hamburger menu visible on small viewport
- Mobile detail pages readable (font size, spacing)
- Mobile tap targets adequate
- Touch events work (theme toggle, menu open/close)

**Output**: Playwright generates:
- Console output (pass/fail per test)
- Screenshots on failure (`.github/test-screenshots/`)
- Traces on failure (`.test-results/`, retained 7 days in CI)

Download artifacts from GitHub Actions if any test fails.

## CI testing

CI runs automatically on every PR and push to `main`:

```yaml
# Commands run in order by .github/workflows/ci.yml
npm ci               # Install exact dependencies
npm run lint         # Lint all files
npm run typecheck    # Type-check all files
npm run build        # Build
npx playwright install --with-deps chromium  # Install browser
npm test             # Run smoke suite
```

**CI environment**:
- Ubuntu latest
- Node.js 22 (via setup-node)
- No environment variables needed (frontend only, no database/auth)
- Artifacts uploaded on failure (traces, screenshots, 7 days retention)

**CI passes**: All six steps must succeed before PR can merge (once branch protection is enabled).

## Manual acceptance checklist

Complete this checklist after deploying to preview or production:

### Basic functionality

- [ ] **Home page loads**: Visit `/`, see demo banner, search bar, featured university cards
- [ ] **Navigation works**: Click Universities, Courses, Compare in header — URLs update correctly
- [ ] **Search works**: Enter text on home, redirected to `/universities?q=...`, results filter
- [ ] **University list loads**: Visit `/universities`, see country filter, sort options, cards
- [ ] **University detail loads**: Click a university, see scores, tabs (Overview/Reviews), info
- [ ] **Course list loads**: Visit `/courses`, see level filter, course cards
- [ ] **Course detail loads**: Click a course, see scores, instructor tab
- [ ] **Instructor detail loads**: Click instructor link, see info, reviews, affiliated courses
- [ ] **Compare feature works**: Add up to 3 universities, visit `/compare`, see side-by-side table

### Visual presentation

- [ ] **Light mode**: Page renders with light background, dark text, defined colors
- [ ] **Dark mode**: Click theme toggle → Dark, page renders dark background, light text
- [ ] **System preference**: Click theme toggle → System, colors match OS setting
- [ ] **Mobile layout (Pixel 5, 375px)**:
  - [ ] Header is compact, hamburger menu visible
  - [ ] Text is readable (no horizontal scroll)
  - [ ] Buttons/touch targets are adequate size (≥48px)
  - [ ] Cards stack vertically
- [ ] **Desktop layout (1280px+)**:
  - [ ] Layout is multi-column where appropriate
  - [ ] Cards display in grid
  - [ ] Navigation is horizontal

### Empty states and error handling

- [ ] **No search results**: Search `/universities` for non-matching text, see "no results" message and reset button
- [ ] **Invalid university ID**: Navigate to `/universities/invalid-id`, confirm error or 404 message
- [ ] **Invalid course ID**: Navigate to `/courses/invalid-id`, confirm error or 404 message
- [ ] **Invalid instructor ID**: Navigate to `/instructors/invalid-id`, confirm error or 404 message
- [ ] **No compare selections**: Visit `/compare` with empty selection, see "add universities" prompt
- [ ] **Demo data integrity** (demo/dev branch only): Confirm fixture data loads completely; production starts empty and should show empty-state UI, not fixture data

### Browser persistence

- [ ] **Compare list persists**: Add universities to compare, refresh page, selections remain
- [ ] **Compare list clears**: Click remove button, verify removal is immediate and persists
- [ ] **Draft review saves**: Open review composer on any detail page, type review, click "Save Draft", refresh page, content remains (in localStorage)
- [ ] **Theme preference persists**: Toggle theme, refresh page, preference is remembered
- [ ] **localStorage is isolated**: Open in incognito/private window, verify no data from main window

### Review composer (demo limitation)

- [ ] **Composer opens**: Click "Write a review" on detail page, dialog appears with form
- [ ] **Star rating works**: Click 1–5 stars, selected rating highlights
- [ ] **Text input works**: Type title and body, text appears in fields
- [ ] **Save draft works**: Click "Save Draft", success message appears (no server call)
- [ ] **Draft is localStorage only**: Drafted reviews do not appear in displayed review counts or scores
- [ ] **No publication**: "Publish" button is absent or disabled (MVP limitation)

### Authentication flow — PENDING

**Status**: Auth integration not yet complete. Tests listed here await Neon Auth integration PR.

When auth lands:
- [ ] **Sign-up page loads**: Navigate to `/auth/signup`, form displays with email/password fields
- [ ] **Sign-up works**: Enter email/password, submit, confirm success/error message
- [ ] **Session persists**: After sign-up, refresh page, user remains signed in
- [ ] **Sign-in works**: Sign out, sign in with existing email/password, confirm success
- [ ] **Password reset**: Request reset, check email (mock), click link, set new password
- [ ] **Password reset expiry**: Verify old reset links fail (expire after time)
- [ ] **Sign-out works**: Click sign-out, session cleared, redirect to home
- [ ] **Sign-in required**: Access protected route without auth, redirect to sign-in
- [ ] **Beta limitations**: Confirm any documented beta limitations (e.g., no 2FA, session timing)

### University affiliation — PENDING

**Status**: Affiliation verification not yet implemented. Tests listed here await affiliation PR.

When affiliation lands:
- [ ] **Verification link sent**: After sign-in, click "Verify University", enter email, submit
- [ ] **Verification email received**: Check inbox (mock), click verification link
- [ ] **Verified state displays**: After verification, profile shows "Verified at <University>"
- [ ] **Affiliation required for reviews**: Confirm verified badge appears on user's reviews (when draft feature lands)
- [ ] **Wrong domain rejected**: Try email from non-approved domain, error message appears
- [ ] **Verification expiry**: Old verification codes fail (expire after time)
- [ ] **Rate limiting**: Rapid requests are blocked or throttled
- [ ] **Resend works**: Click "Resend Code", new code sent (mock), old one still valid

### Private drafts — PENDING

**Status**: Server-side drafts not yet implemented. Tests listed here await private draft PR.

When drafts land:
- [ ] **Draft saves server-side**: Sign in, open review composer, type review, click "Save Draft", refresh page, draft persists
- [ ] **Only author sees draft**: Draft author visits review, sees "Your draft — edit" button; other user sees nothing
- [ ] **Draft can be updated**: Edit saved draft, click "Save", changes persist
- [ ] **Draft can be deleted**: Delete draft, confirm removal
- [ ] **Publication disabled**: "Publish" button absent or disabled (moderation gate pending)
- [ ] **Error handling**: Network error while saving draft, error message shown, form preserved

### Live moderation — PENDING

**Status**: Moderation and publication gates not yet implemented. Tests listed here await moderation PR.

When moderation lands:
- [ ] **Publication disabled initially**: Confirm reviews cannot be published (pending moderation gate)
- [ ] **Pending state displays**: After submitting review, state shows "Pending review"
- [ ] **Moderation passes**: Submitted review passes checks, state changes to "Published"
- [ ] **Moderation fails**: Submitted review fails checks, state changes to "Rejected" with reason
- [ ] **Model timeout gracefully handled**: If model times out, review stays pending, not auto-published
- [ ] **Deletion is idempotent**: Author deletes a published review, confirm deletion succeeds multiple times

### Email and DNS — PENDING

**Status**: Email sending and DNS verification require Resend account and domain setup. Tests listed here await configuration.

**Resend test emails**: Use `@resend.dev` test addresses with your standard Resend API key — there is no separate sandbox key. Send to `delivered@resend.dev` (simulates success), `bounced@resend.dev` (hard bounce), or `complained@resend.dev` (spam complaint). Labels are supported: `delivered+scenario1@resend.dev`.

**DNS records**: Resend requires DKIM records (CNAME) and SPF records (TXT/MX, or CNAME for domains created after August 2026). Add records as shown in the Resend dashboard, then use the "Verify DNS Records" button. Do not claim DNS verified until the dashboard shows the domain as verified.

When Resend is configured:
- [ ] **Domain DNS added**: DNS records added per Resend dashboard instructions (DKIM + SPF)
- [ ] **Test email sent**: Send to `delivered@resend.dev` using the Resend dashboard, confirm it appears in the Sent log
- [ ] **Verification email sends**: Trigger verification flow (when auth/affiliation lands), confirm mock/test email received
- [ ] **Reset email sends**: Trigger password reset, confirm email received with link
- [ ] **Production sender domain**: Confirm production `EMAIL_FROM` uses the verified production domain
- [ ] **Preview sender domain**: Confirm preview `EMAIL_FROM` uses the test/dev sender, not production

### Performance and monitoring — OPTIONAL

- [ ] **Lighthouse score**: Run local audit, target ≥90 on desktop (performance, accessibility, best practices)
- [ ] **Build time acceptable**: `npm run build` completes in <60 seconds
- [ ] **Bundle size reasonable**: Analyze build output, confirm no unexpected large packages
- [ ] **Vercel build**: Confirm deployed preview build times are acceptable
- [ ] **No console errors**: Open browser console, confirm no error messages on routes

## CI-specific validation

When running in CI environment (GitHub Actions), the suite automatically:

1. **Installs dependencies**: `npm ci` with exact lockfile versions
2. **Validates code quality**:
   - ESLint catches style/convention violations
   - TypeScript catches type errors
   - Build ensures no compilation errors
3. **Runs smoke suite**:
   - Playwright starts fresh server (no cached state)
   - Runs all tests in `tests/smoke.spec.ts` against desktop and mobile viewports
   - Captures traces/screenshots on failure
   - Cleans up server after tests
4. **Uploads artifacts on failure**:
   - `playwright-failure-<run-id>` contains traces and screenshots
   - Download from GitHub Actions → Run → Artifacts
5. **Enforces zero exit code**: All steps must pass for PR to be mergeable

## Testing database features — PENDING

**Status**: Database foundation PR in progress. Integration tests will use ephemeral PostgreSQL.

When database lands, local testing will require a `TEST_DATABASE_URL` pointing to a local or ephemeral Postgres instance. The integration test command and scope will be documented in that PR.

Database tests will verify:
- Schema migrations apply cleanly
- Seed data loads idempotently
- Server routes return correct data shapes
- No sensitive data in public responses
- Affiliation/identity isolation

## Troubleshooting tests

| Issue | Diagnosis | Resolution |
|---|---|---|
| **`npm test` fails: port 3001 in use** | Previous test run didn't clean up | Identify the process: `lsof -ti:3001` — confirm it is a test server, then kill it: `kill $(lsof -ti:3001)`, then retry |
| **Build fails: out of memory** | Large bundle or insufficient RAM | Increase Node heap: `NODE_OPTIONS=--max-old-space-size=4096 npm run build` |
| **Smoke suite times out** | Server slow to start or tests hanging | Check `npm run start` works standalone; increase timeout in playwright.config.ts |
| **Screenshot differences on CI** | Font rendering differs from local | Update snapshots if intentional, otherwise investigate font/viewport differences |
| **Flaky test: timing-dependent** | Test is racy (relies on animations/delays) | Review test logic, add explicit waits, increase retry count for timing-dependent tests |
| **Test passes locally, fails in CI** | Environment difference (OS, dependencies, ports) | Check Node version matches, investigate CI logs for errors before test started |
| **Type errors in tests** | TypeScript config or import issues | Run `npm run typecheck`, confirm all test files are included in tsconfig.json |

## Related documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Production and preview deployment sequence
- [REPOSITORY-WORKFLOW.md](./REPOSITORY-WORKFLOW.md) — CI workflow, labels, branch protection
- [FRONTEND.md](./FRONTEND.md) — Frontend technical reference, routes, components
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture and backend plans
