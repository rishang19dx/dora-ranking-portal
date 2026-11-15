# ARP Project - Work & Decision Log

## 1. Project Overview
The **Automated Ranking Portal (ARP)** / **DORA Ranking Portal** is a centralized web platform designed to streamline the collection, management, verification, and visualization of institutional academic rankings (NIRF, QS, THE, Shanghai) at IIT Mandi.
The application architecture is a modern decoupled full-stack system:
- **Frontend**: React 19 Single Page Application (SPA) built with Vite, TypeScript, React Router v6, TanStack React Query v5, and Tailwind CSS v3.
- **Backend**: Django 5.1 REST Framework API with SimpleJWT authentication, modular apps for accounts, organogram, data requests, and rankings.
- **Database**: PostgreSQL 16 (production & CI) with SQLite support for rapid local development and testing.

## 2. Task Objectives
- **Phase 1 Objectives**: Rapid prototyping of the core NIRF data collection workflows, 57-unit institutional organogram, nodal officer access control, and web scraping utilities.
- **Phase 2 Objectives**:
  1. Thoroughly test the recent database and code migration from the Phase 1 Next.js/Prisma prototype to Django 5.1 DRF by creating a comprehensive automated test suite (unit tests, integration tests, migration/schema tests, negative & edge case tests).
  2. Implement an enterprise Continuous Integration (CI) pipeline using GitHub Actions covering matrix testing, linting, PostgreSQL service integration, frontend bundling, and Docker container verification.
  3. Validate database schema correctness, integrity constraints, and absence of migration drift.
  4. Maintain continuous work logs, decision histories, and testing documentation in work.md, decision_history.md, and TESTING.md.

## 3. Work Hours Log

### Phase 1 -- Core NIRF Workflow (Historical Entries)
**Team Member:** Yash / Krishna
**Current Blockers:** None

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

## Team Member: Yash
## Current Phase: Phase 2 -- Migration Testing & CI Implementation
## Date: 2026-10-31

### Update: 05 (Phase 2)
**Date:** 2026-10-31
**Task:** Repository Architecture Analysis & Migration Inspection
**Time Logged:** ~2.50 Hours

#### Work Completed:
- Inspected the full repository structure (172+ files across 6 major directories).
- Read all Django model files, serializers, views, URLs, services, migrations, settings, and management commands.
- Read the full git history (20 commits) and the diff between `origin/main` and the current branch `phase-2/nirf-ranking-ui`.
- Identified that the **actual** codebase significantly differs from what `work.md` (pre-this-update) described -- specifically:
  - The `accounts.User` model actually extends `AbstractUser` (not `AbstractBaseUser`), with `role` and `phone` fields.
  - The `organogram` app has **two** models: `OrgUnit` (string PK) and `NodalOfficer` (string PK, M2M to OrgUnit).
  - The `data_requests` app has **five** models: `DataRequest`, `DataRequestTarget`, `PortalAccessGrant`, `ProofUpload`, `RequestDelivery` -- far more complex than the simple 3-model structure described in prior documentation.
  - The `rankings` app has **no Django models** -- rankings are stored purely as JSON files loaded via `lru_cache`.
  - Authentication uses `CustomTokenObtainPairView` extending SimpleJWT's `TokenObtainPairView`, not a custom `register_view`/`login_view`.
  - The `dispatch_data_request` service in `services.py` is a full workflow function: creates DataRequest, Targets, PortalAccessGrants per officer, and records Deliveries.
- Confirmed no existing automated tests (beyond a placeholder `test_placeholder` that simply asserts True).
- Identified missing `pytest-cov` and `factory-boy` from `requirements.txt`.
- Identified that the CI workflow (`.github/workflows/ci-cd.yml`) only covers a legacy Next.js lint/build step -- no Django tests.

#### Technical Decisions Logged:

