#!/bin/bash
# Fix: npm installs to parent ehealth-ai/ instead of backend/ — run in cPanel Terminal
set -e
HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
VENV="$HOME_DIR/nodevenv/ehealth-ai/20"
[ -f "$VENV/bin/activate" ] || VENV="$HOME_DIR/nodevenv/ehealth-ai/18"

source "$VENV/bin/activate"
export PATH="$VENV/bin:$PATH"

echo "=== Where is express? ==="
find "$APP" -maxdepth 3 -path "*/node_modules/express/package.json" 2>/dev/null || echo "express not found yet"

echo "=== Install all backend deps ==="
unset NODE_PATH
cd "$APP/backend"
"$VENV/bin/npm" install --omit=dev
export npm_config_build_from_source=true
"$VENV/bin/npm" rebuild better-sqlite3 --build-from-source

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
