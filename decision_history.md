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
