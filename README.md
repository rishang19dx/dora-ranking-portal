# Automated Ranking Portal (ARP) - IIT Mandi

The **Automated Ranking Portal (ARP)** is a centralized platform designed to streamline the collection, management, verification, and visualization of institutional ranking data (NIRF, QS, THE) at IIT Mandi.

The system is architected as a decoupled monorepo featuring a **React 19 Single Page Application (SPA)** with Bento 2.0 aesthetics and an enterprise-grade **Django 5.1 REST Framework** backend.

---

## ✨ Key Features

- **Interactive Institute Organogram**: The complete academic, administrative, and functional hierarchy of IIT Mandi (80 organizational units) rendered as a searchable, filterable, selectable tree with data custodianship mappings.
- **NIRF Structured Forms Engine**: Generic, single-source-of-truth schema-driven engine (`nirf_form_schema.json` v1.0.0) covering 28 sections across four categories: Overall, Engineering, Innovation, and SDG (Sustainable Institutions).
- **Targeted Data Requests & Category Preselection**: Three-step composer that selects organogram sections, preselects NIRF categories, maps required metrics per section, and dispatches templated notification requests.
- **Academic Programme Registry**: Institutional degree programmes mapped to offering schools and centres with NIRF levels (UG4, UG5, PG2, PG3, PG6, DOC) and bulk CSV/XLSX import.
- **Relative Year Engine**: Computes dynamic reference years and placement cohort batches relative to cycle year (e.g. NIRF 2027).
- **Maker-Checker Governance & Audit Trail**: State machine `DRAFT -> SUBMITTED -> CORRECTION_REQUESTED -> APPROVED` with row-level immutable audit logging and strict PII masking.
- **Central Faculty Owner & School Confirmation**: Central owner under Faculty Affairs (`faculty-service-matters`) with per-school confirmation workflow before admin approval.
- **Rollup & DCS Excel Export**: Category rollup summing unit numbers and outputting official DCS workbooks with IIT Mandi's headings via `openpyxl`.
- **Nodal Officer Roster**: Full CRUD management of designated departmental officers, seeded from published institutional mailboxes, with visual coverage indicators.
- **Automated Secure Portal Provisioning**: Dispatching a request generates unique, single-purpose upload links (`/portal/:token`). Raw tokens are never stored; only **SHA-256 digests** are persisted in the database.
- **Proof File Vault**: Secure document upload handling supporting PDF, CSV, Excel, and Word files up to 25MB with automated SHA-256 integrity checksum calculation.
- **Integrated NIRF Ranking Engine**: Ingests, caches, and indexes multi-year NIRF data (Engineering, Overall, Innovation) with instant 2nd-generation IIT comparisons.
- **Bento 2.0 Academic Aesthetics**: Asymmetric card grids, soft diffusion shadows, and IIT Mandi institutional palette (Sage, Dusty Rose, Soft Gold, Slate Blue, and Navy).

---

## 🛠 Tech Stack

