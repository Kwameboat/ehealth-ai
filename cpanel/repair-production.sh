#!/bin/bash
# One-shot repair — DB + backend files. NEVER overwrites Passenger .htaccess.
# Usage: bash ~/ehealth-ai/cpanel/repair-production.sh
set -eo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
BACKEND="$APP/backend"
PUBLIC="$HOME_DIR/public_html"
BASE=https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main

echo "=== eHealth AI production repair ==="

# shellcheck disable=SC1091
. "$APP/cpanel/activate-nodevenv.sh" 2>/dev/null || {
  for bin in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin; do
    [ -x "$bin/node" ] && export PATH="$bin:$PATH" && break
  done
}

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. Check cPanel Node.js app root is ehealth-ai, then RESTART."
  exit 1
fi
echo "Using node: $(command -v node)"

mkdir -p "$APP/data" "$BACKEND/db"
chmod 775 "$APP/data" 2>/dev/null || true

echo "=== Syncing critical backend files from GitHub ==="
curl -fsSL -o "$BACKEND/db/driver-sqljs.js" "$BASE/backend/db/driver-sqljs.js"
curl -fsSL -o "$BACKEND/db/ensureDb.js" "$BASE/backend/db/ensureDb.js"
curl -fsSL -o "$BACKEND/db/resolveDbPath.js" "$BASE/backend/db/resolveDbPath.js"
curl -fsSL -o "$BACKEND/db/init.js" "$BASE/backend/db/init.js"
curl -fsSL -o "$BACKEND/server.js" "$BASE/backend/server.js"
curl -fsSL -o "$APP/server.js" "$BASE/server.js"
curl -fsSL -o "$BACKEND/db/sql-wasm.wasm" "$BASE/backend/db/sql-wasm.wasm"
curl -fsSL -o "$BACKEND/services/settings.js" "$BASE/backend/services/settings.js"
curl -fsSL -o "$BACKEND/services/geminiModels.js" "$BASE/backend/services/geminiModels.js"
curl -fsSL -o "$BACKEND/services/gemini.js" "$BASE/backend/services/gemini.js"
curl -fsSL -o "$BACKEND/services/medicalChatPrompt.js" "$BASE/backend/services/medicalChatPrompt.js"
curl -fsSL -o "$BACKEND/services/clinicalResponseFormat.js" "$BASE/backend/services/clinicalResponseFormat.js"
curl -fsSL -o "$BACKEND/services/symptomClinicalPrompt.js" "$BASE/backend/services/symptomClinicalPrompt.js"
curl -fsSL -o "$BACKEND/routes/ai.js" "$BASE/backend/routes/ai.js"
curl -fsSL -o "$BACKEND/routes/user.js" "$BASE/backend/routes/user.js"
curl -fsSL -o "$BACKEND/routes/emergency.js" "$BASE/backend/routes/emergency.js"
curl -fsSL -o "$BACKEND/routes/admin.js" "$BASE/backend/routes/admin.js"
curl -fsSL -o "$BACKEND/routes/whatsapp-bridge.js" "$BASE/backend/routes/whatsapp-bridge.js"
curl -fsSL -o "$BACKEND/services/nearbyPlaces.js" "$BASE/backend/services/nearbyPlaces.js"
curl -fsSL -o "$BACKEND/routes/payments.js" "$BASE/backend/routes/payments.js"
curl -fsSL -o "$BACKEND/services/payments.js" "$BASE/backend/services/payments.js"
curl -fsSL -o "$BACKEND/services/paystack.js" "$BASE/backend/services/paystack.js"
curl -fsSL -o "$BACKEND/public/payment/callback.html" "$BASE/backend/public/payment/callback.html"
curl -fsSL -o "$APP/public_html.htaccess" "$BASE/public_html.htaccess"
curl -fsSL -o "$APP/cpanel/activate-nodevenv.sh" "$BASE/cpanel/activate-nodevenv.sh"
curl -fsSL -o "$APP/cpanel/merge-htaccess.sh" "$BASE/cpanel/merge-htaccess.sh"
curl -fsSL -o "$APP/cpanel/fix-api-404.sh" "$BASE/cpanel/fix-api-404.sh"
curl -fsSL -o "$APP/cpanel/publish-icon-fonts.sh" "$BASE/cpanel/publish-icon-fonts.sh"
curl -fsSL -o "$APP/scripts/copy-icon-fonts.mjs" "$BASE/scripts/copy-icon-fonts.mjs"
chmod +x "$APP/cpanel/activate-nodevenv.sh" "$APP/cpanel/merge-htaccess.sh" "$APP/cpanel/fix-api-404.sh" "$APP/cpanel/publish-icon-fonts.sh" 2>/dev/null || true

if ! grep -q 'PASSENGER CONFIGURATION BEGIN' "$PUBLIC/.htaccess" 2>/dev/null; then
  echo "=== Passenger missing — fixing .htaccess ==="
  bash "$APP/cpanel/fix-api-404.sh" || true
else
  bash "$APP/cpanel/merge-htaccess.sh" 2>/dev/null || true
fi

[ -f "$BACKEND/db/medassistant.db" ] && [ ! -f "$APP/data/medassistant.db" ] && \
  cp -f "$BACKEND/db/medassistant.db" "$APP/data/medassistant.db" 2>/dev/null || true

rm -f "$APP/data/"*.lock "$APP/data/"*.tmp "$BACKEND/db/"*.lock "$BACKEND/db/"*.tmp 2>/dev/null || true

INDEX="$PUBLIC/index.html"
if [ -f "$INDEX" ] && ! grep -q 'app-config.js' "$INDEX"; then
  sed -i 's|</head>|<script src="/app-config.js"></script></head>|' "$INDEX" 2>/dev/null || true
fi
cp -f "$BACKEND/public/admin/"* "$PUBLIC/admin/" 2>/dev/null || true

echo "=== Icon fonts (dashboard UI) ==="
bash "$APP/cpanel/publish-icon-fonts.sh" || echo "WARN: icon fonts — run: bash ~/ehealth-ai/cpanel/publish-icon-fonts.sh"

if [ ! -d "$BACKEND/node_modules/express" ] || [ ! -f "$BACKEND/node_modules/p-retry/package.json" ]; then
  echo "=== Installing backend dependencies ==="
  bash "$APP/cpanel/install-backend-deps.sh" || true
fi

echo "=== WhatsApp module ==="
mkdir -p "$APP/cpanel"
if [ ! -x "$APP/cpanel/sync-whatsapp.sh" ]; then
  curl -fsSL -o "$APP/cpanel/sync-whatsapp.sh" "$BASE/cpanel/sync-whatsapp.sh" || true
  chmod +x "$APP/cpanel/sync-whatsapp.sh" 2>/dev/null || true
fi
chmod +x "$APP/cpanel/sync-whatsapp.sh" 2>/dev/null || true
bash "$APP/cpanel/sync-whatsapp.sh" || echo "WARN: WhatsApp sync failed — run: curl -fsSL $BASE/cpanel/fix-whatsapp-live.sh | bash"

echo "=== Database check ==="
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
echo "=== REQUIRED ==="
echo "cPanel -> Node.js -> RESTART"
echo "Test: https://www.ehealthaigh.com/api/health (JSON, not 404 HTML)"
