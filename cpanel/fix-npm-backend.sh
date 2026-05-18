#!/bin/bash
# Fix: npm installs to parent ehealth-ai/ instead of backend/ — run in cPanel Terminal
set -e
HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
VENV="$HOME_DIR/nodevenv/ehealth-ai/22"

source "$VENV/bin/activate"
export PATH="$VENV/bin:$PATH"

echo "=== Where is express? ==="
find "$APP" -maxdepth 3 -path "*/node_modules/express/package.json" 2>/dev/null || echo "express not found yet"

echo "=== Install into backend/ only (--prefix) ==="
"$VENV/bin/npm" install --prefix "$APP/backend" --omit=dev \
  express cors dotenv better-sqlite3 bcryptjs jsonwebtoken

if [ ! -f "$APP/backend/node_modules/express/package.json" ]; then
  if [ -f "$APP/node_modules/express/package.json" ]; then
    echo "Moving node_modules into backend/ ..."
    rm -rf "$APP/backend/node_modules"
    mv "$APP/node_modules" "$APP/backend/node_modules"
  else
    echo "FAILED: express not found after install"
    exit 1
  fi
fi

echo "=== Test ==="
cd "$APP/backend"
node -e "require('express'); require('better-sqlite3'); console.log('ALL OK');"

echo "=== Done — cPanel -> Node.js -> RESTART ==="
