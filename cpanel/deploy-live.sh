#!/bin/bash
# ONE COMMAND live deploy — pull latest from GitHub, repair backend, publish admin, verify.
# Usage (cPanel Terminal):
#   curl -fsSL https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main/cpanel/deploy-live.sh | bash
#
# After this: cPanel -> Node.js -> RESTART
# PWA: upload dist/ from your PC via FTP to ~/public_html/ (see deploy-bundle/dist/)
set -eo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
PUBLIC="$HOME_DIR/public_html"
BASE="https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main"

echo "=========================================="
echo " eHealth AI — deploy live from GitHub"
echo "=========================================="

mkdir -p "$APP/cpanel"
curl -fsSL -o "$APP/cpanel/repair-production.sh" "$BASE/cpanel/repair-production.sh"
curl -fsSL -o "$APP/cpanel/deploy-live.sh" "$BASE/cpanel/deploy-live.sh"
chmod +x "$APP/cpanel/repair-production.sh" "$APP/cpanel/deploy-live.sh" 2>/dev/null || true

bash "$APP/cpanel/repair-production.sh"

echo ""
echo "=== Health API routes ==="
for f in health.js consultations.js healthAssistant.js; do
  if [ -f "$APP/backend/routes/$f" ] || [ -f "$APP/backend/services/$f" ]; then
    echo "  OK $f"
  else
    echo "  MISSING $f"
  fi
done

echo ""
echo "=== Admin UI ==="
bash "$APP/cpanel/publish-admin.sh" 2>/dev/null || cp -f "$APP/backend/public/admin/"* "$PUBLIC/admin/" 2>/dev/null || true
grep -q 'wa-pair-btn' "$PUBLIC/admin/whatsapp-admin.js" 2>/dev/null && echo "  OK WhatsApp pairing UI" || echo "  WARN: old admin JS"
grep -q 'loadDoctors' "$PUBLIC/admin/app.js" 2>/dev/null && echo "  OK Doctor management" || echo "  WARN: old admin app.js"

echo ""
echo "=== PWA (dist) ==="
if [ -d "$APP/dist" ] && [ -f "$APP/dist/index.html" ]; then
  cp -rf "$APP/dist/"* "$PUBLIC/" 2>/dev/null || true
  echo "  Copied ehealth-ai/dist -> public_html"
elif [ -f "$PUBLIC/index.html" ]; then
  echo "  PWA already in public_html — upload fresh dist/ from PC if Health Services missing"
else
  echo "  Upload deploy-bundle/dist/ from PC to public_html via FTP"
fi

echo ""
echo "=========================================="
echo " DONE — RESTART Node.js in cPanel now"
echo " Test: curl -s https://www.ehealthaigh.com/api/health"
echo " Admin: Ctrl+Shift+R -> Doctors + WhatsApp v3"
echo " PWA:  Home -> Health Services quick action"
echo "=========================================="
