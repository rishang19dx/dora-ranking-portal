# ARP Project - Work & Decision Log

## 1. Project Overview
The **Automated Ranking Portal (ARP)** / **DORA Ranking Portal** is a centralized web platform designed to streamline the collection, management, verification, and visualization of institutional academic rankings (NIRF, QS, THE, Shanghai, MDRA) at IIT Mandi[cite: 4, 7].
The application architecture is a modern decoupled full-stack system:
- **Frontend**: React 19 Single Page Application (SPA) built with Vite, TypeScript, React Router v6, TanStack React Query v5, and Tailwind CSS v3.
- **Backend**: Django 5.1 REST Framework API with SimpleJWT authentication, modular apps for accounts, organogram, data requests, submissions, rankings, and go-live readiness.
- **Database**: PostgreSQL 16 (production & CI) with SQLite support for rapid local development and testing.

## 2. Task Objectives
- **Phase 1 Objectives**: Rapid prototyping of the core NIRF data collection workflows, institutional organogram, nodal officer access control, and web scraping utilities[cite: 4, 5, 10].
- **Phase 2 Objectives**:
  1. Thoroughly test the database and code migration from the Phase 1 Next.js/Prisma prototype to Django 5.1 DRF by creating a comprehensive automated test suite (unit tests, integration tests, migration/schema tests, negative & edge case tests).
  2. Implement an enterprise Continuous Integration (CI) pipeline using GitHub Actions covering matrix testing, linting, PostgreSQL service integration, frontend bundling, and Docker container verification.
  3. Validate database schema correctness, integrity constraints, and absence of migration drift.
  4. Establish frontend static analysis (ESLint 9, TypeScript strict checks) and Vitest component/route integration testing.
- **Phase 3 Objectives**:
  1. Verify deny-by-default Role-Based Access Control (RBAC) across every API endpoint and UI route (Admin, Director, Auditor, Nodal Officer, Public)[cite: 8].
  2. Validate public cross-system rankings (`ExternalRankingResult` + live NIRF trends & 2nd-gen IIT benchmarks), 3-year historical value comparisons (`unit_history`, `change_between`, restatements), and automated deadline reminders (`send_reminders` milestones, cooldown, link rotation)[cite: 5, 7, 10].
  3. Test rule-based and optional provider-agnostic AI discrepancy flagging (`80%` drop, `300%` rise, zero drop, PII stripping, grounding validation, `AIRequestLog`, and deterministic fallback)[cite: 6, 13].
- **Phase 4 Objectives**:
  1. Validate end-to-end Maker-Checker workflows, multi-ranking exports (`openpyxl` DCS workbooks and `RankingRecord` workflow), and `reportlab` boardroom executive briefing PDFs[cite: 6, 7].
  2. Verify Go-Live readiness gates, pilot KPIs, UAT scenario tracking, checksummed backup/restore & DR drills, and production security hardening (`manage.py check --deploy`)[cite: 9, 10, 13].
  3. Resolve cross-platform compatibility issues (Windows `msvcrt.locking` fallback for ranking fetch locks) and maintain synchronized engineering logs in `work.md` and `decision_history.md`.

---

## 3. Work Hours Log

### Phase 1 -- Core NIRF Workflow (Historical Entries)
**Team Member:** Yash / Krishna
**Current Blockers:** None

### Update: 01
**Date:** 2026-09-03
**Task:** Baseline Integration & Teammate Sync
**Time Logged:** 1.50 Hours (90 minutes)

#### Technical Decisions Logged:
- **Assessment:** Evaluated the teammate's NIRF API and organogram work (`origin/custom_nirf_n_organogram`), deciding to harden the cache invalidation boundary before building more workflow features.
- **Integration:** Confirmed the existing Next.js build passes, then integrated commit `9ff3246` into the working tree without creating a commit to prioritize core workflow features.
- **Conflict Resolution:** Resolved the sole `package-lock.json` conflict by preserving the local `@types/react-dom 19.2.5` entry.
- **Version Control:** Excluded generated Python bytecode from source tracking and added Python cache patterns to `.gitignore`.

### Update: 02
**Date:** 2026-09-03
**Task:** Cache Invalidation Security & Validation
**Time Logged:** 1.00 Hour (60 minutes)

#### Technical Decisions Logged:
- **Security Implementation:** Added a shared secret requirement (`REVALIDATION_SECRET`) to the Next.js revalidation route and updated the Python scraper callback to send the secret, failing loudly if unconfigured.
- **Environment Configuration:** Added the secret to `.env.example` without placing a real credential in the repository.
- **Validation:** Verified the production build passes with the dynamic `/api/revalidate` route and that Python syntax compilation passed for `app.py` and `scraper.py`. 
- **Scope Decision:** Deferred wiring the NIRF utility into the public page until deployment topology and public fallback behaviors are finalized.

### Update: 03
**Date:** 2026-09-03
**Task:** Phase 1 - Nodal Officer Upload Portal UI
**Time Logged:** 2.00 Hours (120 minutes)

#### Technical Decisions Logged:
- **UI Implementation:** Replaced the placeholder wizard in `src/app/(dashboard)/nodal-officer/submissions/new/page.tsx` with a focused client-side form for department-scoped submissions.
- **Data Collection Fields:** Added required title and metric category fields, structured raw data input (`.xlsx`/`.csv`), and proof input (`.pdf`/`.docx`) alongside repository audit helper text[cite: 5].
- **Workflow Alignment:** Added dummy `onSubmit` behavior with `preventDefault()` and a persistent `PENDING` success state to match the required Maker-Checker submission workflow[cite: 6].
- **UI/UX & Documentation:** Utilized `lucide-react` icons and a white card layout, recorded design decisions in `decision_history.md`, and verified `npm run build` passes (including linting and TypeScript checks).

### Update: 04
**Date:** 2026-09-09
**Team Member:** Krishna
**Week:** 2
**Task:** Phase 1 - Organogram-Driven Data Collection & Nodal Officer Access
**Time Logged:** 6.00 Hours (360 minutes)

#### Technical Decisions Logged:
- **Organogram Modelling:** Converted `Institute_Organogram.md` into a typed, queryable hierarchy in `src/lib/organogram.ts` (56 units across governance, executive, academic, administrative and functional layers) with per-unit data custodianship, and rendered it as a reusable searchable/selectable tree component[cite: 4].
- **Targeted Requests:** Built the three-step request composer (sections -> required data -> message) with per-section narrowing of the requested items, live recipient resolution, coverage warnings, and a templated email preview[cite: 4, 5].
- **Access Provisioning:** Dispatch now issues one hashed, expiring, single-section upload grant per recipient; reminders rotate links, closing a request or removing an officer revokes them, and uploads are scoped and checksummed server-side[cite: 5].
- **Persistence Strategy:** Kept all workflow state behind a single file-backed repository module (`src/lib/server/store.ts`) with mirrored Prisma models added to the schema, so connecting Postgres later touches one file.
- **Validation:** `npm run build` passes; the full flow (create officer -> dispatch -> outbox email -> portal upload -> status roll-up -> reminder rotation -> close/revoke) was exercised end to end against a dev server, including rejection of wrong-format, out-of-scope, revoked and invalid-token uploads.

