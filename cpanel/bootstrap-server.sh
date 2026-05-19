#!/bin/bash
# One-shot cPanel fix — run: bash ~/ehealth-ai/cpanel/bootstrap-server.sh
set -e
source /home/ehealtha/nodevenv/ehealth-ai/20/bin/activate
unset NODE_PATH

APP=/home/ehealtha/ehealth-ai
BACKEND=$APP/backend
BASE=https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main

echo "=== Clear stale DB locks ==="
rm -f "$BACKEND/db/"*.lock "$BACKEND/db/"*.tmp 2>/dev/null || true

echo "=== Download sql.js backend files ==="
mkdir -p "$BACKEND/db"
curl -fsSL -o "$BACKEND/db/driver-sqljs.js" "$BASE/backend/db/driver-sqljs.js"
curl -fsSL -o "$BACKEND/db/ensureDb.js" "$BASE/backend/db/ensureDb.js"
curl -fsSL -o "$BACKEND/db/init.js" "$BASE/backend/db/init.js"
curl -fsSL -o "$BACKEND/server.js" "$BASE/backend/server.js"
curl -fsSL -o "$BACKEND/public/admin/app.js" "$BASE/backend/public/admin/app.js"
curl -fsSL -o "$BACKEND/db/sql-wasm.wasm" "$BASE/backend/db/sql-wasm.wasm"
chmod 755 "$BACKEND/db" 2>/dev/null || true
chmod 644 "$BACKEND/db/sql-wasm.wasm" 2>/dev/null || true
grep -q driver-sqljs "$BACKEND/db/init.js"

echo "=== Install deps into $BACKEND/node_modules ==="
rm -f "$APP/package-lock.json"
rm -rf "$BACKEND/node_modules"

npm install --prefix "$BACKEND" --omit=dev --install-strategy=nested --no-audit \
  express@4.21.2 bcryptjs@2.4.3 cors@2.8.5 dotenv@16.4.7 jsonwebtoken@9.0.2 sql.js@1.12.0 || true

if [ ! -d "$BACKEND/node_modules/express" ]; then
  echo "=== Fallback: sync from venv (remove better-sqlite3) ==="
  mkdir -p "$BACKEND/node_modules"
  VNM="$HOME/nodevenv/ehealth-ai/20/lib/node_modules"
  rsync -a "$VNM/" "$BACKEND/node_modules/" || cp -a "$VNM/." "$BACKEND/node_modules/"
  rm -rf "$BACKEND/node_modules/better-sqlite3"
  npm install --prefix "$BACKEND" --omit=dev sql.js@1.12.0 --no-audit
fi

for pkg in express bcryptjs sql.js; do
  [ -d "$BACKEND/node_modules/$pkg" ] || { echo "ERROR: missing $pkg"; exit 1; }
done

echo "=== DB test ==="
cd "$BACKEND"
unset NODE_PATH
node -e "require('./db/init').initDatabase().then(() => console.log('DB OK')).catch(e => { console.error(e); process.exit(1); })"

echo "=== Done — RESTART Node.js in cPanel ==="
