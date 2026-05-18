#!/bin/bash
set -e
APP_DIR="${APP_DIR:-$HOME/ehealth-ai}"
NODE_ROOT="${NODE_ROOT:-$HOME/ehealth_ai}"
cd "$APP_DIR"

echo "==> eHealth AI server bootstrap in $APP_DIR"

# cPanel Node.js paths
for v in "$HOME"/nodevenv/*/bin/activate; do
  [ -f "$v" ] && . "$v" && break
done
for n in /opt/cpanel/ea-nodejs*/bin; do
  [ -x "$n/node" ] && export PATH="$n:$PATH" && break
done

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. In cPanel → Setup Node.js App → create app (root: ehealth-ai, startup: backend/server.js), then re-run bootstrap."
  exit 1
fi

echo "Node: $(node -v)"

# Use cPanel nodevenv when present
for bin in "$HOME/nodevenv/ehealth_ai"/*/bin "$HOME/nodevenv/ehealth-ai"/*/bin; do
  [ -d "$bin" ] && export PATH="$bin:$PATH" && break
done

npm install --omit=dev 2>/dev/null || npm install
cd backend && npm install --omit=dev 2>/dev/null || npm install
npm rebuild better-sqlite3 2>/dev/null || true
cd "$APP_DIR"

mkdir -p "$NODE_ROOT/backend/db" backend/db
if [ -d "$APP_DIR" ] && [ -d "$NODE_ROOT" ]; then
  rsync -a --exclude node_modules --exclude 'backend/db/*.db' "$APP_DIR/" "$NODE_ROOT/" 2>/dev/null || true
fi
chmod 755 backend/db "$NODE_ROOT/backend/db" 2>/dev/null || true

if [ ! -f backend/.env ]; then
  echo "WARNING: backend/.env missing — copy from backend/.env.example and add keys."
fi

echo "==> Bootstrap done. Restart Node.js app in cPanel."