---

## Team Member: Yash
## Current Phase: Phase 2 -- Migration Testing & CI Implementation
## Date: 2026-10-31

### Update: 05 (Phase 2)
**Date:** 2026-10-31
**Task:** Repository Architecture Analysis & Migration Inspection
**Time Logged:** ~2.50 Hours (150 minutes)

#### Work Completed:
- Inspected the full repository structure (172+ files across 6 major directories).
- Read all Django model files, serializers, views, URLs, services, migrations, settings, and management commands.
- Read the full git history (20 commits) and the diff between `origin/main` and the current branch `phase-2/nirf-ranking-ui`.
- Identified that the actual codebase significantly differs from what `work.md` (pre-this-update) described:
  - The `accounts.User` model extends `AbstractUser` (not `AbstractBaseUser`), with `role` and `phone` fields.
  - The `organogram` app has two models: `OrgUnit` (string PK) and `NodalOfficer` (string PK, M2M to OrgUnit).
  - The `data_requests` app has five models: `DataRequest`, `DataRequestTarget`, `PortalAccessGrant`, `ProofUpload`, `RequestDelivery`.
  - The `rankings` app has no Django models — rankings are stored purely as JSON files loaded via `lru_cache`.
  - Authentication uses `CustomTokenObtainPairView` extending SimpleJWT's `TokenObtainPairView`.
  - The `dispatch_data_request` service in `services.py` creates DataRequest, Targets, PortalAccessGrants per officer, and records Deliveries.
- Confirmed no existing automated tests (beyond a placeholder `test_placeholder` asserting True).
- Identified missing `pytest-cov` and `factory-boy` from `requirements.txt`.
- Identified that the legacy CI workflow (`.github/workflows/ci-cd.yml`) only covered Next.js lint/build without Django backend testing.

#### Technical Decisions Logged:

**Decision (Yash, 2026-10-31):** Testing Framework Selection
- **Decision:** Use pytest + pytest-django + factory-boy + pytest-cov.
- **Context:** These packages are partially in `requirements.txt`; pytest is idiomatic for Django REST APIs and configured in `pytest.ini`.
- **Alternatives:** Django's built-in `unittest`, nose2.
- **Rationale:** pytest offers superior fixture composition, parameterization, and coverage reporting.
- **Affected:** `backend/requirements.txt`, `backend/pytest.ini`, `backend/tests/`.

**Decision (Yash, 2026-10-31):** Test Database Strategy
- **Decision:** Use SQLite for unit/integration tests locally, and PostgreSQL 16 for CI integration runs.
- **Context:** `settings.py` falls back to SQLite when `DATABASE_URL` is unset, supporting all required ORM features.
- **Alternatives:** Dockerized PostgreSQL locally for every test execution.
- **Rationale:** SQLite keeps local execution under 10 seconds; CI integration tests catch dialect differences.
- **Affected:** `backend/dora_backend/settings.py`, `.github/workflows/ci.yml`.

**Decision (Yash, 2026-10-31):** Mock External Network Calls
- **Decision:** Mock `requests.get` in scraper unit tests with `unittest.mock.patch`.
- **Context:** NIRF scraper makes live HTTP calls to `nirfindia.org`, which fail in CI without external connectivity.
- **Alternatives:** Third-party libraries (`responses`), VCR cassettes.
- **Rationale:** Standard library patching has zero overhead and guarantees deterministic behavior.
- **Affected:** `backend/tests/test_rankings.py`.

**Decision (Yash, 2026-10-31):** Rankings JSON File Testing Strategy
- **Decision:** Use temporary JSON files in `tmp_path` and dynamically patch `DATA_DIR` in `scraper.py` and `views.py`.
- **Context:** Rankings views load data from `backend/apps/rankings/data/` via `lru_cache`.
- **Alternatives:** Mocking the entire `load_ranking_data` function.
- **Rationale:** Patching `DATA_DIR` exercises real file-loading and JSON-parsing code paths cleanly.
- **Affected:** `backend/tests/conftest.py`, `backend/tests/test_rankings.py`.

**Decision (Yash, 2026-10-31):** CI Pipeline Architecture
- **Decision:** Create a 5-job GitHub Actions workflow in `.github/workflows/ci.yml`.
- **Context:** Legacy `ci-cd.yml` only ran frontend lint/build.
- **Alternatives:** Monolithic single-script CI run.
- **Rationale:** Parallel jobs (`backend-tests`, `backend-lint`, `frontend-build`, `backend-integration-postgres`, `docker-build`) isolate failures cleanly.
- **Affected:** `.github/workflows/ci.yml`.

### Update: 06 (Phase 2)
**Date:** 2026-10-31
**Task:** Comprehensive Test Suite Implementation
**Time Logged:** ~3.00 Hours (180 minutes)

#### Work Completed:
- Implemented comprehensive test suite across 6 test files:
  - `backend/tests/conftest.py` -- shared fixtures
  - `backend/tests/test_accounts.py` -- 14 tests (models + API)
  - `backend/tests/test_organogram.py` -- 19 tests (models + serializers + API)
  - `backend/tests/test_data_requests.py` -- 26 tests (models + services + API + upload edge cases)
  - `backend/tests/test_rankings.py` -- 16 tests (scraper functions + API views)
  - `backend/tests/test_migrations.py` -- 10 tests (schema + constraint verification)
- Updated `backend/requirements.txt` to add `pytest-cov>=5.0.0`, `factory-boy>=3.3.0`, `ruff>=0.6.0`.
- Updated `backend/pytest.ini` with test discovery and verbosity settings.
- Added `backend/.coveragerc` with source/omit configuration.
- Created `.github/workflows/ci.yml` with 5-job pipeline.

#### Issues Found During Analysis:
1. **Missing test dependencies:** `pytest-cov` and `factory-boy` were absent from `requirements.txt` -- added.
2. **Stale CI workflow:** `.github/workflows/ci-cd.yml` only covered legacy Next.js -- new `ci.yml` created for Django.
3. **lru_cache leakage:** `load_ranking_data` uses `functools.lru_cache` -- tests must call `cache_clear()` between runs.
4. **PortalAccessGrant token architecture:** The raw token is never stored -- only its SHA-256 hash. Tests must generate a raw token, hash it, and store the hash in the grant while using the raw token in URLs[cite: 5].
5. **OrgUnit parent cascade is SET_NULL (not CASCADE):** Deleting a parent sets children's `parent` to `NULL`.
6. **NodalOfficer id default uses hex:** `generate_officer_id()` generates `no_<12hex>` format.

### Update: 07 (Phase 2)
**Date:** 2026-10-31
**Task:** Test Suite Execution, Bug Fixing, Coverage Analysis & CI Validation
**Time Logged:** ~3.00 Hours (180 minutes)

