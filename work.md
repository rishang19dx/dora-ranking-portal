# ARP Project - Work & Decision Log

## Team Member: Yash
## Current Phase: Phase 1 (Core NIRF Workflow)
## Week: 1
## Current Blockers: None

### Update: 01
**Date:** 2026-09-03
**Task:** Baseline Integration & Teammate Sync
**Time Logged:** 1.50 Hours (90 minutes)

#### Technical Decisions Logged:
*   **Assessment:** Evaluated the teammate's NIRF API and organogram work (`origin/custom_nirf_n_organogram`), deciding to harden the cache invalidation boundary before building more workflow features.
*   **Integration:** Confirmed the existing Next.js build passes, then integrated commit `9ff3246` into the working tree without creating a commit to prioritize core workflow features.
*   **Conflict Resolution:** Resolved the sole `package-lock.json` conflict by preserving the local `@types/react-dom 19.2.5` entry.
*   **Version Control:** Excluded generated Python bytecode from source tracking and added Python cache patterns to `.gitignore`.

### Update: 02
**Date:** 2026-09-03
**Task:** Cache Invalidation Security & Validation
**Time Logged:** 1.00 Hour (60 minutes)

#### Technical Decisions Logged:
*   **Security Implementation:** Added a shared secret requirement (`REVALIDATION_SECRET`) to the Next.js revalidation route and updated the Python scraper callback to send the secret, failing loudly if unconfigured.
*   **Environment Configuration:** Added the secret to `.env.example` without placing a real credential in the repository.
*   **Validation:** Verified the production build passes with the dynamic `/api/revalidate` route and that Python syntax compilation passed for `app.py` and `scraper.py`. 
*   **Scope Decision:** Deferred wiring the NIRF utility into the public page until deployment topology and public fallback behaviors are finalized.

### Update: 03
**Date:** 2026-09-03
**Task:** Phase 1 - Nodal Officer Upload Portal UI
**Time Logged:** 2.00 Hours (120 minutes)

#### Technical Decisions Logged:
*   **UI Implementation:** Replaced the placeholder wizard in `src/app/(dashboard)/nodal-officer/submissions/new/page.tsx` with a focused client-side form for department-scoped submissions.
*   **Data Collection Fields:** Added required title and metric category fields, structured raw data input (`.xlsx`/`.csv`), and proof input (`.pdf`/`.docx`) alongside repository audit helper text.
*   **Workflow Alignment:** Added dummy `onSubmit` behavior with `preventDefault()` and a persistent `PENDING` success state to match the required Maker-Checker submission workflow.
*   **UI/UX & Documentation:** Utilized `lucide-react` icons and a white card layout, recorded design decisions in `decision_history.md`, and verified `npm run build` passes (including linting and TypeScript checks).

### Update: 04
**Date:** 2026-09-09
**Team Member:** Krishna
**Week:** 2
**Task:** Phase 1 - Organogram-Driven Data Collection & Nodal Officer Access
**Time Logged:** 6.00 Hours (360 minutes)

#### Technical Decisions Logged:
*   **Organogram Modelling:** Converted `Institute_Organogram.md` into a typed, queryable hierarchy in `src/lib/organogram.ts` (56 units across governance, executive, academic, administrative and functional layers) with per-unit data custodianship, and rendered it as a reusable searchable/selectable tree component.
*   **Targeted Requests:** Built the three-step request composer (sections -> required data -> message) with per-section narrowing of the requested items, live recipient resolution, coverage warnings, and a templated email preview.
*   **Access Provisioning:** Dispatch now issues one hashed, expiring, single-section upload grant per recipient; reminders rotate links, closing a request or removing an officer revokes them, and uploads are scoped and checksummed server-side.
*   **Persistence Strategy:** Kept all workflow state behind a single file-backed repository module (`src/lib/server/store.ts`) with mirrored Prisma models added to the schema, so connecting Postgres later touches one file.
*   **Validation:** `npm run build` passes; the full flow (create officer -> dispatch -> outbox email -> portal upload -> status roll-up -> reminder rotation -> close/revoke) was exercised end to end against a dev server, including rejection of wrong-format, out-of-scope, revoked and invalid-token uploads.


---

Done. Here's what's in place for the frontend (frontend/ — the active React 19 + Vite SPA; the stray src/ + tsconfig.json at repo root is dead Next.js code from before the migration and was left untouched).

### Static Analysis & Type Checking

Added ESLint 9 flat config (frontend/eslint.config.js): @typescript-eslint recommended rules, react-hooks (classic rules-of-hooks + exhaustive-deps, not v7's new React-Compiler-readiness bundle — that bundle flags idiomatic fetch-in-useEffect patterns across nearly every view as errors, which is a separate opt-in decision, not a side effect of wiring up linting), and react-refresh.
tsconfig.json already had strict: true; added vitest/globals and @testing-library/jest-dom types so test files type-check too.
Baseline result: 0 type errors, lint is 0 errors / 80 pre-existing warnings (unused imports, a few any usages, one missing-dep warning) — nothing blocking, all flagged as warnings for later cleanup.

### Unit Testing

Installed Vitest 3 + @vitest/coverage-v8 + React Testing Library 16 (React 19-compatible) + jest-dom + user-event, with vitest.config.ts (jsdom env, globals, coverage via v8) and a setup file auto-cleaning the DOM between tests.
Wrote 67 tests across 5 files, all passing:
* utils/helpers.test.ts — rank-change math, status badges, date formatting
* lib/organogram.test.ts — org-tree lookups, breadcrumbs, ancestors/descendants, search, scope aggregation (99.7% line coverage on this file)
* lib/data-catalogue.test.ts — data-item/custodian/suggestion/proof-format logic (100%)
* components/RankingCard.test.tsx and components/Footer.test.tsx — rendering + click behavior (both 100%)
Caught and fixed real bugs in my own test assumptions along the way (e.g. unitLabel prefers shortName), confirming the tests actually exercise the real logic.

### Scripts & CI

* frontend/package.json: added typecheck, lint, lint:fix, test, test:watch, test:coverage, validate (runs all three).
* Root package.json: test:frontend now runs the full validate pipeline; added lint:frontend/typecheck:frontend.
* .github/workflows/ci-cd.yml: the frontend-build job now runs lint → typecheck → vitest → build, so these gates run on every push/PR.
* Verified npm run build still succeeds after all changes.

One thing to flag: dependencies were installed with npm, updating frontend/package-lock.json, but CI uses Bun with bun.lock. I didn't have Bun available locally to regenerate that lockfile. The workflow already falls back to a non-frozen bun install if the frozen-lockfile install fails, so CI won't break, but bun.lock is now stale — worth running bun install once from a machine with Bun to refresh it.
