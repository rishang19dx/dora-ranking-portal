# Automated Ranking Portal (ARP) - IIT Mandi

The **Automated Ranking Portal (ARP)** is a centralized platform designed to streamline the collection, management, and visualization of institutional data for various ranking frameworks (NIRF, QS, THE) at IIT Mandi. 

This repository contains the full-stack Next.js 15 application, featuring a "Bento 2.0" design aesthetic, a rigorous role-based routing architecture, and a PostgreSQL backend powered by Prisma ORM.

## ✨ Key Features

- **Interactive Institute Organogram**: The academic, administrative and functional hierarchy of IIT Mandi (`src/lib/organogram.ts`) rendered as a searchable, filterable, selectable tree. Every unit declares the ranking data it is custodian of, so data collection follows the exact structure of the institute.
- **Targeted Data Requests**: A three-step composer (sections → required data → message) that resolves the selected organogram sections to their nodal officers, narrows the requested items per section, and dispatches a templated email to each recipient.
- **Nodal Officer Roster**: Full CRUD management of designated officers per department/section, seeded from the mailboxes published in the organogram, with coverage warnings for sections that have no officer.
- **Automated Portal Provisioning**: Dispatching a request issues one single-purpose upload link per (officer, section, request). Only the SHA-256 digest of the token is stored; links expire, rotate on every reminder, and are revoked when a request is closed or an officer is removed.
- **Role-Based Routing Architecture**: Implements Next.js Route Groups `(public)` and `(dashboard)` to enforce strict layout separation for three distinct workflows:
  - **Public Portal**: Read-only landing page for viewing verified rankings, institutional highlights, and public announcements.
  - **Admin Dashboard**: Comprehensive portal for DORA administrators to manage data collection cycles, oversee nodal officers, and review submissions.
  - **Nodal Officer Portal**: Department-scoped dashboard featuring a sleek, step-by-step data upload wizard.
- **Bento 2.0 UI Architecture**: A premium interface utilizing asymmetric grid layouts, pure white cards with diffusion shadows, and strict 1px borders.
- **Framer Motion Engine**: Fluid, spring-based micro-interactions across all dashboards. Features a completely custom, lightweight Toast Notification System for instant user feedback.
- **Data Governance Workflows**: Designed to support strict maker-checker protocols (`DRAFT -> SUBMITTED -> CORRECTION_REQUESTED -> APPROVED`) backed by immutable decision history logs.

## 🛠 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Database**: PostgreSQL
- **ORM**: Prisma (v7+)
- **Styling**: [Tailwind CSS v3](https://tailwindcss.com/)
- **Animation**: [Framer Motion](https://motion.dev/)
- **Icons**: [Phosphor Icons](https://phosphoricons.com/)

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js, npm, and PostgreSQL installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd iit-mandi-ranking-portal
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Generate the Prisma Client:
   ```bash
   npx prisma generate
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the public landing page.

## 📁 Project Structure

```text
src/
├── app/
│   ├── (public)/         # Public landing layout and pages
│   ├── (dashboard)/      # Protected dashboard wrappers
│   │   ├── admin/        # Admin toolset
│   │   │   ├── organogram/       # Interactive institute hierarchy
│   │   │   ├── nodal-officers/   # Roster of designated officers
│   │   │   ├── data-collection/  # Dispatched request tracker
│   │   │   └── data-requests/    # Request composer and detail view
│   │   └── nodal-officer/# Nodal Officer toolset (Upload Wizard)
│   ├── portal/[token]/   # Restricted, login-free proof upload portal
│   ├── api/              # Route handlers (organogram, officers, requests, uploads)
│   ├── layout.tsx        # Root layout, Fonts, and Toast Provider
│   └── globals.css       # Tailwind directives
├── components/
│   ├── organogram/OrgTree.tsx # Reusable selectable hierarchy tree
│   ├── DashboardLayout.tsx # Dynamic role-based sidebar
│   └── ToastProvider.tsx   # Custom Framer Motion notification system
├── lib/
│   ├── organogram.ts     # Institute hierarchy + data custodianship
│   ├── data-catalogue.ts # Requestable ranking data items per framework
│   └── server/           # Store, mailer, access tokens, dispatch service
prisma/
├── schema.prisma         # Relational database models
prisma.config.ts          # Prisma v7 connection configuration
```

## 📬 Data Collection Workflow

1. **Map** - `/admin/organogram` renders the institute hierarchy. Each section shows whether a nodal officer covers it and what is outstanding.
2. **Staff** - `/admin/nodal-officers` manages the roster. The roster is seeded from the mailboxes published in the organogram and flags every data-owning section with no officer.
3. **Request** - `/admin/data-requests/new` selects sections, suggests the data items those sections own, and previews the exact email each recipient will receive.
4. **Provision** - Dispatch emails every resolved officer a restricted link (`/portal/<token>`) scoped to one section and one request.
5. **Collect** - Officers upload proof per data item. Files are checksummed (SHA-256); a section flips to `PARTIAL`, then `SUBMITTED` once every requested item has evidence.
6. **Follow up** - `/admin/data-collection` tracks progress; reminders rotate links, and closing a request revokes them.

### Configuration

| Variable | Purpose |
| --- | --- |
| `PORTAL_DATA_DIR` | Directory for the portal store, uploads and local mail outbox (default `.data`) |
| `APP_BASE_URL` | Base URL used to build upload links (falls back to `APP_URL`) |
| `PORTAL_ACCESS_TTL_DAYS` | Lifetime of a provisioned upload link (default 45) |
| `RESEND_API_KEY` / `MAIL_FROM` | Email transport. Without a key, messages are written to `<PORTAL_DATA_DIR>/outbox/` and reported as `SIMULATED` |

The workflow currently persists to a JSON store behind `src/lib/server/store.ts`. The equivalent Prisma models (`OrgUnit`, `NodalOfficer`, `DataRequest`, `PortalAccessGrant`, `ProofUpload`) are already defined in `prisma/schema.prisma`, so moving to Postgres only replaces that module.

## 🗺 Roadmap

The frontend UX foundation is complete. The immediate next phase involves finalizing the backend connections:

1. **Database Syncing**: Pushing the Prisma schema to the PostgreSQL instance (`npx prisma db push`).
2. **NextAuth.js Integration**: Securing the `/admin` and `/nodal-officer` routes strictly behind Google OAuth (restricted to `@iitmandi.ac.in` domains).
3. **API Development**: Creating Next.js Server Actions to process form uploads and attachments to Amazon S3.

---
*Developed for IIT Mandi.*