#### Work Completed:
1. **Installed test and code quality tooling**: Installed `pytest-django`, `pytest-cov`, `factory-boy`, `ruff`, and `djangorestframework-simplejwt`.
2. **Fixed `pytest.ini` duplicate configuration**: Removed duplicate `addopts` key in `backend/pytest.ini`.
3. **Executed complete test suite**: Ran all 116 tests. Fixed initial failure in `test_user_username_is_unique` (asserting `username` uniqueness instead of `email` on `AbstractUser`).
4. **Re-ran entire test suite**: All **116 tests PASSED** with 0 failures and 0 errors (~8.95s).
5. **Generated code coverage report**:
   - Total statements: 813 | Missed: 97 | **Overall Test Coverage: 88%**
   - `apps.accounts`: 100%, `apps.data_requests.models`: 99%, `apps.data_requests.serializers`: 100%, `apps.data_requests.services`: 98%, `apps.data_requests.views`: 98%, `apps.organogram`: ~95%, `apps.rankings.views`: 89%.
6. **Code Quality & Linting**: Created `backend/ruff.toml` tailored for Django. Resolved unused variable warnings in `services.py` and `test_organogram.py`. `ruff check` passes cleanly.
7. **System & Migration Checks**: `python manage.py check` passes with 0 issues; dry-run migration checks confirm zero migration drift.
8. **Frontend Build Verification**: Ran `npm install` and `npm run build` (`tsc && vite build`) in `frontend/`, verifying 0 TypeScript errors and clean production bundle creation.
9. **CI Workflow Refinement**: Cleaned up obsolete `.github/workflows/ci-cd.yml` and unified the workflow in `ci.yml`.
10. **Documentation**: Authored `TESTING.md` and updated `README.md`.

---

## Team Member: Lokesh
## Current Phase: Phase 2 -- Frontend Static Analysis & Unit Testing
## Date: 2026-11-09

### Update: 06 (Phase 2 - Frontend)
**Date:** 2026-11-09
**Task:** Phase 2 - Frontend ESLint, TypeScript Strictness, and Vitest Suite
**Time Logged:** ~5.00 Hours (300 minutes)

#### Work Completed:

**Static Analysis & Type Checking:**
- Added ESLint 9 flat config (`frontend/eslint.config.js`): `@typescript-eslint` recommended rules, `react-hooks` (rules-of-hooks + exhaustive-deps), and `react-refresh`.
- Updated `tsconfig.json` with `vitest/globals` and `@testing-library/jest-dom` types for strict test file typechecking.
- Baseline check achieved 0 type errors and 0 lint errors (80 pre-existing warnings flagged for future cleanup).

**Unit & Component Testing:**
- Installed Vitest 3, `@vitest/coverage-v8`, React Testing Library 16, `@testing-library/jest-dom`, and `@testing-library/user-event` with `vitest.config.ts` (jsdom environment, globals, v8 coverage).
- Built and verified initial suite of 67 tests across 5 files:
  - `utils/helpers.test.ts`: rank-change math, status badges, date formatting.
  - `lib/organogram.test.ts`: org-tree lookups, breadcrumbs, search, scope aggregation (99.7% coverage).
  - `lib/data-catalogue.test.ts`: data-item/custodian/proof-format logic (100% coverage).
  - `components/RankingCard.test.tsx` and `components/Footer.test.tsx`: rendering and interaction (100% coverage).
- Expanded component and integration coverage to **163 passing tests** (statement coverage increased from 13.6% to 52.5%):
  - `OrgTree.test.tsx` (12 tests): collapse/expand, activation, type filtering, subtree selection, coverage badges.
  - `DashboardLayout.test.tsx` (9 tests): admin vs. officer sidebar, user identity resolution, dropdowns, sign-out session clearing.
  - `routes.integration.test.tsx` (27 tests): route table, layouts, error boundary redirection, admin data collection lifecycle, and nodal upload token validation.

**Scripts & CI Operations:**
- Added `typecheck`, `lint`, `lint:fix`, `test`, `test:watch`, `test:coverage`, and `validate` scripts to `frontend/package.json`.
- Wired root `package.json` scripts (`test:frontend`, `lint:frontend`, `typecheck:frontend`).
- Updated CI pipeline to execute `lint -> typecheck -> vitest -> build` on all PRs.
- Flagged stale `bun.lock` due to dependency install via npm for local non-frozen fallback.

---

## Team Member: Yash
## Current Phase: Phase 3 -- Public Portals, Historical Baselines, AI Discrepancy & RBAC Verification
## Date: 2026-11-16

### Update: 08 (Phase 3)
**Date:** 2026-11-16
**Task:** Phase 3 Architecture Audit, Discrepancy Engine Design & RBAC Policy Formalization
**Time Logged:** ~6.00 Hours (360 minutes)

#### Work Completed:
- **Deep Audit of DRF Permission Architecture & URL-Conf Baseline:** Examined `DEFAULT_PERMISSION_CLASSES = ('rest_framework.permissions.IsAuthenticated',)` across 40+ endpoints; audited custom permissions (`IsAdmin`, `IsAdminOrLeadershipReadOnly`, `IsAdminOrOversightReadOnly`, `IsAdminOrAuditorReadOnly`) and designed the explicit `PUBLIC_VIEWS` allowlist guard in `test_rbac_matrix.py` to prevent accidental unauthenticated exposure[cite: 8]. (1.75 hrs)
- **Departmental Data Isolation & Scope Analysis:** Traced nodal officer assignment scopes in `apps.accounts` and `apps.organogram`; audited query filtering on `/api/me/assignments/` and `/api/nirf/cycles/<year>/department-analytics/` to enforce strict 403 barriers across differing academic units[cite: 8]. (1.25 hrs)
- **3-Year Historical Baseline & Restatement Logic Review:** Inspected `apps/submissions/history.py` (`previous_submission`, `section_history`, `unit_history`, `notable_changes`, `change_between`); verified the algorithmic distinction between same-period restatements and prior-period YoY deltas, formalizing the rule that only `status=APPROVED` returns qualify for baseline calculations[cite: 5]. (1.50 hrs)
- **AI Discrepancy Flagging & Anomaly Engine Architecture:** Analyzed heuristic thresholds in `discrepancies.py` (-80% drop, +300% rise, >=40% change); evaluated multi-provider integration (`ai_client.py`) across Google Gemini, OpenAI, OpenRouter, Anthropic; audited prompt construction to ensure complete PII redaction and mathematical grounding (`_ungrounded_numbers`); designed the fallback state machine for API downtime[cite: 6, 13]. (1.50 hrs)

---

### Update: 09 (Phase 3)
**Date:** 2026-11-16
**Task:** Phase 3 Automated Test Implementation, LLM Boundary Mocking & Reminder Engine Validation
**Time Logged:** ~7.50 Hours (450 minutes)

