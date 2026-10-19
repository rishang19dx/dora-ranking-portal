# Automated Ranking Portal (ARP) - IIT Mandi

The **Automated Ranking Portal (ARP)** is a centralized platform designed to streamline the collection, management, verification, and visualization of institutional ranking data (NIRF, QS, THE) at IIT Mandi.

The system is architected as a decoupled monorepo featuring a **React 19 Single Page Application (SPA)** with Bento 2.0 aesthetics and an enterprise-grade **Django 5.1 REST Framework** backend.

---

## ✨ Key Features

- **Interactive Institute Organogram**: The complete academic, administrative, and functional hierarchy of IIT Mandi (57 organizational units) rendered as a searchable, filterable, selectable tree with data custodianship mappings.
- **Targeted Data Requests**: A three-step composer that selects organogram sections, maps required metrics per section, and dispatches templated notification requests.
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

The repository includes a production-ready `docker-compose.yml` orchestrating PostgreSQL, Django DRF, and an Nginx reverse-proxied React SPA:

```bash
docker compose up --build -d
```

- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **REST API & Media Proxies**: Handled automatically via Nginx on `/api/` and `/media/`.

---

## 🧪 Testing

Run the unified monorepo test suite (Django backend tests + React production build):

```bash
bun run test # or: npm run test
```

Or test each service individually:
```bash
# Backend pytest suite (4/4 passing)
cd backend && ./venv/bin/pytest tests/ -v

# Frontend TypeScript check and production build
cd frontend && bun run build
```

---

## 📁 Project Structure

```text
dora-ranking-portal/
├── backend/                             # Django 5.1 REST backend
│   ├── dora_backend/                    # Settings, CORS, JWT, URLs
│   ├── apps/
│   │   ├── accounts/                    # User model & JWT authentication
│   │   ├── organogram/                  # 57 OrgUnits & Nodal Officers
│   │   ├── data_requests/               # Requests, SHA-256 tokens, uploads
│   │   └── rankings/                    # NIRF datasets, scraper, 2nd-gen IITs
│   ├── tests/
│   │   └── test_backend.py              # Automated backend test suite
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
