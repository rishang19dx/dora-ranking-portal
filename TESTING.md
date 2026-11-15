# DORA Ranking Portal — Testing & CI Guide

## Overview

This document provides a comprehensive guide to testing and Continuous Integration (CI) for the **DORA Ranking Portal** (`phase-2/nirf-ranking-ui`).

The test suite covers:
1. **Unit Tests**: Models, utility functions, data transformations, authentication token claims, and business logic.
2. **Integration Tests**: Database interactions, API endpoints, file uploads, status lifecycles, and relational constraints.
3. **Migration & Schema Tests**: Schema consistency, table existence, string primary keys, unique constraints, and referential integrity.
4. **Edge Cases & Negative Tests**: Authentication failures, invalid file formats, upload size limit enforcement, out-of-scope permissions, expired/revoked links, and invalid parameter bounds.

---

## 1. Environment Setup & Prerequisites

### Prerequisites
- Python ≥ 3.11
- Node.js ≥ 20 (or Bun)
- SQLite3 (default test database)
- PostgreSQL 16 (optional, used in CI for PostgreSQL integration testing)

### Installation

```bash
# 1. Clone & navigate to repo
cd dora-ranking-portal

# 2. Setup backend virtual environment
cd backend
python -m venv venv

# On Linux/macOS:
source venv/bin/activate
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# Install all backend dependencies (including testing & linting tools)
pip install -r requirements.txt
cd ..

# 3. Setup frontend dependencies
cd frontend
npm install # or: bun install
cd ..
```

---

## 2. Test Environment Configuration

The backend is configured to use **SQLite** in-memory/file testing by default when `DATABASE_URL` is omitted. This allows rapid local test execution without spinning up external database containers.

For PostgreSQL integration testing, provide `DATABASE_URL`:
```bash
export DATABASE_URL="postgresql://dora:dora_test_pass@localhost:5432/dora_test"
export DJANGO_SECRET_KEY="ci-test-secret-key-not-for-production"
export DJANGO_DEBUG="True"
```

---

## 3. Running Database Migrations in Test Environment

Apply migrations and seed initial data:

```bash
cd backend

# Check for any unapplied migrations
python manage.py makemigrations --check --dry-run

# Run migrations against active database (SQLite or PostgreSQL)
python manage.py migrate --no-input

# Optionally seed the 57 institutional organogram units and nodal officers
python manage.py seed_organogram
```

---

## 4. Running Automated Tests

All tests are discovered and run via `pytest` from the `backend/` directory.

### A. Run Entire Test Suite (116 Tests)
```bash
cd backend
pytest
```

### B. Run Unit Tests Only
```bash
cd backend
# Account models and JWT claims
pytest tests/test_accounts.py -v

# Organogram models and serializers
pytest tests/test_organogram.py -v

# Scraper functions and canonical name resolution
pytest tests/test_rankings.py -k "TestCleanInstituteName or TestCanonicalIITName or TestGetFallbackInnovationData" -v
```

### C. Run Integration & Workflow Tests
```bash
cd backend
# Request dispatch, token generation, and file uploads
pytest tests/test_data_requests.py -v

# End-to-end integration flows
pytest tests/test_backend.py -v

# Rankings REST API views with cache invalidation
pytest tests/test_rankings.py -k "TestRankingsAPI" -v
```

### D. Run Migration & Schema Verification Tests
```bash
cd backend
pytest tests/test_migrations.py -v
```

---

## 5. Generating Coverage Reports

Coverage is measured across all internal apps (`apps.accounts`, `apps.organogram`, `apps.data_requests`, `apps.rankings`) using `pytest-cov` and configured via `backend/.coveragerc`.

### Terminal Summary with Missing Lines
```bash
cd backend
pytest --cov=apps --cov-report=term-missing
```

### Export XML Report (for CI / SonarQube)
```bash
cd backend
pytest --cov=apps --cov-report=xml:coverage.xml
```

### Export Interactive HTML Report
```bash
cd backend
pytest --cov=apps --cov-report=html
# View report:
open htmlcov/index.html  # On macOS
start htmlcov/index.html # On Windows
```

### Current Test Coverage Results
- **Overall Statement Coverage:** **88%**
- `apps.accounts`: **100%**
- `apps.data_requests.models`: **99%**
- `apps.data_requests.serializers`: **100%**
- `apps.data_requests.services`: **98%**
- `apps.data_requests.views`: **98%**
- `apps.organogram`: **~95%**
- `apps.rankings.views`: **89%**

---

## 6. Code Style, Linting & Type Checking

### Backend (Ruff & Django Check)
```bash
cd backend

# Lint with Ruff (configured via ruff.toml)
ruff check apps/ dora_backend/ tests/

# Format check with Ruff
ruff format --check apps/ dora_backend/ tests/

# Django system deployment check
python manage.py check
```

### Frontend (TypeScript & Vite Build)
```bash
cd frontend

# Run TypeScript compiler checks and Vite production bundling
npm run build # executes: tsc && vite build
```

---

## 7. Continuous Integration (CI) Pipeline

The repository uses **GitHub Actions** via [`.github/workflows/ci.yml`](file:///.github/workflows/ci.yml).

### Workflow Triggers
- **Push** to `main`, `phase-2/**`, `feature/**`
- **Pull Request** targeting `main`, `phase-2/**`

### Pipeline Stages & Jobs

```mermaid
flowchart TD
    A[Push / Pull Request] --> B[backend-tests\nPython 3.11, 3.12 matrix\nSQLite + pytest + coverage]
    A --> C[backend-lint\nRuff check + Django check\nmakemigrations check]
    A --> D[frontend-build\nNode 20 + npm ci\ntsc + vite build]
    A --> E[backend-integration-postgres\nPostgreSQL 16 service\nFull test suite against Postgres]
    B --> F[docker-build\nBuild backend & frontend\nDocker images on push]
    D --> F
```

1. **`backend-tests`**: Runs on Python 3.11 and 3.12 matrix against Ubuntu runner with SQLite. Executes 116 tests with coverage reporting and uploads `coverage.xml`.
2. **`backend-lint`**: Checks Python code style with Ruff, runs `python manage.py check`, and ensures no migration drift exists (`makemigrations --check --dry-run`).
3. **`frontend-build`**: Installs dependencies with `npm ci`, runs TypeScript type checking (`tsc`), builds production assets (`vite build`), and uploads the `dist/` artifact.
4. **`backend-integration-postgres`**: Boots a dedicated PostgreSQL 16 container, runs migrations, executes the full test suite against real PostgreSQL, and verifies dialect compatibility. (Triggered on `main` pushes and PRs targeting `main`).
5. **`docker-build`**: Verifies that both backend (`Dockerfile`) and frontend (`Dockerfile` + Nginx) build cleanly with Docker Buildx. (Triggered on pushes).

---

## 8. Pull Request Merge Requirements

Before merging any Pull Request into `phase-2/nirf-ranking-ui` or `main`, the following automated checks **must pass**:

- [x] All 116 backend tests pass with 0 failures or errors.
- [x] Test coverage remains at or above 85%.
- [x] Ruff lint checks pass without errors (`ruff check apps/ dora_backend/ tests/`).
- [x] No uncommitted migration drift exists (`makemigrations --check --dry-run`).
- [x] Django system check passes (`python manage.py check`).
- [x] Frontend builds cleanly without TypeScript compiler errors (`npm run build`).
- [x] PostgreSQL integration test job passes (for PRs targeting `main`).

