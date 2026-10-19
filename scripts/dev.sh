#!/usr/bin/env bash
set -e

# IIT Mandi DORA Portal - Unified Development Server
# Spawns Django REST backend (port 8000) and Vite React SPA (port 5173)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=========================================================="
echo " Starting IIT Mandi DORA Ranking Portal (React + Django) "
echo "=========================================================="

cleanup() {
  echo ""
  echo "Shutting down development servers..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Start Django Backend
echo "Starting Django REST backend on http://127.0.0.1:8000..."
cd "$ROOT_DIR/backend"
if [ ! -d "venv" ]; then
  echo "Virtualenv not found. Please setup backend/venv first."
  exit 1
fi
./venv/bin/python manage.py runserver 127.0.0.1:8000 &
BACKEND_PID=$!

# Wait briefly for backend to initialize
sleep 2

# 2. Start React Vite Frontend
echo "Starting React Vite frontend on http://localhost:5173..."
cd "$ROOT_DIR/frontend"
bun run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

echo "=========================================================="
echo " Django REST API: http://127.0.0.1:8000/api/"
echo " React Frontend:  http://localhost:5173/"
echo " Press Ctrl+C to stop both servers."
echo "=========================================================="

wait
