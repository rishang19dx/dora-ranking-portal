# Decision History

This document serves as an immutable chronological log of key decisions taken by the user and the agent. It tracks the evolution of the project's architecture, tools used, and files impacted.

### 2026-08-19: Backend Architecture & Domain Modeling
**Context:** After establishing the frontend structure (Bento 2.0 aesthetics), the project required a solid backend foundation for the Data Collection engine as outlined in Phase 1 of the ARP Proposal.

**Decisions Made:**
1.  **Database & ORM:** Chose **PostgreSQL** as the primary relational database, and **Prisma** as the Object-Relational Mapper (ORM).
    *   *Reasoning:* Prisma's robust schema definition provides excellent type-safety for Next.js and handles relations elegantly. PostgreSQL is standard for strictly typed tabular data like NIRF.
2.  **Authentication:** **Google OAuth** will be used to enforce login (expected to be restricted to institutional emails via NextAuth.js).
3.  **Institutional Organogram:** The hierarchy is modeled as: `Institute -> School -> Department (branch-wise)`. 
    *   *Reasoning:* Reflects IIT Mandi's real-world structure.
4.  **Nodal Officer Mapping:** A many-to-many relationship was established. A Nodal Officer can handle multiple departments, and a department can have multiple Nodal Officers.
5.  **Faculty Association:** A strict rule was established that **one faculty belongs to only one school**, avoiding complex split-affiliation calculations.
6.  **NIRF Data Granularity:** Rather than submitting raw lines of individual student/faculty names, the system will use **pre-formatted aggregated forms** (created by the Dev Team) which Nodal Officers will fill out and attach proof documents to.
7.  **Data Governance Workflows:** 
    *   **Yearly Snapshots:** All submissions are tied strictly to a `RankingCycle` (e.g., Year 2026).
    *   **Submission State Machine:** Adopted strict states: `DRAFT -> SUBMITTED -> CORRECTION_REQUESTED -> APPROVED`.
    *   **Audit Logging:** Row-level audit logging will be implemented, capturing JSON deltas of any edits to maintain 100% compliance.

**Files Impacted:**
*   `implementation_plan.md` (Created and Approved)
*   `prisma/schema.prisma` (Created - pending initialization)
*   `decision_history.md` (Created)

**Skills Used:**
*   `write_to_file`
*   `run_command`
*   `view_file`

### 2026-08-19: Frontend UX Refinements & Nodal Officer Portal
**Context:** The frontend lacked interactivity on global buttons and required a dedicated flow for Nodal Officers to upload ranking data.

**Decisions Made:**
1.  **Nodal Officer Route:** Selected `/submissions/new` as the semantic route for data upload.
2.  **Upload UX Architecture:** Chose a **Step-by-Step Wizard** over a single dashboard to reduce cognitive load and ensure ordered data entry (e.g., Step 1: Faculty, Step 2: Student Intake, Step 3: Proofs).
3.  **Global Feedback System:** A toast notification system will be built to provide immediate visual feedback (success/error states) on actions like "Save" or "Upload".
4.  **Performance Tracking:** Acknowledged the Next.js `dev` mode cold start latency (~10s). This is standard for App Router compilation, but we will monitor it and avoid overly heavy client-side imports.

**Files Impacted:**
*   `task.md` (Updated)
*   `decision_history.md` (Updated)

### 2026-08-19: Role-Based Routing Architecture (Next.js Route Groups)
**Context:** The portal needed to support three distinct user types: Public (no auth), Admin (full access), and Nodal Officers (departmental access). The original `DashboardLayout` was wrapping everything, preventing a public landing page.

**Decisions Made:**
1.  **Next.js Route Groups:** Adopted `(public)` and `(dashboard)` Route Groups to enforce layout separation without clustering the root namespace with layout files.
2.  **Explicit URL Namespacing:** Opted for explicit paths like `/admin/data-collection` and `/nodal-officer/submit` rather than implicit conditional rendering. This maps directly to user roles and makes debugging/analytics easier.
3.  **Dynamic Dashboard Sidebar:** The `DashboardLayout` was refactored to read the URL (`usePathname`) and dynamically swap between Admin and Nodal Officer navigation links, avoiding duplicated layout code.
4.  **Auth Mocking via Routes:** Since NextAuth.js is not yet tied to a real DB, navigating manually to `/admin/...` or `/nodal-officer/...` acts as the role switcher for the current phase.

**Files Impacted:**
*   `src/app/*` (Massive restructuring of all routes)
*   `src/app/layout.tsx` (Stripped of DashboardLayout)
*   `src/components/DashboardLayout.tsx` (Made dynamic)

### 2026-08-19: "WOW" Visual Enhancements & Brand Integration
**Context:** The portal required a visual upgrade from a flat, clean prototype to a premium, high-end application using glassmorphism and the official IIT Mandi branding.

**Decisions Made:**
1.  **Brand Integration:** The official IIT Mandi logo and campus banner were integrated into the public landing page as requested by the user, immediately grounding the application in its institutional context.
2.  **Glassmorphism & Depth:** The main dashboard layouts and cards were upgraded from solid `bg-white` to `bg-white/70 backdrop-blur-2xl` to create a frosted glass effect that interacts with underlying UI layers.
3.  **Motion & Interactions:** Framer Motion was utilized to add staggered cascading entry animations to the grid cards, removing the static load feel.
4.  **Regression Fixes:** Addressed 404 broken links identified by the browser subagent (`/public-data`, `/submissions/new` redirect).

**Files Impacted:**
*   `task.md` (Updated)
*   `decision_history.md` (Updated)

### 2026-08-22: UI Overhaul & Premium "Institution Vibe" Transition
**Context:** The portal required a comprehensive UI overhaul to transition from a generic tech aesthetic to a premium, academic "Institution Vibe" (Bento 2.0 design system).

