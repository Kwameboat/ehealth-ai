#!/bin/bash
# One-shot WhatsApp fix when git is NOT available on cPanel (FTP/deploy only).
# Paste in cPanel Terminal:
#   curl -fsSL https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main/cpanel/fix-whatsapp-live.sh | bash
set -eo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
BACKEND="$APP/backend"
BASE="https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main"

echo "=== eHealth AI — WhatsApp live fix (no git required) ==="

# shellcheck disable=SC1091
if [ -f "$APP/cpanel/activate-nodevenv.sh" ]; then
  . "$APP/cpanel/activate-nodevenv.sh"
else
  curl -fsSL -o "$APP/cpanel/activate-nodevenv.sh" "$BASE/cpanel/activate-nodevenv.sh"
  chmod +x "$APP/cpanel/activate-nodevenv.sh"
  # shellcheck disable=SC1091
  . "$APP/cpanel/activate-nodevenv.sh"
fi

mkdir -p "$APP/cpanel" "$BACKEND/whatsapp/dist/features" "$BACKEND/routes"
PUBLIC="${PUBLIC_HTML:-$HOME_DIR/public_html}"
mkdir -p "$PUBLIC/admin" 2>/dev/null || true

echo "=== Download latest scripts from GitHub ==="
curl -fsSL -o "$APP/cpanel/sync-whatsapp.sh" "$BASE/cpanel/sync-whatsapp.sh"
curl -fsSL -o "$APP/cpanel/install-backend-deps.sh" "$BASE/cpanel/install-backend-deps.sh"
chmod +x "$APP/cpanel/sync-whatsapp.sh" "$APP/cpanel/install-backend-deps.sh"

echo "=== Step 1: Sync NEW WhatsApp dist (fetch-based gemini.js) ==="
bash "$APP/cpanel/sync-whatsapp.sh"

echo "=== Step 2: Reinstall backend npm ==="
bash "$APP/cpanel/install-backend-deps.sh"

echo "=== Step 3: Final WhatsApp verify ==="
cd "$BACKEND"
if grep -q '@google/genai' "$BACKEND/whatsapp/dist/gemini.js" 2>/dev/null; then
  echo "ERROR: gemini.js still old (has @google/genai). Re-downloading..."
  curl -fsSL -o "$BACKEND/whatsapp/dist/gemini.js" "$BASE/backend/whatsapp/dist/gemini.js"
fi
node -e "
const m = require('./whatsapp/dist/index.js');
if (typeof m.createWhatsAppRouters !== 'function') throw new Error('createWhatsAppRouters missing');
console.log('WhatsApp module OK');
"

curl -fsSL -o "$APP/cpanel/deploy-whatsapp-pairing.sh" "$BASE/cpanel/deploy-whatsapp-pairing.sh" 2>/dev/null || true
chmod +x "$APP/cpanel/deploy-whatsapp-pairing.sh" 2>/dev/null || true
bash "$APP/cpanel/deploy-whatsapp-pairing.sh" 2>/dev/null || {
  curl -fsSL -o "$BACKEND/public/admin/whatsapp-connect.js" "$BASE/backend/public/admin/whatsapp-connect.js" 2>/dev/null || \
    cp -f "$BACKEND/public/admin/whatsapp-admin.js" "$BACKEND/public/admin/whatsapp-connect.js" 2>/dev/null || true
  curl -fsSL -o "$BACKEND/public/admin/index.html" "$BASE/backend/public/admin/index.html" 2>/dev/null || true
  curl -fsSL -o "$BACKEND/public/admin/styles.css" "$BASE/backend/public/admin/styles.css" 2>/dev/null || true
  bash "$APP/cpanel/publish-admin.sh" 2>/dev/null || cp -f "$BACKEND/public/admin/"* "$PUBLIC/admin/" 2>/dev/null || true
}

echo ""
echo "=== DONE ==="
echo "1. cPanel -> Node.js -> RESTART"
echo "2. Open https://www.ehealthaigh.com/admin -> WhatsApp"
