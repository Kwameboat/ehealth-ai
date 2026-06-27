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

mkdir -p "$APP/cpanel" "$BACKEND/whatsapp/dist/features" "$BACKEND/routes" "$PUBLIC/admin" 2>/dev/null || true
PUBLIC="${PUBLIC_HTML:-$HOME_DIR/public_html}"

echo "=== Download sync script + bridge ==="
curl -fsSL -o "$APP/cpanel/sync-whatsapp.sh" "$BASE/cpanel/sync-whatsapp.sh"
curl -fsSL -o "$APP/cpanel/install-backend-deps.sh" "$BASE/cpanel/install-backend-deps.sh"
curl -fsSL -o "$APP/cpanel/backend-production.package.json" "$BASE/cpanel/backend-production.package.json"
chmod +x "$APP/cpanel/sync-whatsapp.sh" "$APP/cpanel/install-backend-deps.sh"

echo "=== Reinstall backend npm (fixes p-retry / @google/genai) ==="
bash "$APP/cpanel/install-backend-deps.sh"

echo "=== Sync WhatsApp dist + admin UI ==="
bash "$APP/cpanel/sync-whatsapp.sh"

curl -fsSL -o "$BACKEND/public/admin/whatsapp-admin.js" "$BASE/backend/public/admin/whatsapp-admin.js"
curl -fsSL -o "$BACKEND/public/admin/app.js" "$BASE/backend/public/admin/app.js"
mkdir -p "$PUBLIC/admin"
cp -f "$BACKEND/public/admin/whatsapp-admin.js" "$PUBLIC/admin/" 2>/dev/null || true
cp -f "$BACKEND/public/admin/app.js" "$PUBLIC/admin/" 2>/dev/null || true

echo ""
echo "=== DONE ==="
echo "1. cPanel -> Node.js -> RESTART"
echo "2. Open https://www.ehealthaigh.com/admin -> WhatsApp"