**Decisions Made:**
1.  **Color Palette & Typography:** Implemented a sophisticated, harmonious color palette consisting of Sage, Dusty Rose, Soft Gold, and Slate Blue. Integrated `Playfair Display` serif typography to elevate the academic feel and ensure a premium visual experience.
2.  **Icon Library Migration:** Systematically transitioned from `lucide-react` to `@phosphor-icons/react` across core components (like DataCollection, Documents, and Rankings) to achieve a more cohesive and refined iconography.
3.  **Build Stabilization & Technical Debt:** 
    *   Addressed leftover artifacts from a previous Vite setup (`src/main.tsx`, `src/App.tsx`). Rather than deleting them, they were explicitly excluded from the Next.js TypeScript compilation (`tsconfig.json`) to prevent module resolution and type errors while preserving them for reference.
    *   Resolved strict TypeScript errors with legacy `lucide-react` icons (e.g., removing unsupported `title` props on SVG elements in `RankingsView.tsx` and wrapping them in semantic HTML spans).

**Files Impacted:**
*   `tailwind.config.ts` & `src/index.css` (Theming and Tokens)
*   `src/app/(dashboard)/admin/*` (UI Refinements)
*   `tsconfig.json` (Build configuration)
*   `src/views/RankingsView.tsx` (Type fixes)
*   `decision_history.md` (Updated)



## 2026-09-03: Nodal Officer Upload Portal

**Context:** Phase 1 requires Nodal Officers to submit metric data and supporting evidence for their assigned department.

**Decisions Made:**
1. Replaced the placeholder multi-step wizard with a focused client-side submission form containing a title, metric category, structured raw-data upload, and proof-document upload.
2. Used `lucide-react` icons and a white card with subtle gray borders and a prominent blue submit action to match the requested interaction and visual hierarchy.
3. Kept the department scope visible as account-associated context; real authenticated department data will replace the placeholder when authentication is connected.
4. Implemented a dummy `onSubmit` handler that prevents navigation and displays a success state with `PENDING` status, matching the intended submission workflow.

**Files Impacted:**
- `src/app/(dashboard)/nodal-officer/submissions/new/page.tsx`
- `decision_history.md`

## 2026-09-09: Organogram-Driven Data Collection & Nodal Officer Provisioning

**Team Member:** Krishna (Member)
**Week:** 2 (Phase 1 - Core NIRF Workflow)

**Context:** The admin needed to run data collection according to the exact hierarchy of the institute: an interactive organogram, a managed roster of nodal officers per section, targeted email requests to selected sections, and automatic restricted portal access for officers to upload ranking proofs.

**Decisions Made:**
1. **Organogram as code, not content.** `Institute_Organogram.md` (Mermaid) is documentation and cannot be queried, so the hierarchy was modelled in `src/lib/organogram.ts` as a typed tree (`GOVERNANCE / EXECUTIVE / ACADEMIC / ADMINISTRATIVE / FUNCTIONAL`) covering the Director's office, all Deans, the Registrar's two Deputy Registrars, every functional section beneath them, and the nine schools/centres with their faculty bodies. Published mailboxes were carried over verbatim.
2. **Data custodianship on the unit.** Each unit declares `dataScopes` drawn from a catalogue of 28 requestable items (`src/lib/data-catalogue.ts`, grouped by NIRF parameter: TLR / RPC / GO / OI / PR / Institutional). This single mapping drives both directions of the composer - selecting sections suggests the data they own, and each section's request is narrowed to the items it actually holds.
3. **File-backed store behind a repository module.** Postgres is not provisioned yet, so all workflow state persists to `.data/portal-store.json` through `src/lib/server/store.ts` with a serialised read-modify-write queue and atomic renames. Mirrored Prisma models (`OrgUnit`, `NodalOfficer`, `DataRequest`, `PortalAccessGrant`, `ProofUpload`) were added to the schema so the migration replaces only that one module.
4. **Roster seeded from the organogram.** On first run the officer roster is populated from the mailboxes published in the organogram as `INVITED` records, so the admin starts from real institute contacts, and sections with no officer are surfaced as explicit coverage warnings before dispatch.
5. **Access provisioning as a side effect of dispatch.** Sending a request issues one single-purpose grant per (officer, section, request). Only the SHA-256 digest of the token is stored, verification is constant-time, links carry a TTL (default 45 days), a reminder revokes and rotates the previous link, and closing a request or removing an officer revokes every outstanding grant. Uploads are scoped server-side to the grant's own section and data items, extension-checked against the catalogue, size-capped at 25 MB and checksummed for audit.
6. **No new dependencies for email.** Instead of adding an SMTP client, the mailer posts to the Resend HTTP API when `RESEND_API_KEY` is present and otherwise writes rendered messages to `.data/outbox/`, reporting them as `SIMULATED`. Dispatch is therefore fully exercisable in development, and the delivery log records the transport outcome per recipient.

**Files Impacted:**
- `src/lib/organogram.ts`, `src/lib/data-catalogue.ts`, `src/lib/types.ts` (Domain model)
- `src/lib/server/{store,access,mailer,dispatch,coverage,http}.ts` (Workflow services)
- `src/app/api/{organogram,nodal-officers,data-requests,portal}/**` (Route handlers)
- `src/components/organogram/OrgTree.tsx` (Reusable selectable hierarchy)
- `src/app/(dashboard)/admin/{organogram,nodal-officers,data-collection,data-requests}/**` (Admin UI)
- `src/app/portal/[token]/**` (Restricted upload portal)
- `src/components/DashboardLayout.tsx`, `prisma/schema.prisma`, `.env.example`, `.gitignore`, `README.md`
