#!/usr/bin/env bash
set -e

# IIT Mandi DORA Ranking Portal — Production Deployment Script
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=========================================================="
echo " Deploying IIT Mandi DORA Ranking Portal (React + Django)"
echo "=========================================================="

# 1. Backend Pre-flight & Migrations
echo "[1/4] Preparing Backend..."
cd "$ROOT_DIR/backend"
if [ ! -d "venv" ]; then
  python3 -m venv venv
  ./venv/bin/pip install --upgrade pip
  ./venv/bin/pip install -r requirements.txt
fi

echo "Running Django migrations..."
./venv/bin/python manage.py migrate --noinput

echo "Seeding Organogram & Nodal Officers..."
./venv/bin/python manage.py seed_organogram

echo "Collecting Django static files..."
./venv/bin/python manage.py collectstatic --noinput

# 2. Frontend Build
echo "[2/4] Building Frontend Production Assets..."
cd "$ROOT_DIR/frontend"
bun install --frozen-lockfile || bun install
bun run build

# 3. Deployment Topology
echo "[3/4] Validating Production Deployment Configuration..."
cd "$ROOT_DIR"

if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
  echo "Docker and Docker Compose detected."
  echo "You can deploy full containerized stack via: docker compose up --build -d"
else
  echo "Docker not detected in current shell. Ready for bare-metal / systemd deployment."
fi

# 4. Starting Production Services
echo "[4/4] Starting Production Services..."
echo "Starting Gunicorn WSGI server on 0.0.0.0:8000..."
cd "$ROOT_DIR/backend"
./venv/bin/gunicorn dora_backend.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 4 \
  --timeout 120 \
  --daemon

echo "Starting Frontend Production Web Server on port 3000..."
cd "$ROOT_DIR/frontend"
bun run preview -- --host 0.0.0.0 --port 3000 &
FRONTEND_PID=$!

echo "=========================================================="
echo " Deployment Successful!"
echo " Frontend App:  http://localhost:3000"
echo " Backend API:   http://localhost:8000/api/"
echo " Admin Portal:  http://localhost:8000/admin/"
echo "=========================================================="
