#!/bin/bash
# One command live deploy — pull latest backend/admin from GitHub, publish PWA if dist/ exists, restart hint.
# Usage (cPanel Terminal):
#   curl -fsSL https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main/cpanel/deploy-live.sh | bash
#
# Upload dist/ via FTP first (run on PC: npm run build:web && npm run deploy:bundle, then upload deploy-bundle/dist → ~/ehealth-ai/dist)
set -eo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
PUBLIC="${PUBLIC_HTML:-$HOME_DIR/public_html}"
BASE="https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main"

echo "=== eHealth AI — LIVE DEPLOY ==="

mkdir -p "$APP/data" "$APP/backend/db" "$PUBLIC/tmp"
chmod 775 "$APP/data" 2>/dev/null || true
rm -f "$APP/data/"*.lock "$APP/data/"*.tmp "$APP/backend/db/"*.lock "$APP/backend/db/"*.tmp 2>/dev/null || true
find "$APP/data" "$APP/backend/db" -maxdepth 1 -name '.writetest-*' -delete 2>/dev/null || true
touch "$PUBLIC/tmp/restart.txt" 2>/dev/null || true
echo "Cleared DB lock files; triggered Passenger restart.txt"

curl -fsSL -o "$APP/cpanel/repair-production.sh" "$BASE/cpanel/repair-production.sh"
curl -fsSL -o "$APP/cpanel/deploy-live.sh" "$BASE/cpanel/deploy-live.sh"
chmod +x "$APP/cpanel/repair-production.sh" "$APP/cpanel/deploy-live.sh" 2>/dev/null || true

curl -fsSL -o "$APP/cpanel/db-watchdog.sh" "$BASE/cpanel/db-watchdog.sh"
curl -fsSL -o "$APP/cpanel/fix-db-permanent.sh" "$BASE/cpanel/fix-db-permanent.sh"
chmod +x "$APP/cpanel/db-watchdog.sh" "$APP/cpanel/fix-db-permanent.sh" 2>/dev/null || true

bash "$APP/cpanel/repair-production.sh"

echo ""
echo "=== Publish PWA (dist/) ==="
if [ -d "$APP/dist" ] && [ -f "$APP/dist/index.html" ]; then
  mkdir -p "$PUBLIC"
  cp -r "$APP/dist/"* "$PUBLIC/"
  if ! grep -q 'app-config.js' "$PUBLIC/index.html" 2>/dev/null; then
    sed -i 's|</head>|<script src="/app-config.js"></script></head>|' "$PUBLIC/index.html" 2>/dev/null || true
  fi
  cp -f "$APP/public/manifest.json" "$PUBLIC/" 2>/dev/null || true
  cp -f "$APP/public/robots.txt" "$PUBLIC/" 2>/dev/null || true
  cp -f "$APP/public/sitemap.xml" "$PUBLIC/" 2>/dev/null || true
  cp -f "$APP/public/sw.js" "$PUBLIC/" 2>/dev/null || true
  cp -r "$APP/public/icons" "$PUBLIC/" 2>/dev/null || true
  mkdir -p "$PUBLIC/fonts"
  cp -f "$APP/public/fonts/"*.ttf "$PUBLIC/fonts/" 2>/dev/null || true
  cp -f "$APP/dist/fonts/"*.ttf "$PUBLIC/fonts/" 2>/dev/null || true
  echo "PWA published from $APP/dist -> $PUBLIC"
else
  echo "WARN: No $APP/dist — upload from PC after: npm run build:web"
  echo "      FTP: deploy-bundle/dist/* -> ~/ehealth-ai/dist/"
fi

echo ""
echo "=== Restore Passenger .htaccess (required for /api) ==="
curl -fsSL -o "$APP/cpanel/merge-htaccess.sh" "$BASE/cpanel/merge-htaccess.sh"
chmod +x "$APP/cpanel/merge-htaccess.sh" 2>/dev/null || true
bash "$APP/cpanel/merge-htaccess.sh" || {
  echo "CRITICAL: merge-htaccess failed — API will 503 until fixed"
  curl -fsSL -o "$APP/cpanel/fix-api-404.sh" "$BASE/cpanel/fix-api-404.sh"
  chmod +x "$APP/cpanel/fix-api-404.sh"
  bash "$APP/cpanel/fix-api-404.sh" || true
}
touch "$PUBLIC/tmp/restart.txt" 2>/dev/null || true

echo ""
echo "=== Verify ==="
curl -s "https://www.ehealthaigh.com/api/health" | head -c 200 || true
echo ""
BC=$(curl -s -o /dev/null -w "%{http_code}" "https://www.ehealthaigh.com/admin/api/broadcasts" 2>/dev/null || echo "000")
if [ "$BC" = "401" ] || [ "$BC" = "200" ]; then
  echo "Admin broadcasts API: OK (HTTP $BC)"
elif [ "$BC" = "404" ]; then
  echo "Admin broadcasts API: 404 — run repair again or RESTART Node.js"
else
  echo "Admin broadcasts API: HTTP $BC"
fi
grep -q 'wa-pair-btn' "$PUBLIC/admin/whatsapp-admin.js" 2>/dev/null && echo "Admin WhatsApp UI: OK" || echo "Admin WhatsApp UI: check publish-admin"
grep -q 'HealthHub' "$PUBLIC/_expo/static/js/web/"*.js 2>/dev/null && echo "PWA Health Services: OK" || echo "PWA: upload dist/ then re-run this script"

echo ""
echo "=== Optional: cron watchdog (every 5 min) ==="
echo "  */5 * * * * bash ~/ehealth-ai/cpanel/db-watchdog.sh >> ~/ehealth-ai/data/watchdog.log 2>&1"
echo ""
echo "=== REQUIRED: cPanel -> Node.js -> RESTART ==="
echo "Then hard-refresh: Ctrl+Shift+R on admin and PWA"
