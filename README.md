# Automated Ranking Portal (ARP) - IIT Mandi

The **Automated Ranking Portal (ARP)** is a centralized platform designed to streamline the collection, management, and visualization of institutional data for various ranking frameworks (NIRF, QS, THE) at IIT Mandi. 

This repository contains the full-stack Next.js 15 application, featuring a "Bento 2.0" design aesthetic, a rigorous role-based routing architecture, and a PostgreSQL backend powered by Prisma ORM.

## ✨ Key Features

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
│   │   ├── admin/        # Admin toolset (Data Collection, Users, Settings)
│   │   └── nodal-officer/# Nodal Officer toolset (Upload Wizard)
│   ├── layout.tsx        # Root layout, Fonts, and Toast Provider
│   └── globals.css       # Tailwind directives
├── components/
│   ├── DashboardLayout.tsx # Dynamic role-based sidebar
│   └── ToastProvider.tsx   # Custom Framer Motion notification system
prisma/
├── schema.prisma         # Relational database models
prisma.config.ts          # Prisma v7 connection configuration
```

## 🗺 Roadmap

The frontend UX foundation is complete. The immediate next phase involves finalizing the backend connections:

1. **Database Syncing**: Pushing the Prisma schema to the PostgreSQL instance (`npx prisma db push`).
2. **NextAuth.js Integration**: Securing the `/admin` and `/nodal-officer` routes strictly behind Google OAuth (restricted to `@iitmandi.ac.in` domains).
3. **API Development**: Creating Next.js Server Actions to process form uploads and attachments to Amazon S3.

---
*Developed for IIT Mandi.*
