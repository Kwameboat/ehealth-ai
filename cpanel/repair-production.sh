#!/bin/bash
# One-shot repair — run after deploy or when admin shows 503 / db errors
# Usage: bash ~/ehealth-ai/cpanel/repair-production.sh
set -u

HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
BACKEND="$APP/backend"
PUBLIC="$HOME_DIR/public_html"
BASE=https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main

echo "=== eHealth AI production repair ==="

for v in "$HOME_DIR/nodevenv/ehealth-ai/20/bin/activate" \
         "$HOME_DIR/nodevenv/ehealth-ai/18/bin/activate"; do
  [ -f "$v" ] && . "$v" && break
done
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. Run: source ~/nodevenv/ehealth-ai/20/bin/activate"
  exit 1
fi
unset NODE_PATH

mkdir -p "$APP/data" "$BACKEND/db"
chmod 775 "$APP/data" 2>/dev/null || true
chmod 755 "$BACKEND/db" 2>/dev/null || true

echo "=== Syncing critical files from GitHub ==="
curl -fsSL -o "$BACKEND/db/driver-sqljs.js" "$BASE/backend/db/driver-sqljs.js"
curl -fsSL -o "$BACKEND/db/ensureDb.js" "$BASE/backend/db/ensureDb.js"
curl -fsSL -o "$BACKEND/db/resolveDbPath.js" "$BASE/backend/db/resolveDbPath.js"
curl -fsSL -o "$BACKEND/db/init.js" "$BASE/backend/db/init.js"
curl -fsSL -o "$BACKEND/server.js" "$BASE/backend/server.js"
curl -fsSL -o "$APP/server.js" "$BASE/server.js"
curl -fsSL -o "$BACKEND/db/sql-wasm.wasm" "$BASE/backend/db/sql-wasm.wasm"
curl -fsSL -o "$BACKEND/services/settings.js" "$BASE/backend/services/settings.js"
curl -fsSL -o "$BACKEND/services/geminiModels.js" "$BASE/backend/services/geminiModels.js"
curl -fsSL -o "$BACKEND/routes/auth.js" "$BASE/backend/routes/auth.js"
curl -fsSL -o "$PUBLIC/.htaccess" "$BASE/public_html.htaccess"
curl -fsSL -o "$APP/cpanel/repair-production.sh" "$BASE/cpanel/repair-production.sh"

[ -f "$BACKEND/db/medassistant.db" ] && [ ! -f "$APP/data/medassistant.db" ] && \
  cp -f "$BACKEND/db/medassistant.db" "$APP/data/medassistant.db" 2>/dev/null || true

rm -f "$APP/data/"*.lock "$APP/data/"*.tmp "$BACKEND/db/"*.lock "$BACKEND/db/"*.tmp 2>/dev/null || true

INDEX="$PUBLIC/index.html"
if [ -f "$INDEX" ] && ! grep -q 'app-config.js' "$INDEX"; then
  sed -i 's|</head>|<script src="/app-config.js"></script></head>|' "$INDEX" 2>/dev/null || true
fi
cp -f "$BACKEND/public/admin/"* "$PUBLIC/admin/" 2>/dev/null || true

if [ ! -d "$BACKEND/node_modules/express" ]; then
  echo "=== Installing backend dependencies ==="
  bash "$APP/cpanel/install-backend-deps.sh" || true
fi

echo "=== Database + model check ==="
cd "$BACKEND"
node -e "
require('./db/ensureDb').ensureDbReady().then(() => {
  const s = require('./services/settings');
  s.migrateLegacyGeminiModel();
  console.log('DB path:', require('./db/init').DB_PATH);
  console.log('Gemini model:', s.getGeminiModel());
  console.log('REPAIR OK');
}).catch(e => { console.error('REPAIR FAILED:', e.message); process.exit(1); });
"

echo ""
echo "=== Next steps ==="
echo "1. cPanel -> Node.js -> Environment:"
echo "   DATABASE_PATH=$APP/data/medassistant.db"
echo "   GEMINI_MODEL=gemini-2.5-flash"
echo "2. RESTART Node.js app"
echo "3. Test: https://www.ehealthaigh.com/api/health"
echo "4. Admin: https://www.ehealthaigh.com/admin"
