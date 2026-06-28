#!/bin/bash
# Deploy phone link-code UI + backend WITHOUT pulling old files from GitHub.
# Run after FTP upload of latest backend/ folder:
#   bash ~/ehealth-ai/cpanel/deploy-whatsapp-pairing.sh
set -eo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
BACKEND="$HOME_DIR/ehealth-ai/backend"
PUBLIC="${PUBLIC_HTML:-$HOME_DIR/public_html}"

# shellcheck disable=SC1091
. "$HOME_DIR/ehealth-ai/cpanel/activate-nodevenv.sh" 2>/dev/null || true

echo "=== Deploy WhatsApp phone pairing (local files) ==="

if [ ! -f "$BACKEND/whatsapp/dist/adminRouter.js" ]; then
  echo "ERROR: missing $BACKEND/whatsapp/dist/adminRouter.js — upload backend folder first"
  exit 1
fi
if ! grep -q 'connection/pair' "$BACKEND/whatsapp/dist/adminRouter.js"; then
  echo "ERROR: adminRouter.js has no /connection/pair route — upload latest whatsapp/dist"
  exit 1
fi
if ! grep -q 'wa-pair-btn' "$BACKEND/public/admin/whatsapp-admin.js"; then
  echo "ERROR: whatsapp-admin.js missing Get link code button — upload latest public/admin files"
  exit 1
fi

mkdir -p "$PUBLIC/admin" "$HOME_DIR/ehealth-ai/data"
chmod 775 "$HOME_DIR/ehealth-ai/data" 2>/dev/null || true
rm -f "$HOME_DIR/ehealth-ai/data/"*.lock "$HOME_DIR/ehealth-ai/data/"*.tmp 2>/dev/null || true

echo "=== Publish admin UI to public_html ==="
cp -f "$BACKEND/public/admin/index.html" "$PUBLIC/admin/"
cp -f "$BACKEND/public/admin/whatsapp-admin.js" "$PUBLIC/admin/"
cp -f "$BACKEND/public/admin/whatsapp-connect.js" "$PUBLIC/admin/" 2>/dev/null || true
cp -f "$BACKEND/public/admin/styles.css" "$PUBLIC/admin/"
cp -f "$BACKEND/public/admin/app.js" "$PUBLIC/admin/" 2>/dev/null || true

echo "=== npm deps (qrcode) ==="
cd "$BACKEND"
npm install qrcode@1.5.4 axios@1.7.9 --omit=dev --no-audit 2>/dev/null || true

echo "=== Verify WhatsApp module ==="
node -e "
const m = require('./whatsapp/dist/index.js');
if (typeof m.createWhatsAppRouters !== 'function') throw new Error('createWhatsAppRouters missing');
const fs = require('fs');
const router = fs.readFileSync('./whatsapp/dist/adminRouter.js','utf8');
if (!router.includes('connection/pair')) throw new Error('pair route missing in dist');
console.log('WhatsApp pairing module OK');
"

echo ""
echo "=== VERIFY in browser ==="
echo "1. cPanel -> Node.js -> RESTART"
echo "2. Open Admin -> WhatsApp — panel title should show badge 'v3'"
echo "3. You should see green button 'Get link code'"
echo "4. Test: https://www.ehealthaigh.com/api/health?recover=1"