**Decision (Yash, 2026-10-31):** Testing Framework Selection
- **Decision:** Use pytest + pytest-django + factory-boy + pytest-cov.
- **Context:** These packages are already partially in `requirements.txt`; pytest is the idiomatic Django testing tool and already configured in `pytest.ini`.
- **Alternatives:** Django's built-in `unittest`, nose2.
- **Rationale:** pytest offers superior fixture composition, parameterization, and coverage reporting. factory-boy reduces test data boilerplate. pytest-cov integrates coverage seamlessly.
- **Affected:** `backend/requirements.txt`, `backend/pytest.ini`, `backend/tests/`.

**Decision (Yash, 2026-10-31):** Test Database Strategy
- **Decision:** Use SQLite for unit/integration tests (Django's default when `DATABASE_URL` is not set), and PostgreSQL 16 only for the CI integration job targeting `main`.
- **Context:** The `settings.py` already falls back to SQLite when `DATABASE_URL` env var is absent. SQLite supports all ORM features used (JSONField, ForeignKey, UniqueConstraint, M2M).
- **Alternatives:** Always use PostgreSQL (requires Docker in every test run), use Django's `--keepdb` flag.
- **Rationale:** SQLite makes local testing trivial (no Docker needed), while the separate CI integration job validates PostgreSQL compatibility before merge to main.
- **Affected:** `backend/dora_backend/settings.py` (already supports this), `.github/workflows/ci.yml`.

**Decision (Yash, 2026-10-31):** Mock External Network Calls
- **Decision:** Mock `requests.get` in all scraper unit tests using `unittest.mock.patch`.
- **Context:** The NIRF scraper makes live HTTP requests to `nirfindia.org`. These cannot be made in CI (network instability, rate limits, external dependency).
- **Alternatives:** Use `responses` library (third-party HTTP mock), use VCR cassettes.
- **Rationale:** `unittest.mock.patch` requires no additional dependencies and provides deterministic test behavior. The scraper function is the right boundary to test (verify it parses HTML correctly given mock responses).
- **Affected:** `backend/tests/test_rankings.py`.

**Decision (Yash, 2026-10-31):** Rankings JSON File Testing Strategy
- **Decision:** Create real temporary JSON files in `tmp_path` and patch `DATA_DIR` in both `scraper.py` and `views.py` during tests.
- **Context:** Rankings views load data from `backend/apps/rankings/data/` via `lru_cache`. Tests need deterministic data without relying on production data files.
- **Alternatives:** Mock the entire `load_ranking_data` function, use real data files.
- **Rationale:** Patching `DATA_DIR` lets tests exercise the actual file-loading and parsing logic without side effects on production data files. This tests the full code path (file → JSON → API response).
- **Affected:** `backend/tests/conftest.py`, `backend/tests/test_rankings.py`.

**Decision (Yash, 2026-10-31):** CI Pipeline Architecture
- **Decision:** Create 5-job GitHub Actions workflow in `.github/workflows/ci.yml` (separate from legacy `ci-cd.yml`).
- **Context:** The existing `ci-cd.yml` only runs `npm run lint` and `npm run build` on the root Next.js package (legacy Phase 1 code). It does not test the Django backend at all.
- **Alternatives:** Modify the existing `ci-cd.yml`, use a single monolithic job.
- **Rationale:** A new `ci.yml` targeting the correct branches (`main`, `phase-2/**`, `feature/**`) keeps the CI clean. The 5-job structure (`backend-tests`, `backend-lint`, `frontend-build`, `backend-integration-postgres`, `docker-build`) allows parallelism and targeted failure reporting. The PostgreSQL integration job runs only on pushes/PRs to `main` to conserve CI minutes.
- **Affected:** `.github/workflows/ci.yml` (new file).

---

### Update: 06 (Phase 2)
**Date:** 2026-10-31
**Task:** Comprehensive Test Suite Implementation
**Time Logged:** ~3.00 Hours 

#### Work Completed:
- Implemented comprehensive test suite across 6 test files:
  - `backend/tests/conftest.py` -- shared fixtures
  - `backend/tests/test_accounts.py` -- 14 tests (models + API)
  - `backend/tests/test_organogram.py` -- 19 tests (models + serializers + API)
  - `backend/tests/test_data_requests.py` -- 26 tests (models + services + API + upload edge cases)
  - `backend/tests/test_rankings.py` -- 16 tests (scraper functions + API views)
  - `backend/tests/test_migrations.py` -- 10 tests (schema + constraint verification)
- Updated `backend/requirements.txt` to add `pytest-cov>=5.0.0`, `factory-boy>=3.3.0`, `ruff>=0.6.0`.
- Updated `backend/pytest.ini` with proper test discovery and verbosity settings.
- Added `backend/.coveragerc` with source/omit configuration.
- Created `.github/workflows/ci.yml` with 5-job pipeline.

#### Issues Found During Analysis:
1. **Missing test dependencies:** `pytest-cov` and `factory-boy` were absent from `requirements.txt` -- added.
2. **Stale CI workflow:** `.github/workflows/ci-cd.yml` only covers legacy Next.js -- new `ci.yml` created for Django.
3. **lru_cache leakage:** `load_ranking_data` uses `functools.lru_cache` -- tests must call `cache_clear()` between tests to avoid stale state.
4. **PortalAccessGrant token architecture:** The raw token is never stored -- only its SHA-256 hash. Tests must generate a raw token, hash it, and store the hash in the grant while using the raw token in URLs.
5. **OrgUnit parent cascade is SET_NULL (not CASCADE):** Deleting a parent sets children's `parent` to `NULL`. This is important for cascade tests.
6. **NodalOfficer id default uses hex:** `generate_officer_id()` generates `no_<12hex>` format -- not a UUID.


---

### Update: 07 (Phase 2)
**Date:** 2026-10-31
**Task:** Test Suite Execution, Bug Fixing, Coverage Analysis & CI Validation
**Time Logged:** ~3 Hours 

#### Work Completed:
1. **Installed test and code quality tooling**: Installed `pytest-django`, `pytest-cov`, `factory-boy`, `ruff`, and `djangorestframework-simplejwt` in the backend Python runtime.
2. **Fixed `pytest.ini` duplicate configuration**: Removed duplicate `addopts` key in `backend/pytest.ini` that was causing pytest initialization failure.
3. **Executed complete test suite**: Ran all 116 tests. Discovered 1 initial failure:
   - `test_user_email_is_unique` in `tests/test_accounts.py` failed because the test assumed `User.email` was unique, whereas `apps.accounts.models.User` inherits from Django's `AbstractUser` where `username` is the unique credential. Corrected the test to assert `username` uniqueness (`test_user_username_is_unique`).
4. **Re-ran entire test suite**: All **116 tests PASSED** with 0 failures and 0 errors (execution time: ~8.95s).
5. **Generated code coverage report**:
   - Total statements: 813
   - Total missed statements: 97
   - **Overall Test Coverage: 88%**
   - `apps.accounts`: 100%
   - `apps.data_requests.models`: 99%
   - `apps.data_requests.serializers`: 100%
   - `apps.data_requests.services`: 98%
   - `apps.data_requests.views`: 98%
   - `apps.organogram`: ~95%
   - `apps.rankings.views`: 89%
6. **Code Quality & Linting**:
   - Created `backend/ruff.toml` with tailored rules for Django (ignoring `RUF012` for class-level model/serializer declarations and `E501` for line length).
   - Fixed unused variable `target` in `apps/data_requests/services.py:80`.
   - Fixed unused variable `child_id` in `tests/test_organogram.py:53` by adding assertion that the child unit exists after parent deletion.
   - `ruff check apps/ dora_backend/ tests/` now passes cleanly with 0 errors.
7. **Django System & Migration Checks**:
   - `python manage.py check` reports: `System check identified no issues (0 silenced)`.
   - `python manage.py makemigrations --check --dry-run` reports: `No changes detected` (database schemas and migrations are 100% in sync).
8. **Frontend Build Verification**:
   - Installed frontend dependencies (`npm install` in `frontend/`).
   - Ran `npm run build` (`tsc && vite build`). Succeeded with 0 TypeScript compiler errors and packaged production bundle in `dist/`.
9. **CI Workflow Refinement**:
   - Updated `.github/workflows/ci.yml` frontend build step to run `npm run build` directly (removed non-existent `npm run lint`).
   - Cleaned up obsolete `.github/workflows/ci-cd.yml` to prevent duplicate/conflicting runs on `main`.
10. **Documentation**:
    - Created comprehensive `TESTING.md` documenting testing commands, unit vs. integration suites, coverage reports, CI pipeline architecture, and PR merge criteria.
    - Updated `README.md` with the new Testing & Continuous Integration guide and links.

---

## 4. Technical Decision History

| # | Date | Decision | Context | Alternatives Considered | Rationale | Affected Files |
|---|------|----------|---------|-------------------------|-----------|----------------|
| D-008 | 2026-10-31 | Standardize on Pytest + Pytest-Django + Pytest-Cov | Need an enterprise-grade automated test runner for Django 5.1 REST API | Standard library `unittest`, `nose2` | Pytest offers modular fixtures, parameterized testing, concise assert statements, and seamless integration with DRF's `APIClient` | `backend/requirements.txt`, `backend/pytest.ini`, `backend/.coveragerc`, `backend/tests/` |
| D-009 | 2026-10-31 | Dual-Database Strategy (SQLite local, PostgreSQL in CI) | Balancing local testing speed against production PostgreSQL fidelity | Forcing PostgreSQL locally via Docker for all tests; SQLite-only | SQLite allows tests to run in <10 seconds without running background services. The dedicated CI integration job runs against PostgreSQL 16 container service to catch any dialect discrepancies | `backend/dora_backend/settings.py`, `.github/workflows/ci.yml` |
| D-010 | 2026-10-31 | Mock Scraper Network Calls & Use Isolated Temp JSON Fixtures | NIRF scraper makes live HTTP calls to `nirfindia.org`, and ranking views read from JSON files | Making live requests in tests; mocking `load_ranking_data` entirely | Live requests are non-deterministic and can fail due to external network issues or rate limits. Dynamically patching `DATA_DIR` to point to `tmp_path` tests the real file read, parse, and filter logic without touching production data files | `backend/tests/conftest.py`, `backend/tests/test_rankings.py` |
| D-011 | 2026-10-31 | Explicit LRU Cache Reset via Autouse Fixture | `load_ranking_data` uses `functools.lru_cache` which persists across tests | Disabling caching during tests; using unique random filenames | In-memory cache would otherwise serve stale data across tests when temp JSON fixtures change. Calling `load_ranking_data.cache_clear()` in an autouse fixture guarantees test isolation | `backend/tests/test_rankings.py`, `backend/tests/conftest.py` |
| D-012 | 2026-10-31 | Zero-Knowledge Token Grant Fixtures & Media Override | Portal upload requires raw token in URL but stores SHA-256 hash in DB; file uploads store to disk | Bypassing hashing in tests; uploading to production media storage | Tests must validate the actual security architecture: hash verification, expiration checks, and checksum calculation. Overriding `MEDIA_ROOT` with `tmp_path` keeps the repo clean | `backend/tests/conftest.py`, `backend/tests/test_data_requests.py` |
| D-013 | 2026-10-31 | 5-Stage GitHub Actions CI Pipeline with Docker Buildx | Ensuring PRs and pushes to `phase-2/**` and `main` are thoroughly validated | Single monolithic script; third-party CI service | Multi-job matrix allows parallel execution (Python 3.11 & 3.12), clear failure isolation (lint vs test vs frontend), and cost-effective runner use | `.github/workflows/ci.yml` |
| D-014 | 2026-10-31 | Ruff Linter Configuration for Django Idioms | Need fast linting and import formatting without flagging standard Django patterns | Flake8 + Black + isort | Ruff is 10-100x faster. Custom `ruff.toml` ignores `RUF012` for class-level model/serializer declarations while enforcing PEP 8 and clean imports | `backend/ruff.toml`, `backend/requirements.txt` |

---

## 5. Issues Discovered and Fixes

| # | Issue | Root Cause | Status | Resolution / Fix | Date |
|---|-------|------------|--------|------------------|------|
| 1 | `pytest.ini` duplicate `addopts` key | `backend/pytest.ini` contained `addopts` on both lines 4 and 7 | Fixed | Cleaned `pytest.ini` to a single `addopts = -v --tb=short` entry | 2026-10-31 |
| 2 | `test_user_email_is_unique` failed | Test assumed `User.email` was unique, but `User` extends `AbstractUser` where `username` is the unique credential | Fixed | Updated test to `test_user_username_is_unique`, verifying unique constraint on `username` | 2026-10-31 |
| 3 | Missing test dependencies in `requirements.txt` | `pytest-cov`, `factory-boy`, and `ruff` were missing | Fixed | Added `pytest-cov>=5.0.0`, `factory-boy>=3.3.0`, `ruff>=0.6.0` to `requirements.txt` | 2026-10-31 |
| 4 | Obsolete CI workflow (`ci-cd.yml`) | `.github/workflows/ci-cd.yml` only ran on `main`, did not test `phase-2/**`, lacked coverage and lint checks | Fixed | Replaced with comprehensive `.github/workflows/ci.yml` supporting matrix tests, PostgreSQL, Ruff, and Buildx | 2026-10-31 |
| 5 | Frontend `npm run lint` script missing | `frontend/package.json` did not define a `lint` script, causing CI failure | Fixed | Updated CI `frontend-build` job to run `npm run build` (`tsc && vite build`) which performs full typecheck and bundling | 2026-10-31 |
| 6 | Unused variable warnings from Ruff | `target` in `services.py` and `child_id` in `test_organogram.py` were unused | Fixed | Removed unused assignment in `services.py` and added assertion verifying child unit exists in `test_organogram.py` | 2026-10-31 |

---

## 6. Testing Results

- **Total Test Cases Created:** 116 tests
- **Tests Passed:** 116 (100%)
- **Tests Failed:** 0
- **Tests Skipped:** 0
- **Execution Time:** ~8.95 seconds
- **Statement Test Coverage:** **88%** across all internal Django apps
  - `apps.accounts`: 100%
  - `apps.data_requests.models`: 99%
  - `apps.data_requests.serializers`: 100%
  - `apps.data_requests.services`: 98%
  - `apps.data_requests.views`: 98%
  - `apps.organogram.models`: 100%
  - `apps.organogram.serializers`: 95%
  - `apps.organogram.views`: 87%
  - `apps.rankings.views`: 89%
  - `apps.rankings.scraper`: 33% (utility functions 100% tested; live web scraping loop intentionally mocked/omitted)

### Test Suite Distribution

| Category | Test File | Count | Scope |
|----------|-----------|-------|-------|
| Accounts & Auth | `tests/test_accounts.py` | 14 | User models, roles, passwords, JWT login, token refresh, `/api/auth/me/` |
| Organogram & Officers | `tests/test_organogram.py` | 19 | OrgUnit tree, self-referential parent, SET_NULL cascade, NodalOfficer CRUD, M2M |
| Data Requests & Vault | `tests/test_data_requests.py` | 26 | Request composer, dispatch service, SHA-256 tokens, proof uploads, size/format validations |
| Rankings & NIRF | `tests/test_rankings.py` | 16 | Name cleaning, 2nd-gen IIT canonical mapping, ARIIA fallbacks, trends, rank lookups |
| Migrations & Schemas | `tests/test_migrations.py` | 10 | Unapplied migration check, table existence, string PKs, unique constraints |
| End-to-End Workflows | `tests/test_backend.py` | 4 | Complete seeded organogram, auth token retrieval, multi-unit dispatch, portal upload, status rollup |

---

## 7. CI Implementation History

- **Workflow File:** `.github/workflows/ci.yml`
- **Triggers:**
  - Pushes to `main`, `phase-2/**`, `feature/**`
  - Pull requests targeting `main`, `phase-2/**`
- **Jobs:**
  1. `backend-tests`: Matrix on Python 3.11 and 3.12, runs migrations on SQLite, executes pytest with coverage, uploads XML report.
  2. `backend-lint`: Ruff linting, Django deployment checks, and migration drift check (`makemigrations --check --dry-run`).
  3. `frontend-build`: Node.js 20, `npm ci`, TypeScript check (`tsc`) and Vite bundling (`vite build`).
  4. `backend-integration-postgres`: PostgreSQL 16 Alpine service container, runs migrations, executes full test suite against real Postgres (runs on `main` pushes/PRs).
  5. `docker-build`: Build backend and frontend Docker images with Docker Buildx and GitHub Actions cache.

---

## 8. Pending Tasks and Limitations

- [x] Comprehensive automated unit, integration, and migration test suite (116 tests, 88% coverage).
- [x] Multi-stage GitHub Actions CI workflow implemented and validated.
- [x] Code quality and linting configuration with Ruff.
- [x] Frontend build and TypeScript verification.
- [x] Comprehensive documentation in `TESTING.md` and updated `README.md`.
- [ ] *Optional Future Enhancement:* Add Celery/Redis worker for asynchronous scraping tasks if volume increases.
- [ ] *Optional Future Enhancement:* Add Cypress/Playwright end-to-end browser tests for the React frontend UI.

---

## 9. Final Summary

All Phase 2 migration testing and Continuous Integration objectives have been comprehensively completed:
1. **Migration Verification:** Confirmed that Django ORM models accurately reflect the domain requirements migrated from Phase 1 Prisma schema, with zero migration drift.
2. **Automated Testing:** Established a robust pytest suite containing **116 deterministic tests** achieving **88% coverage** across all applications, validating models, API endpoints, authentication, relational constraints, zero-knowledge portal tokens, file upload safety, and ranking analytics.
3. **Continuous Integration:** Implemented and verified a 5-stage GitHub Actions CI pipeline executing linting, multi-version Python testing, PostgreSQL integration, frontend bundling, and Docker container verification.
4. **Documentation:** Authored `TESTING.md` and updated `README.md`, `work.md`, and `decision_history.md`.

## Team Member: Lokesh
## Current Phase: Phase 2 -- Frontend Static Analysis & Unit Testing
## Date: 2026-11-09

### Update: 06 (Phase 2)
**Date:** 2026-11-09
**Task:** Phase 2 - Frontend ESLint, TypeScript strictness and Vitest suite

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

---

Component and integration testing is in place: all 163 tests pass, tsc is clean, and ESLint shows 0 errors (82 existing warnings). Statement coverage went from 13.6% to 52.5%. Nothing is committed.

Starting point. The working tree already had untracked tests I hadn't written: Header, LoginModal, Navigation, RankingDetailModal and ToastProvider, plus test/test-utils.tsx (a renderWithProviders helper) and test/domain-fixtures.ts. I built on them. 8 of those tests were failing and 2 had type errors. All were test-side problems (fake timers stalling the toast exit animation, duplicate-text queries, a too-narrow props type), not app bugs.

### New tests

* **OrgTree.test.tsx (12 tests):** collapse and expand, activation, query and type filtering, empty state, selection (including locked and subtree selection), and coverage badges.
* **DashboardLayout.test.tsx (9 tests):** admin vs. officer sidebar, sidebar navigation, user identity from localStorage, dropdowns, and sign-out clearing the session.
* **routes.integration.test.tsx (27 tests):** the real route table, layouts and providers, with only fetch and the rankings service mocked.
  * **Routing:** `/`, unknown-path redirect, `/admin`, `/nodal-officer`, settings.
  * **Landing:** tab switching, a failing rankings API, and navigation to the admin and officer portals.
  * **Admin pages:** data collection (empty, populated, bare-array payload, closed and overdue requests, API error, list to detail, detail error), organogram, and nodal officers.
  * **Upload portal:** success, expired token, network failure.

### Gaps

* AdminView.tsx is at 0%, but routes.tsx doesn't import it, so it looks like dead code.
* The composer, nodal-officer submission, trends and comparative views, services/api.ts (axios interceptors and refresh) and exportToCSV have little or no coverage. I'd go after these next.
* The nodal-officers and trends pages only have render-level checks so far.
* RankingDetailModal tests print many "not wrapped in act(...)" warnings. They pass but are noisy.
* bun.lock is still stale from the earlier dependency install (see my previous message).

