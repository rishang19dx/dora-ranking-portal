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