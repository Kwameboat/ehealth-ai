#!/bin/bash
set -e
APP_DIR="${APP_DIR:-$HOME/ehealth-ai}"
cd "$APP_DIR"

echo "==> eHealth AI server bootstrap in $APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Enable Node.js in cPanel → Setup Node.js App first."
  exit 1
fi

echo "Node: $(node -v)"

npm install --omit=dev 2>/dev/null || npm install
cd backend && npm install --omit=dev 2>/dev/null || npm install
cd "$APP_DIR"

mkdir -p backend/db
chmod 755 backend/db 2>/dev/null || true

if [ ! -f backend/.env ]; then
  echo "WARNING: backend/.env missing — copy from backend/.env.example and add keys."
fi

echo "==> Bootstrap done. Restart Node.js app in cPanel."