### Frontend (`frontend/`)
- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Routing**: [React Router v6](https://reactrouter.com/)
- **State & Caching**: [TanStack React Query v5](https://tanstack.com/query)
- **Styling**: [Tailwind CSS v3](https://tailwindcss.com/)
- **Animation**: [Motion / Framer Motion](https://motion.dev/)
- **Icons**: Phosphor Icons & Lucide React

### Backend (`backend/`)
- **Framework**: [Django 5.1](https://www.djangoproject.com/) + [Django REST Framework](https://www.django-rest-framework.org/)
- **Authentication**: JWT via [SimpleJWT](https://django-rest-framework-simplejwt.readthedocs.io/) with custom claims
- **Database**: SQLite (default local development) / PostgreSQL 16 (production)
- **Testing**: Pytest + `pytest-django`

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Bun (or Node.js 20+)

### Running Locally (Concurrent Development)

1. **Install Dependencies & Setup**:
   ```bash
   # Setup Python virtualenv in backend
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py seed_organogram
   python manage.py load_form_schema
   cd ..

   # Setup Frontend
   cd frontend
   bun install # or: npm install
   cd ..
   ```

2. **Start Development Servers**:
   ```bash
   bun run dev # or: npm run dev
   ```
   - **Frontend UI**: [http://localhost:5173](http://localhost:5173)
   - **Django REST API**: [http://127.0.0.1:8000/api/](http://127.0.0.1:8000/api/)
   - **Default Admin Account**: `admin` / `admin123`

---

## 🐳 Docker Deployment

The repository includes a production-ready `docker-compose.yml` orchestrating PostgreSQL, Django (gunicorn) and an Nginx reverse-proxied React SPA. Secrets live in a git-ignored `.env.production`:

```bash
cp .env.production.example .env.production   # fill in DJANGO_SECRET_KEY, POSTGRES_PASSWORD, hosts
docker compose --env-file .env.production up --build -d
```

- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **REST API**: proxied by Nginx on `/api/`; liveness at `/api/health/`. Proof files are only served through the authenticated download API.
- The backend refuses to start with `DJANGO_DEBUG=False` and a missing or weak secret key.

Full operations documentation (installation, configuration, release/rollback, backup/restore, disaster recovery, support) is in [`docs/runbooks/`](./docs/runbooks/).

---

## 🚦 Phase 4: Go-Live, UAT & Handover

- **Go-Live Readiness** page (`/admin/go-live`): readiness gates and a GO / NO-GO recommendation computed from live evidence.
- **Controlled pilot KPIs**: AI reliability (reviewer ground truth on every automated check, >95% accuracy and zero critical false positives), data auditability (100% of modifications traced to an actor and timestamp) and system resilience (witnessed DR drill within 24 h RPO / 8 h RTO).
- **UAT**: 17 scripted scenarios (`seed_uat_scenarios`) with recorded PASS/FAIL/BLOCKED history.
- **Backups & DR**: `backup_portal`, `verify_backup`, `restore_portal`, `dr_drill` (restores into a scratch database and verifies every row and proof file).
- **Training records and immutable sign-offs** (UAT, go/no-go, handover), each storing the readiness snapshot it was based on.
- **Security hardening**: see [`docs/security/security-audit.md`](./docs/security/security-audit.md).
- **Handover docs**: [`docs/`](./docs/README.md) (runbooks, user manuals for every role, training, UAT and pilot plans, data inventory, handover checklist).

---

## 🧪 Testing & Continuous Integration

The project includes an enterprise-grade automated test suite with **161 backend tests** and **163 frontend tests** (100% passing), statement coverage reporting across all Django apps, and a 5-stage GitHub Actions CI pipeline.

For in-depth details, architecture diagrams, and scenario matrices, see [**TESTING.md**](./TESTING.md).

### Quick Test Commands
```bash
# 1. Run the whole backend suite with verbose output
cd backend && pytest -v

# 2. Run with statement coverage report
cd backend && pytest --cov=apps --cov-report=term-missing

# 3. Run Ruff code quality & lint checks
cd backend && ruff check apps/ dora_backend/ tests/

# 4. Frontend lint, typecheck, unit tests and production build
cd frontend && npm run validate
```

### GitHub Actions CI Workflow
Automated CI is configured under [.github/workflows/ci.yml](./.github/workflows/ci.yml) and executes on every push and pull request:
- **Backend Tests Matrix**: Python 3.11 & 3.12 with SQLite + coverage upload
- **Code Quality**: Ruff linter, Django deployment check, and migration drift check
- **Seed Verification**: `seed_organogram` and `load_form_schema` run clean against a fresh database
- **Frontend Checks**: ESLint, TypeScript typecheck (`tsc --noEmit`), Vitest unit tests and Vite production bundling
- **PostgreSQL Integration**: Multi-service integration testing against PostgreSQL 16
- **Docker Verification**: Automated container build verification for backend and frontend

---

## 📁 Project Structure

```text
dora-ranking-portal/
├── backend/                             # Django 5.1 REST backend
│   ├── dora_backend/                    # Settings, CORS, JWT, URLs
│   ├── apps/
│   │   ├── accounts/                    # User model, JWT authentication & roles
│   │   ├── organogram/                  # 80 OrgUnits, Programmes & Nodal Officers
│   │   ├── data_requests/               # Requests, SHA-256 tokens, proof uploads
│   │   ├── submissions/                 # Form schemas, submissions, validation, audit, rollup & DCS
│   │   └── rankings/                    # NIRF datasets, scraper, 2nd-gen IITs
│   ├── tests/
│   │   ├── test_backend.py              # Organogram & Data Request tests
│   │   └── test_submissions.py          # NIRF Forms, validation & workflow tests (11 tests)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                            # React 19 SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── components/                  # Bento cards, OrgTree, modals
│   │   ├── views/                       # PublicLanding, RankingsView, Admin, Portal
│   │   ├── services/api.ts              # Axios client with JWT refresh
│   │   ├── routes.tsx                   # React Router v6 configuration
│   │   └── main.tsx                     # React Query & Toast providers
│   ├── nginx.conf                       # Production reverse-proxy config
│   ├── Dockerfile                       # Multi-stage Bun + Nginx container
│   └── package.json
├── scripts/
│   └── dev.sh                           # Unified local dev runner
├── docker-compose.yml                   # PostgreSQL + Django + React stack
└── package.json                         # Monorepo runner scripts
```

---
*Developed for IIT Mandi — Dean of Resource Generation & Alumni Affairs (DORA).*
