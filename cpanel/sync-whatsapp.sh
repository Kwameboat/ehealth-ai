#!/bin/bash
# Sync compiled WhatsApp module + bridge from GitHub and ensure npm deps (axios, @google/genai).
# Usage: bash ~/ehealth-ai/cpanel/sync-whatsapp.sh
set -eo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
BACKEND="$APP/backend"
BASE="${GITHUB_RAW:-https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main}"

# shellcheck disable=SC1091
. "$APP/cpanel/activate-nodevenv.sh" 2>/dev/null || {
  for bin in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin; do
    [ -x "$bin/node" ] && export PATH="$bin:$PATH" && break
  done
}

echo "=== Sync WhatsApp module from GitHub ==="

mkdir -p "$BACKEND/whatsapp/dist/features" "$BACKEND/routes"

curl -fsSL -o "$BACKEND/routes/whatsapp-bridge.js" "$BASE/backend/routes/whatsapp-bridge.js"

DIST_FILES=(
  index.js processor.js adminRouter.js webhookRouter.js messageRouter.js
  scheduler.js buttonHandler.js sessionStore.js interactive.js intents.js
  config.js deps.js evolution.js gemini.js logs.js phone.js
)
for f in "${DIST_FILES[@]}"; do
  curl -fsSL -o "$BACKEND/whatsapp/dist/$f" "$BASE/backend/whatsapp/dist/$f"
done

for f in facilities.js family.js healthFeatures.js medication.js; do
  curl -fsSL -o "$BACKEND/whatsapp/dist/features/$f" "$BASE/backend/whatsapp/dist/features/$f"
done

echo "=== Ensure backend deps (axios, form-data, @google/genai) ==="
NEED_INSTALL=0
for pkg in axios form-data @google/genai; do
  if [ ! -f "$BACKEND/node_modules/$pkg/package.json" ]; then
    NEED_INSTALL=1
  fi
done
if [ "$NEED_INSTALL" = "1" ]; then
  bash "$APP/cpanel/install-backend-deps.sh"
else
  echo "Core npm deps present"
fi

# axios requires form-data at runtime — install if missing without full reinstall
if [ ! -f "$BACKEND/node_modules/form-data/package.json" ]; then
  echo "Installing form-data..."
  NPM_BIN="$(command -v npm)"
  (cd "$BACKEND" && "$NPM_BIN" install form-data@4 --omit=dev --no-audit --no-fund --no-package-lock) || true
fi

echo "=== Verify WhatsApp module loads ==="
cd "$BACKEND"
node -e "
try {
  require('form-data');
  require('axios');
  const m = require('./whatsapp/dist/index.js');
  if (typeof m.createWhatsAppRouters !== 'function') throw new Error('createWhatsAppRouters missing');
  console.log('WhatsApp module OK');
} catch (e) {
  console.error('WhatsApp module FAILED:', e.message);
  process.exit(1);
}
"

echo "SUCCESS — RESTART Node.js app in cPanel, then refresh /admin -> WhatsApp"
