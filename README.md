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

## 🔐 Roles & Access Control

Access follows proposal §2.18 and is enforced by the API on every request; the UI only hides what a role cannot use.

| Role | Can see | Can change |
|---|---|---|
| **Admin / Data Officer** | Everything | Everything: dispatch, review/approve, correct, export, users |
| **Director (Leadership)** | Dashboards, analytics, briefing, exports, submission trails | Nothing (read-only) |
| **Auditor** | Proofs, audit log, submission trails, exports | Nothing (read-only) |
| **Nodal Officer** | Their own department's tasks and analytics | Their department's returns, via the emailed upload link |
| **Public** | Published rankings, trends, peer benchmarks, institute structure (no contacts) | — |

- Sign in with username **or** institutional email. Failed logins are throttled (`LOGIN_THROTTLE_RATE`).
- The DRF default is **deny**: an endpoint is public only if it declares `AllowAny`, and `tests/test_rbac_matrix.py` fails if any public view is not on its allowlist.
- A Django superuser is treated as Admin; `is_staff` alone grants nothing in the portal.
- Accounts are deactivated, never deleted, so audit entries keep their actor.

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
   python manage.py ensure_admin      # admin / admin123 in development; set DORA_ADMIN_PASSWORD otherwise
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
   - **Development Admin Account**: `admin` / `admin123` (created by `ensure_admin`; refused with `DJANGO_DEBUG=False`). Further accounts and roles: **Users & Roles** in the admin sidebar.

---

## 🐳 Docker Deployment

The repository includes a production-ready `docker-compose.yml` orchestrating PostgreSQL, Django DRF, and an Nginx reverse-proxied React SPA:

```bash
docker compose up --build -d
```

- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **REST API & Media Proxies**: Handled automatically via Nginx on `/api/` and `/media/`.

---

## 🔄 NIRF Ranking Data Refresh

Published NIRF results are cached as JSON under `backend/apps/rankings/data/`. No year is hardcoded: whichever cycles are on disk drive every dashboard, and the newest becomes the "latest" automatically.

- **Scheduled:** `python manage.py refresh_rankings` fetches any cycle NIRF has published since the last run. Cached years are never re-fetched; an unpublished cycle is reported as pending, not as a failure.
  - *Docker:* the `scheduler` service runs it daily (`REFRESH_INTERVAL_SECONDS`, default 86400), sharing the `rankings_data` volume with the backend.
  - *Bare metal:* `scripts/deploy.sh` installs a daily 06:30 cron entry (idempotent; existing crontab lines are kept). Set `DORA_SKIP_CRON=1` to skip.
- **On demand:** Admin and Director users see **Fetch NIRF results** on the Executive Dashboard and the trends page (`POST /api/v1/scraper/update/`), for when results are announced between scheduled runs.
- **Rewriting cached cycles** (e.g. after a scraper change): `python manage.py refresh_rankings --full`.

Fetches are serialised by a lock and written atomically, and every web worker sees a new file on its next read without a restart.

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