#### Work Completed:
- **Public Rankings API & External Ranking Results Suite:** Implemented `test_public_rankings.py` (19 tests) covering unauthenticated access to `/api/v1/public/ranking-systems/`, rank band parsing (`=451`, `801-1000`, `1001+`), 2nd-gen IIT canonical filtering (`TARGET_IITS`), demo seed isolation, and admin CRUD controls[cite: 7, 10]. (1.75 hrs)
- **Historical Baseline & YoY Math Test Suite:** Built `test_history_comparison.py` (15 tests) testing 3-year lookbacks (`cycles=3` over 2024–2026 excluding unapproved 2023), delta calculations, zero baselines, restatements vs. prior periods, and UI hint rollups[cite: 5]. (1.50 hrs)
- **AI Anomaly Detection & Deterministic Fallback Mock Suite:** Created `test_discrepancies.py` (27 tests) targeting -80% drop, +300% rise, zero drop, and 40% shift heuristics[cite: 6]. Mocked external HTTP boundaries (`requests.post`) for Gemini/OpenAI/Anthropic; tested HTTP 429 quota exhaustion, timeout recovery, ungrounded number rejection, PII stripping, and `AIRequestLog` DB auditing[cite: 6, 13]. (2.25 hrs)
- **Automated Deadline Reminders & Token Rotation Suite:** Developed `test_reminders.py` (16 tests) validating milestone scheduling (`T-7`, `T-3`, `T-1`, `OVERDUE`), `ScheduledReminder` uniqueness `(target, milestone)`, 20-hour manual cooldown suppression, single-use `PortalAccessGrant` token rotation, and management commands (`send_reminders --dry-run` and live)[cite: 5, 10]. (1.25 hrs)
- **RBAC Matrix Parametrization:** Formulated and executed `test_rbac_matrix.py` (420 tests) testing all API routes against 6 distinct role identities (`ANON`, `NODAL_OFFICER`, `AUDITOR`, `DIRECTOR`, `ADMIN`, `SUPERUSER`), verifying mailbox stripping, login throttling (429), and deactivation guards[cite: 8]. (0.75 hrs)

---

## Team Member: Yash
## Current Phase: Phase 4 -- UAT Workflows, Multi-Ranking Exports & Handover Verification
## Date: 2026-11-27

### Update: 10 (Phase 4)
**Date:** 2026-11-27
**Task:** Maker-Checker Lifecycle Audit, Multi-Agency Export Verification & Briefing PDF Architecture
**Time Logged:** ~6.50 Hours (390 minutes)

#### Work Completed:
- **End-to-End Maker-Checker Simulation & Audit Immutability:** Validated the complete lifecycle (`DRAFT -> SUBMITTED -> CORRECTION_REQUESTED -> SUBMITTED -> APPROVED`), rejection, and reopening across `test_submissions.py`, `test_phase1_acceptance.py`, and `test_spec_phase1_compliance.py`[cite: 6]. Verified that `SubmissionAuditLog` strictly raises `ValidationError` on any update/delete attempts[cite: 6]. (1.75 hrs)
- **NIRF DCS Multi-Category Excel Export Pipeline:** Tested and profiled `openpyxl` DCS generation (`dcs_export.py`) across all 4 categories (`OVERALL`, `ENGINEERING`, `INNOVATION`, `SDG`); validated schema-matched round-trip spreadsheet imports (`xlsx_templates.py`), relative year offsets, and approved-only rollup enforcement[cite: 6, 7]. (1.50 hrs)
- **Executive Boardroom PDF Briefing Engine:** Audited and verified `reportlab` PDF briefing generator (`briefing.py` / `/api/nirf/cycles/<year>/briefing/`); validated Director-only access, Nodal Officer 403 denial, dynamic table formatting, Indian Rupee notation, and automated discrepancy aggregation[cite: 7, 8]. (1.50 hrs)
- **Manual Multi-Ranking Workflow & Audit Trail (`RankingRecord`):** Implemented and verified `test_ranking_records.py` (3 comprehensive tests) covering the workflow (`DRAFT -> PENDING_REVIEW -> VERIFIED -> PUBLISHED`), reviewer metadata stripping for public callers, and `RankingAuditLog` immutability[cite: 6, 7, 8]. (1.75 hrs)

---

### Update: 11 (Phase 4)
**Date:** 2026-11-27
**Task:** Cross-Platform Windows Concurrency Fix, Production Hardening & Full Suite Verification
**Time Logged:** ~6.50 Hours (390 minutes)

#### Work Completed:
- **Windows Concurrency Lock Bug Diagnosis & Refactoring:** Investigated `test_concurrent_fetches_are_refused` returning HTTP 200 instead of 409 on Windows. Discovered `apps/rankings/scraper.py` silently ignored `ImportError` on POSIX `fcntl`. Researched Windows low-level locking semantics and refactored `fetch_lock()` with stdlib `msvcrt.locking` (`LK_NBLCK` / `LK_UNLCK`) on `.fetch.lock` in `a+` mode, ensuring non-blocking mutual exclusion across both Windows and POSIX environments. (2.25 hrs)
- **Cross-Platform Concurrency Test Implementation:** Authored targeted unit tests in `test_ranking_refresh.py` (14 tests total) exercising Windows `msvcrt` acquisition, contention refusal, clean release on context exit, POSIX mocking, and `refresh_rankings` lock skipping. (1.25 hrs)
- **Coverage Configuration & Environment Fixes:** Standardized test coverage metrics by introducing `backend/.coveragerc` (omitting migrations and `__init__.py`) and unmasked it from `.gitignore`; resolved missing test packages (`openpyxl`, `reportlab`, Vitest globals). (1.00 hr)
- **Full Regression Execution & Production Gates:** Executed full backend pytest run (787 collected: 785 passed, 2 skipped, 0 failures, 89% statement coverage in 371s); executed Ruff linting (`0 errors`); ran Django migration checks (`No changes detected`) and production deployment checks (`check --deploy` passed with 0 issues); executed frontend Vitest suite (203/203 passed) and verified Vite production bundling[cite: 13]. (2.00 hrs)

### Update: 12 (Phase 4)
**Date:** 2026-11-27
**Task:** Public Portal Smoke Testing, Vite Bundle Optimization, and CI Pipeline Audit
**Time Logged:** ~4.00 Hours (240 minutes)

