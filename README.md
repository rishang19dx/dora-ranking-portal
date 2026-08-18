# Automated Ranking Portal (ARP) - IIT Mandi

The **Automated Ranking Portal (ARP)** is a centralized platform designed to streamline the collection, management, and visualization of institutional data for various ranking frameworks (NIRF, QS, THE) at IIT Mandi. 

This repository contains the interactive frontend prototype, built with a modern, high-end "Bento 2.0" design aesthetic, engineered for high responsiveness, and powered by fluid spring physics.

## ✨ Key Features

- **Bento 2.0 UI Architecture**: A premium interface utilizing asymmetric grid layouts, pure white cards with diffusion shadows, and strict 1px borders.
- **Premium Typography & Iconography**: Built with the highly legible `Outfit` font and a comprehensive suite of duotone icons from `@phosphor-icons/react`.
- **Framer Motion Engine**: Fluid, spring-based micro-interactions and transitions across all dashboards, modals, and navigation elements.
- **Mobile-First Responsiveness**: Complete with a native slide-over drawer for mobile navigation and highly adaptive flex/grid structures.
- **Module Parity**: Contains functional frontend views for:
  - **Dashboard**: High-level metrics and perpetual progress trackers.
  - **Data Collection**: Cycle management and deadlines.
  - **Nodal Officers**: Departmental access control and user management (with interactive Add Officer modal).
  - **NIRF Parameters**: Granular breakdown of institutional scores.
  - **Document Repository**: Centralized storage interface for ranking proofs.
  - **Settings**: State-managed sub-routing for General, Security, Notifications, and Schema preferences.

## 🛠 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS v3](https://tailwindcss.com/)
- **Animation**: [Framer Motion](https://motion.dev/)
- **Icons**: [Phosphor Icons](https://phosphoricons.com/)
- **Language**: TypeScript

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js and npm installed on your machine.

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
   *(Note: You can safely ignore npm audit warnings related to `postcss` or `sharp`, as they are deep dependencies of the current Next.js version.)*

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📁 Project Structure

```text
src/
├── app/
│   ├── data-collection/  # Data request cycles and deadlines
│   ├── documents/        # Centralized proof repository view
│   ├── nodal-officers/   # User management and RBAC view
│   ├── rankings/         # Parameter breakdowns (e.g., TLR, RPC)
│   ├── settings/         # System configurations
│   ├── layout.tsx        # Root layout, Font config, and global wrapper
│   ├── page.tsx          # Main Dashboard (Bento Grid)
│   └── globals.css       # Tailwind directives and base styles
├── components/
│   └── DashboardLayout.tsx # Global sidebar and top navigation wrapper
```

## 🗺 Roadmap (Data Integration Phase)

The current iteration is a static, interactive prototype. The immediate next phase involves mapping the frontend to a robust backend architecture. 

**Upcoming Backend Requirements:**
1. **Dynamic Schema Engine**: A highly agile database schema to handle yearly variations in NIRF/QS parameters without hardcoded table structures.
2. **RBAC & Authentication**: Secure, department-scoped access control ensuring Nodal Officers can only mutate data relevant to their authorization.
3. **Document Pipeline**: An integrated S3 (or equivalent) bucket solution for handling heavy PDF proof uploads, including size limits and security checks.

---
*Developed for IIT Mandi.*
