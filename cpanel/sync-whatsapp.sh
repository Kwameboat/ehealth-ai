#!/bin/bash
# Verify WhatsApp module + npm deps. Does NOT overwrite dist/ — git deploy ships backend/.
# Usage: bash ~/ehealth-ai/cpanel/sync-whatsapp.sh
set -eo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
BACKEND="$APP/backend"

# shellcheck disable=SC1091
. "$APP/cpanel/activate-nodevenv.sh" 2>/dev/null || {
  for bin in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin; do
    [ -x "$bin/node" ] && export PATH="$bin:$PATH" && break
  done
}

echo "=== Verify WhatsApp module (no file overwrite — use git deploy) ==="

if [ ! -f "$BACKEND/whatsapp/dist/index.js" ]; then
  echo "ERROR: $BACKEND/whatsapp/dist/index.js missing — run GitHub deploy or upload backend/"
  exit 1
fi

if grep -q '@google/genai' "$BACKEND/whatsapp/dist/gemini.js" 2>/dev/null; then
  echo "ERROR: whatsapp/dist/gemini.js still uses @google/genai SDK — redeploy from latest main"
  exit 1
fi

if grep -q "await fetch" "$BACKEND/whatsapp/dist/gemini.js" 2>/dev/null; then
  echo "WARN: whatsapp gemini.js still uses fetch — redeploy from latest main for Passenger stability"
fi

echo "=== Ensure backend deps ==="
if [ ! -f "$BACKEND/node_modules/express/package.json" ]; then
  bash "$APP/cpanel/install-backend-deps.sh"
else
  cd "$BACKEND"
  node -e "require('qrcode'); require('./whatsapp/dist/index.js');" 2>/dev/null || {
    echo "Installing missing deps (qrcode, axios)…"
    npm install --omit=dev --no-audit --no-fund qrcode@1.5.4 axios@1.7.9 2>/dev/null || bash "$APP/cpanel/install-backend-deps.sh"
  }
fi

echo "=== Verify WhatsApp module loads ==="
cd "$BACKEND"
node -e "
try {
  const bridge = require('./routes/whatsapp-bridge.js');
  if (!bridge.webhookRouter) throw new Error('webhookRouter missing');
  console.log('WhatsApp bridge OK (lazy load)');
} catch (e) {
  console.error('WhatsApp module FAILED:', e.message);
  process.exit(1);
}
"

echo "SUCCESS — RESTART Node.js app in cPanel if you changed backend files"
