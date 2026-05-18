#!/bin/bash
# Full backend dependencies + better-sqlite3 built on this server (cPanel Terminal)
set -e
HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
BACKEND="$APP/backend"

for v in "$HOME_DIR/nodevenv/ehealth-ai/20/bin/activate" \
         "$HOME_DIR/nodevenv/ehealth-ai/18/bin/activate" \
         "$HOME_DIR/nodevenv/ehealth_ai/20/bin/activate"; do
  if [ -f "$v" ]; then
    # shellcheck disable=SC1090
    . "$v"
    break
  fi
done

export PATH="${VIRTUAL_ENV:+$VIRTUAL_ENV/bin:}$PATH"
unset NODE_PATH

if [ ! -f "$BACKEND/package.json" ]; then
  echo "ERROR: $BACKEND/package.json missing — deploy app first"
  exit 1
fi

NPM_BIN="$(command -v npm)"
NODE_BIN="$(command -v node)"
echo "Using node: $NODE_BIN ($($NODE_BIN -v))"

rm -rf "$HOME_DIR/nodevenv/ehealth-ai/20/lib/node_modules/better-sqlite3" 2>/dev/null || true
rm -rf "$HOME_DIR/nodevenv/ehealth-ai/22/lib/node_modules/better-sqlite3" 2>/dev/null || true

cd "$BACKEND"

# Parent Expo lockfile makes "npm install" in backend install almost nothing (39 packages, no express)
rm -f "$APP/package-lock.json" 2>/dev/null || true
rm -rf node_modules
rm -f package-lock.json 2>/dev/null || true

"$NPM_BIN" install --omit=dev \
  express@4.21.2 cors@2.8.5 dotenv@16.4.7 bcryptjs@2.4.3 jsonwebtoken@9.0.2 better-sqlite3@9.6.0

if [ ! -f node_modules/express/package.json ]; then
  if [ -f "$APP/node_modules/express/package.json" ]; then
    echo "Hoisted to parent — moving node_modules into backend/"
    rm -rf node_modules
    mv "$APP/node_modules" node_modules
  else
    echo "ERROR: express missing after npm install"
    exit 1
  fi
fi

export npm_config_build_from_source=true
"$NPM_BIN" rebuild better-sqlite3 --build-from-source

for pkg in express bcryptjs better-sqlite3; do
  if [ ! -d "node_modules/$pkg" ]; then
    echo "ERROR: node_modules/$pkg missing"
    exit 1
  fi
done

NODE_FILE=$(find node_modules/better-sqlite3 -name better_sqlite3.node -type f | head -1)
if [ -z "$NODE_FILE" ]; then
  echo "ERROR: better_sqlite3.node not built — ask host for gcc/make or try Node 18"
  exit 1
fi
echo "SQLite binary: $NODE_FILE"

unset NODE_PATH
"$NODE_BIN" -e "require('./db/init').initDatabase(); console.log('DB OK');"

echo "Done. cPanel -> Node.js -> RESTART, then open /api/health"