#### Work Completed:
- **Public Portal Smoke Testing & Console Security Audit:** Executed manual verification of local dev servers across unauthenticated views: tested public rankings landing page (`/`, `/rankings`), verified 2nd-generation IIT peer comparison tables and category navigation, inspected browser DevTools console (evaluating and clearing Chrome extension CSP blocks vs application code), and confirmed zero unhandled runtime fetch exceptions. (2.00 hrs)
- **Vite Bundle Optimization & Vendor Chunk Splitting:** Investigated the Vite production build warning (`dist/assets/index-50mOX_La.js` exceeding 1,526 kB). Implemented Rollup `manualChunks` in `frontend/vite.config.ts` to split third-party vendor dependencies (`react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, UI icon sets) into distinct cache-isolated bundles, resolving the bundle size warning and accelerating client First Contentful Paint. (1.00 hrs)
- **GitHub Actions CI/CD Pipeline Monitoring & PR Validation:** Monitored the 5-job GitHub Actions pipeline for PR branch `test/phases-2-to-4-validation` (`backend-tests` Python 3.11/3.12 matrix, Ruff linting, `check --deploy`, Vitest/Vite bundling, PostgreSQL 16 container integration, and Docker Buildx layer caching). Verified container execution and branch merge readiness against `main`. (1.00 hrs)

### Weekly Billing & Effort Compliance Summary (Yash — Phases 2 to 4)

| Phase | Date / Sprint Window | Updates Logged | Weekly Hours (Yash) | Weekly Ceiling | Status |
|---|---|---|---|---|---|
| Phase 2 | 2026-10-31 | Updates 05, 06, 07 (`2.50 + 3.00 + 3.00`) | **8.50 hrs** | 20.00 hrs/wk | Within Ceiling |
| Phase 3 | 2026-11-16 | Updates 08, 09 (`6.00 + 7.50`) | **13.50 hrs** | 20.00 hrs/wk | Within Ceiling |
| Phase 4 | 2026-11-27 | Updates 10, 11, 12 (`6.50 + 6.50 + 4.00`) | **17.00 hrs** | 20.00 hrs/wk | Within Ceiling |

---

## 4. Technical Decision History

| # | Date | Decision | Context | Alternatives Considered | Rationale | Affected Files |
|---|------|----------|---------|-------------------------|-----------|----------------|
| D-008 | 2026-10-31 | Standardize on Pytest + Pytest-Django + Pytest-Cov | Need an enterprise-grade automated test runner for Django 5.1 REST API | Standard library `unittest`, `nose2` | Pytest offers modular fixtures, parameterized testing, concise assert statements, and seamless integration with DRF's `APIClient` | `backend/requirements.txt`, `backend/pytest.ini`, `backend/.coveragerc`, `backend/tests/` |
| D-009 | 2026-10-31 | Dual-Database Strategy (SQLite local, PostgreSQL in CI) | Balancing local testing speed against production PostgreSQL fidelity | Forcing PostgreSQL locally via Docker for all tests; SQLite-only | SQLite allows tests to run rapidly without background services, while the dedicated CI integration job runs against a PostgreSQL 16 service container to catch dialect discrepancies | `backend/dora_backend/settings.py`, `.github/workflows/ci.yml` |
| D-010 | 2026-10-31 | Mock Scraper Network Calls & Use Isolated Temp JSON Fixtures | NIRF scraper makes live HTTP calls to `nirfindia.org`, and ranking views read from JSON files | Making live requests in tests; mocking `load_ranking_data` entirely | Live requests are non-deterministic and prone to external throttling. Dynamically patching `DATA_DIR` to point to `tmp_path` tests the real file read, parse, and filter logic without touching production data files | `backend/tests/conftest.py`, `backend/tests/test_rankings.py`, `backend/tests/test_ranking_refresh.py` |
| D-011 | 2026-10-31 | Explicit LRU Cache Reset via Autouse Fixture | `load_ranking_data` uses `functools.lru_cache` which persists across tests | Disabling caching during tests; using unique random filenames | In-memory cache would otherwise serve stale data across tests when temp JSON fixtures change. Calling `load_ranking_data.cache_clear()` in an autouse fixture (alongside mtime-keyed caching in `store.py`) guarantees test isolation | `backend/tests/test_rankings.py`, `backend/tests/conftest.py`, `backend/apps/rankings/store.py` |
| D-012 | 2026-10-31 | Zero-Knowledge Token Grant Fixtures & Media Override | Portal upload requires raw token in URL but stores SHA-256 hash in DB; file uploads store to disk[cite: 5] | Bypassing hashing in tests; uploading to production media storage | Tests must validate the actual security architecture: SHA-256 hash verification, expiration/revocation checks, and checksum calculation[cite: 5]. Overriding `MEDIA_ROOT` with `tmp_path` keeps the repo clean | `backend/tests/conftest.py`, `backend/tests/test_data_requests.py`, `backend/tests/test_portal_link_security.py` |
| D-013 | 2026-10-31 | 5-Stage GitHub Actions CI Pipeline with Docker Buildx | Ensuring PRs and pushes to `phase-2/**`, `feature/**`, and `main` are thoroughly validated | Single monolithic script; third-party CI service | Multi-job matrix allows parallel execution (Python 3.11 & 3.12), clear failure isolation (lint vs test vs frontend vs Postgres vs Docker), and cost-effective runner utilization | `.github/workflows/ci.yml` |
| D-014 | 2026-10-31 | Ruff Linter Configuration for Django Idioms | Need fast linting and import formatting without flagging standard Django patterns | Flake8 + Black + isort | Ruff is 10-100x faster. Custom `ruff.toml` ignores `RUF012` for class-level model/serializer declarations while enforcing PEP 8 (`E`, `W`, `F`) across `apps/`, `dora_backend/`, and `tests/` | `backend/ruff.toml`, `backend/requirements.txt` |
| D-015 | 2026-11-16 | Deny-by-Default RBAC Policy & URL-Conf Allowlist Structural Guard | Prevent newly added endpoints from accidentally shipping unauthenticated or allowing unauthorized roles[cite: 8] | Per-view opt-in permissions; manual endpoint audits | Setting `DEFAULT_PERMISSION_CLASSES` to `IsAuthenticated` and asserting every `AllowAny` view against an explicit `PUBLIC_VIEWS` allowlist in `test_rbac_matrix.py` automatically blocks open-by-omission regressions[cite: 8] | `backend/dora_backend/settings.py`, `backend/apps/accounts/permissions.py`, `backend/tests/test_rbac_matrix.py` |
| D-016 | 2026-11-16 | Approved-Only 3-Year Historical Baseline & Dual Comparison Basis | Overlapping NIRF multi-year grids require separating restatements of previously submitted years from new year-on-year comparisons[cite: 5] | Comparing against latest draft/submitted returns; single YoY formula | Restricting baselines strictly to `APPROVED` (`not_applicable=False`) earlier-cycle returns ensures officers and reviewers compare only against signed-off figures, distinguishing `same-period` restatements from `prior-period` YoY deltas[cite: 5] | `backend/apps/submissions/history.py`, `backend/tests/test_history_comparison.py` |
| D-017 | 2026-11-16 | Deterministic Discrepancy Engine with Optional Grounded AI Layer | Detect abnormal shifts (80% drop, 300% rise, drop to zero) without creating external LLM availability or hallucination risks[cite: 6] | Relying solely on LLM checks; forwarding raw faculty records to external APIs | Deterministic rules always execute and never get overwritten; optional AI providers (Gemini, OpenAI, OpenRouter, Anthropic) receive PII-stripped aggregates, ungrounded numbers are rejected via `_ungrounded_numbers`, every call is logged in `AIRequestLog`, and failures fall back gracefully[cite: 6, 13] | `backend/apps/submissions/discrepancies.py`, `backend/apps/submissions/ai_client.py`, `backend/tests/test_discrepancies.py` |
| D-018 | 2026-11-16 | Idempotent Scheduled Reminders with Cooldown & Token Rotation | Automated deadline tracking (`T-7`, `T-3`, `T-1`, `OVERDUE-*`) must avoid duplicate emails, backlogs, or stale link replay[cite: 5, 10] | Sending all missed reminders on catch-up; reusing static upload tokens | Unique constraint `(target, milestone)` in `ScheduledReminder` prevents duplicate sends, catch-up fires only the latest due milestone, 20-hour manual cooldown avoids double-mailing, and each reminder rotates the single-use `PortalAccessGrant` token[cite: 5] | `backend/apps/data_requests/reminders.py`, `backend/apps/data_requests/models.py`, `backend/tests/test_reminders.py` |
| D-019 | 2026-11-18 | Multi-Ranking Public Portal & Audited Manual Ranking Workflow | Support non-NIRF institutional rankings (QS, THE, MDRA) with banded rank plotting and auditable internal sign-off[cite: 7] | Hardcoding static JSON arrays for QS/THE; direct unverified publishing | `ExternalRankingResult` supports banded rank parsing (`801-1000` midpoint) for public trend plots, while `RankingRecord` + immutable `RankingAuditLog` enforce `DRAFT -> PENDING_REVIEW -> VERIFIED -> PUBLISHED` governance with evidence stripping for public callers[cite: 6, 7] | `backend/apps/rankings/models.py`, `backend/apps/rankings/views.py`, `backend/tests/test_public_rankings.py`, `backend/tests/test_ranking_records.py` |
| D-020 | 2026-11-19 | Phase 4 Go-Live Readiness Gates, Portable Backups & Briefing PDF | Production handover requires objective GO/NO-GO evidence, verified DR drills, multi-category DCS exports, and production deploy gates[cite: 6, 7, 9, 10] | Manual handover checklists; native-only `pg_dump` backups | `apps/golive` evaluates live KPIs (`flag_reliability`, `data_auditability`, `system_resilience`), UAT outcomes, training, and immutable `SignOff` snapshots alongside SHA-256 verified portable backup/restore, `reportlab` boardroom PDFs, `openpyxl` DCS exports, and `manage.py check --deploy` CI gating[cite: 6, 7, 9, 10, 13] | `backend/apps/golive/`, `backend/apps/submissions/briefing.py`, `backend/apps/submissions/dcs_export.py`, `.github/workflows/ci.yml`, `backend/tests/test_phase4_golive.py` |
| D-021 | 2026-11-27 | Cross-Platform Ranking Fetch Lock (`fcntl` + Windows `msvcrt`) | `fetch_lock()` silently skipped locking when `import fcntl` failed on Windows, failing concurrency tests and risking live network hits | Skipping concurrency tests on Windows; adding a third-party `filelock` dependency | Using stdlib `msvcrt.locking` (`LK_NBLCK`/`LK_UNLCK`) as the non-POSIX fallback on `.fetch.lock` (opened with `a+`, 1-byte lock range) enforces real cross-process exclusion on both Linux and Windows with zero new dependencies | `backend/apps/rankings/scraper.py`, `backend/tests/test_ranking_refresh.py` |

---

## 5. Issues Discovered and Fixes

| # | Issue | Root Cause | Status | Resolution / Fix | Date |
|---|-------|------------|--------|------------------|------|
| 1 | `pytest.ini` duplicate `addopts` key | `backend/pytest.ini` contained `addopts` on both lines 4 and 7 | Fixed | Cleaned `pytest.ini` to a single `addopts = -v --tb=short` entry | 2026-10-31 |
| 2 | `test_user_email_is_unique` failed | Test assumed `User.email` was unique, but `User` extends `AbstractUser` where `username` is the unique credential | Fixed | Updated test to `test_user_username_is_unique`, verifying unique constraint on `username` | 2026-10-31 |
| 3 | Missing test dependencies in `requirements.txt` | `pytest-cov`, `factory-boy`, and `ruff` were missing | Fixed | Added `pytest-cov>=5.0.0`, `factory-boy>=3.3.0`, `ruff>=0.6.0` to `requirements.txt` | 2026-10-31 |
| 4 | Obsolete CI workflow (`ci-cd.yml`) | `.github/workflows/ci-cd.yml` only ran on `main`, did not test `phase-2/**`, lacked coverage and lint checks | Fixed | Replaced with comprehensive `.github/workflows/ci.yml` supporting matrix tests, PostgreSQL, Ruff, and Buildx | 2026-10-31 |
| 5 | Frontend `npm run lint` script missing (initial CI setup) | `frontend/package.json` initially lacked ESLint/Vitest scripts before Lokesh's frontend QA setup | Fixed | Added `eslint.config.js`, `vitest.config.ts`, `lint`, `typecheck`, `test`, and `validate` scripts in `frontend/package.json` and wired them into `.github/workflows/ci.yml` | 2026-11-03 |
| 6 | Unused variable warnings from Ruff | `target` in `services.py` and `child_id` in `test_organogram.py` were unused | Fixed | Removed unused assignment in `services.py` and added assertion verifying child unit exists in `test_organogram.py` | 2026-10-31 |
| 7 | Frontend test type definition resolution & pre-existing component test failures | `frontend/tsconfig.json` lacked `vitest/globals` and `@testing-library/jest-dom` in `types`, and pre-existing component tests suffered fake-timer toast stalls, duplicate-text queries, and narrow prop types | Fixed | Added `"vitest/globals"` and `"@testing-library/jest-dom"` to `frontend/tsconfig.json`, configured `setup.ts` DOM cleanup + `test-utils.tsx` stubs, and fixed test assertions (`tsc --noEmit` 0 errors, 203/203 Vitest passing) | 2026-11-09 |
| 8 | Missing `openpyxl` / `reportlab` dependencies & unapproved export leak | Phase 2–4 DCS Excel exports (`openpyxl`) and boardroom briefing PDFs (`reportlab`) needed explicit runtime dependencies, and initial rollup summed unapproved submissions[cite: 6, 7] | Fixed | Pinned `openpyxl>=3.1.5` and `reportlab>=4.2.0` in `backend/requirements.txt`, restricted `rollup.py` & `dcs_export.py` strictly to `APPROVED` submissions, and verified via `test_submissions.py`, `test_schema_fidelity.py`, and `test_phase2_analytics.py`[cite: 6, 7] | 2026-11-15 |
| 9 | Phase 4 merge triggered `test_no_endpoint_is_public_by_omission` failure | `HealthView` and `RankingRecordListCreateView` declared `AllowAny` after merging Phase 4 without being registered in `test_rbac_matrix.py`'s `PUBLIC_VIEWS` allowlist[cite: 8] | Fixed | Audited both endpoints (liveness status only; published rankings with evidence/actor metadata stripped) and added them to `PUBLIC_VIEWS`[cite: 8] | 2026-11-22 |
| 10 | Windows `fcntl` `ImportError` broke ranking fetch concurrency lock | `fetch_lock()` in `backend/apps/rankings/scraper.py` caught `ImportError` on Windows without acquiring any lock, causing `test_concurrent_fetches_are_refused` to return HTTP 200 instead of 409 and attempt live HTTP requests | Fixed | Implemented non-blocking Windows `msvcrt.locking` (`LK_NBLCK`/`LK_UNLCK`) fallback in `fetch_lock()` with safe `a+` file opening and added cross-platform lock tests in `test_ranking_refresh.py` | 2026-11-27 |
| 11 | Missing `backend/.coveragerc` and Phase 3/4 coverage gaps | `.gitignore` pattern `.coverage*` masked `.coveragerc`, and `+300%` rise anomaly, 3-year approved lookback, multi-unit dispatch, full-app schema parity, and `RankingRecord` workflow lacked dedicated unit tests[cite: 4, 5, 6, 7] | Fixed | Added `!.coveragerc` to `.gitignore`, created `backend/.coveragerc`, and added tests across `test_migrations.py`, `test_data_requests.py`, `test_history_comparison.py`, `test_discrepancies.py`, `test_ranking_refresh.py`, `test_rbac_matrix.py`, and new `test_ranking_records.py`[cite: 4, 5, 6, 7, 8] | 2026-11-27 |

---

## 6. Testing Results

### Backend Test Suite Summary (Phases 2–4 Final Verification)
- **Total Test Cases Collected:** 787 tests across 21 test modules
- **Tests Passed:** 785 (100% of executed tests)
- **Tests Skipped:** 2 (intentional `DENIAL_ONLY` guard skips for `ADMIN` and `SUPERUSER` on `POST /api/v1/scraper/update/` in `test_rbac_matrix.py`, whose allowed path is verified directly in `test_ranking_refresh.py`)
- **Tests Failed:** 0
- **Execution Time:** 371.07 seconds (with full coverage instrumentation)
- **Overall Statement Coverage (`apps/`):** **89%** (`7,225` statements, `785` missed; excluding migrations via `backend/.coveragerc`)
  - `apps.accounts`: **96%** (`234` stmts, `9` missed — `models.py` 100%, `views.py` 96%, `permissions.py` 97%)
  - `apps.data_requests`: **93%** (`760` stmts, `56` missed — `serializers.py` 100%, `models.py` 98%, `services.py` 97%, `reminders.py` 96%, `views.py` 90%)
  - `apps.organogram`: **88%** (`481` stmts, `57` missed — `serializers.py` 100%, `models.py` 99%, `views.py` 83%)
  - `apps.rankings`: **90%** (`994` stmts, `99` missed — `models.py` 99%, `serializers.py` 100%, `store.py` 94%, `views.py` 92%, `analytics.py` 91%, `scraper.py` 84%)
  - `apps.submissions`: **90%** (`3,678` stmts, `378` missed — `audit.py` 100%, `serializers.py` 100%, `xlsx_templates.py` 99%, `dcs_export.py` 98%, `models.py` 97%, `provenance.py` 96%, `rollup.py` 96%, `briefing.py` 94%, `demo_cycle.py` 94%, `analytics.py` 91%, `discrepancies.py` 90%, `ai_client.py` 88%, `views.py` 86%, `cross_checks.py` 86%, `history.py` 85%)
  - `apps.golive`: **83%** (`1,078` stmts, `186` missed — `models.py` 97%, `kpis.py` 95%, `readiness.py` 93%, `views.py` 87%, `backup.py` 85%)

### Frontend Test & Build Summary (`frontend/`)
- **Vitest Unit & Integration Suite:** 23 test files, **203 passed**, 0 failed (28.18s)
- **ESLint (`npm run lint`):** 0 errors (208 non-blocking pre-existing warnings)
- **TypeScript (`npm run typecheck`):** 0 errors (`strict: true`)
- **Production Bundle (`npm run build`):** Succeeded cleanly (`7,614` modules transformed in 13.16s -> `frontend/dist/`)

### Backend Test Suite Distribution

| Category | Test File | Count | Scope |
|---|---|---|---|
| Accounts & Auth | `tests/test_accounts.py` | 14 | User models, role defaults, `username` uniqueness, SimpleJWT login/refresh, role claims, `/api/auth/me/` |
| End-to-End Core Flows | `tests/test_backend.py` | 4 | Seeded 80-unit organogram, JWT auth retrieval, multi-unit dispatch, portal upload, status rollup[cite: 4, 5] |
| Organogram Contacts | `tests/test_contact_preservation.py` | 9 | Re-seeding preservation of operator mailboxes/status, contact patch API, academic coverage summary |
| Data Requests & Vault | `tests/test_data_requests.py` | 37 | Models, multi-unit dispatch, SHA-256 tokens, expiry/revocation, MIME/25 MB size validation, `tmp_path` `MEDIA_ROOT` isolation[cite: 4, 5] |
| Discrepancies & AI Review | `tests/test_discrepancies.py` | 27 | Rules (`-80%` drop, `+300%` rise, zero drop, `>= 40%` warning, restatements), scan reconciliation, mocked Gemini/OpenAI/OpenRouter/Anthropic calls, PII stripping, grounding, `AIRequestLog`, fallback[cite: 6, 13] |
| Historical Comparisons | `tests/test_history_comparison.py` | 15 | `prior_period`, `change_between`, same-period restatements, 3-year approved `unit_history` lookup, portal & reviewer hints, `_grid_rows` regression[cite: 5] |
| Migrations & Schemas | `tests/test_migrations.py` | 18 | Zero pending migrations, table existence across all 6 Django apps, string PKs, unique constraints, FKs |
| Organogram & Officers | `tests/test_organogram.py` | 24 | OrgUnit tree, `SET_NULL` parent cascade, NodalOfficer CRUD & M2M, camelCase serializers, access grants[cite: 4] |
| Phase 1 Acceptance | `tests/test_phase1_acceptance.py` | 7 | Full mock 2027 cycle across all 4 NIRF categories, approved-only rollup & exports, Maker-Checker audit trail, SHA-256 export logging[cite: 6, 7] |
| Phase 2 Analytics & Briefing | `tests/test_phase2_analytics.py` | 13 | Parameter trends, peer & own-history gap analysis, scenario projections, department contribution & joint-project deduplication, `reportlab` briefing PDF[cite: 6, 7] |
| Phase 4 Go-Live & DR | `tests/test_phase4_golive.py` | 40 | Production security gate (`DEBUG=False`), login throttling (`429`), `/api/health/`, pilots & 3 KPIs, UAT execution, training, immutable `SignOff`, checksummed backups, path-traversal guard, restore round-trip, DR drills[cite: 9, 10, 13] |
| Portal Link Security | `tests/test_portal_link_security.py` | 18 | Zero-knowledge token digests, link rotation on reminder/reissue, request close/reopen, officer revocation/unassignment[cite: 5] |
| Public Multi-System Rankings | `tests/test_public_rankings.py` | 19 | Rank band parsing, unauthenticated `/api/v1/public/ranking-systems/`, demo seed isolation, admin external result validation[cite: 7, 10] |
| Manual Ranking Workflow | `tests/test_ranking_records.py` | 3 | `RankingRecord` draft -> submit -> Auditor verify/reject -> Admin publish/unpublish, anonymous evidence stripping, `RankingAuditLog` immutability[cite: 6, 7, 8] |
| NIRF Refresh & Locking | `tests/test_ranking_refresh.py` | 14 | Automatic cycle discovery, atomic writes, mtime cache invalidation, staff-only fetch trigger, cross-platform `fcntl`/`msvcrt` `fetch_lock`, `refresh_rankings` lock guard |
| Rankings Scraper & API | `tests/test_rankings.py` | 27 | Name normalization, 2nd-gen IIT canonical mapping, ARIIA fallbacks, trends, `tmp_path` `DATA_DIR` isolation, LRU cache resets[cite: 7] |
| RBAC Matrix & Guards | `tests/test_rbac_matrix.py` | 420 | Role-by-endpoint matrix across all 6 roles & Go-Live/Phase 3 routes, `PUBLIC_VIEWS` URL-conf structural guard, department isolation, email login, throttling, user management & `ensure_admin`[cite: 8] |
| Scheduled Reminders | `tests/test_reminders.py` | 16 | `T-7`/`T-3`/`T-1`/`OVERDUE` milestones, idempotency, catch-up suppression, 20h cooldown, token rotation, outbox mail, `send_reminders` command & API[cite: 5, 10] |
| Schema Contract Fidelity | `tests/test_schema_fidelity.py` | 6 | Row-level type overrides, server-side `derive` persistence (`amountInWordsInr`, `sum`, `rowNumber`), category row filtering (`usedBy`, `labelByCategory`) |
| Spec Phase 1 Compliance | `tests/test_spec_phase1_compliance.py` | 44 | Server-side field bounds, spreadsheet normalization/error reporting, PII-redacted diffs, auditor log filtering/CSV export, versioned proof downloads, record deduplication, standardised templates, approved-only export gating[cite: 5, 6, 8] |
| NIRF Forms & DCS Exports | `tests/test_submissions.py` | 12 | Relative year engine, INR words, validation golden vectors, SDG cross-checks, programme bulk CSV import, faculty confirmation gate, end-to-end Maker-Checker + `openpyxl` DCS export[cite: 6, 7] |

---

## 7. CI Implementation History

- **Workflow File:** `.github/workflows/ci.yml`
- **Triggers:**
  - Pushes to `main`, `phase-2/**`, `feature/**`
  - Pull requests targeting `main`, `phase-2/**`
- **Jobs:**
  1. `backend-tests`: Matrix on Python 3.11 and 3.12, runs migrations on SQLite, validates `seed_organogram`, `load_form_schema`, and `seed_uat_scenarios` on a fresh database, executes `pytest` with coverage, uploads XML report.
  2. `backend-lint`: Ruff linting (`ruff check apps/ dora_backend/ tests/`), Django system check (`manage.py check`), production security gate check (`DJANGO_DEBUG=False python manage.py check --deploy --fail-level WARNING`), and migration drift check (`makemigrations --check --dry-run`).
  3. `frontend-build`: Node.js 20, `npm ci`, ESLint (`npm run lint`), TypeScript check (`npm run typecheck`), Vitest suite (`npm run test`), and Vite bundling (`npm run build`).
  4. `backend-integration-postgres`: PostgreSQL 16 Alpine service container, runs migrations, executes full test suite against real PostgreSQL (runs on `main` pushes/PRs).
  5. `docker-build`: Build backend and frontend Docker images with Docker Buildx and GitHub Actions cache.

---

## 8. Pending Tasks and Limitations

- [x] Phase 2 automated unit, integration, migration, and schema parity test suite (`conftest.py`, `accounts`, `organogram`, `data_requests`, `rankings`, `migrations`).
- [x] Phase 2 frontend ESLint 9 configuration, strict TypeScript resolution, and Vitest component/route integration suite (203 tests passing).
- [x] Phase 3 automated validation for RBAC matrix & URL-conf allowlist guard, 3-year historical baseline comparisons, rule-based + mocked Gemini/multi-provider AI discrepancy checks, scheduled reminders (`T-7`/`T-3`/`T-1`/`OVERDUE`), and public cross-system rankings[cite: 5, 6, 7, 8, 10, 13].
- [x] Phase 4 automated verification for Maker-Checker lifecycle, `openpyxl` multi-category DCS exports, `reportlab` boardroom briefing PDFs, `RankingRecord` workflow, checksummed backups/DR drills, UAT scenarios, and `check --deploy` security hardening[cite: 6, 7, 9, 10, 13].
- [x] Cross-platform Windows `msvcrt.locking` + POSIX `fcntl.flock` implementation for `fetch_lock()` in `scraper.py` (785 passed, 2 intentional skips, 0 failures; 89% statement coverage).
- [x] Ruff lint checks (0 errors), Django migration drift check (`No changes detected`), production `check --deploy` (0 issues), and frontend Vite build verified.
- [ ] *Campus IT Operations Handover:* Provision campus TLS certificates, configure `.env.production` secrets, restrict `/admin/` to campus IP ranges, and execute witnessed staging DR drill before final `GO_NO_GO` sign-off[cite: 9, 14].
- [ ] *Optional Future Enhancement:* Refresh stale `frontend/bun.lock` on a Bun-equipped workstation (`bun install`) and optionally integrate Playwright browser E2E tests and Dependabot/CodeQL SAST scanning.

---

## 9. Final Summary

All Phase 2, Phase 3, and Phase 4 automated quality assurance, security verification, cross-platform stabilization, and documentation objectives for the **Automated Ranking Portal (ARP)** at IIT Mandi have been completed and verified on branch `test/phases-2-to-4-validation`[cite: 10]:

1. **Migration Integrity & Core Backend (Phase 2):** Confirmed zero migration drift (`makemigrations --check --dry-run`) and full Django ORM/schema parity across all 6 backend apps (`accounts`, `organogram`, `data_requests`, `submissions`, `rankings`, `golive`), SimpleJWT claims, multi-unit request dispatch, SHA-256 grant hashing, and isolated `tmp_path` proof vault storage[cite: 5].
2. **Public Portal, Historical Baselines, AI Review, Reminders & RBAC (Phase 3):** Verified unauthenticated cross-system public ranking APIs, 3-year approved-only historical baseline comparisons, deterministic anomaly rules (`80%` drop, `300%` rise, zero drop) with mocked Gemini/multi-provider AI grounding and fallback, idempotent deadline reminder scheduling, and a 420-case deny-by-default RBAC matrix + URL-conf guard[cite: 5, 6, 7, 8, 10, 13].
3. **UAT Workflows, Multi-Ranking Exports, Cross-Platform Fix & Handover (Phase 4):** Validated complete Maker-Checker trails, `openpyxl` DCS exports across all 4 NIRF categories, `reportlab` boardroom briefing PDFs, audited `RankingRecord` publishing, checksummed backup/restore & DR drills, and fixed Windows `msvcrt.locking` concurrency locking in `scraper.py`[cite: 6, 7, 9, 10, 13].
4. **Full Verification Results:** Backend `pytest` passes **785 tests** (2 intentional `DENIAL_ONLY` skips, 0 failures) with **89% statement coverage**, `ruff check` reports **0 errors**, `python manage.py check --deploy` reports **0 issues**, and `frontend/` passes ESLint (0 errors), `tsc --noEmit` (0 errors), Vitest (**203/203 passed**), and Vite production bundling (`npm run build`).
