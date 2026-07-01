#!/bin/bash
# Publish static PWA to public_html — API runs on Railway (no cPanel Node.js).
set -eo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
SRC="${APP_SRC:-$HOME_DIR/ehealth-ai}"
PUBLIC="${PUBLIC_HTML:-$HOME_DIR/public_html}"

echo "publish-static-pwa: SRC=$SRC PUBLIC=$PUBLIC"

if [ ! -d "$SRC/dist" ]; then
  echo "ERROR: $SRC/dist missing — run GitHub deploy first"
  exit 1
fi

find "$PUBLIC" -mindepth 1 -maxdepth 1 ! -name cgi-bin -exec rm -rf {} + 2>/dev/null || true
cp -r "$SRC/dist/"* "$PUBLIC/"

for f in manifest.json robots.txt sitemap.xml sw.js app-config.js icon-fonts.css; do
  [ -f "$SRC/public/$f" ] && cp -f "$SRC/public/$f" "$PUBLIC/" || true
done
[ -d "$SRC/public/icons" ] && cp -r "$SRC/public/icons" "$PUBLIC/" 2>/dev/null || true
[ -d "$SRC/public/fonts" ] && cp -r "$SRC/public/fonts" "$PUBLIC/" 2>/dev/null || true

mkdir -p "$PUBLIC/admin" "$PUBLIC/payment"
[ -d "$SRC/public/admin" ] && cp -r "$SRC/public/admin/"* "$PUBLIC/admin/" 2>/dev/null || \
  cp -r "$SRC/backend/public/admin/"* "$PUBLIC/admin/" 2>/dev/null || true
[ -d "$SRC/public/payment" ] && cp -r "$SRC/public/payment/"* "$PUBLIC/payment/" 2>/dev/null || \
  cp -r "$SRC/backend/public/payment/"* "$PUBLIC/payment/" 2>/dev/null || true

if [ -f "$PUBLIC/index.html" ] && ! grep -q 'app-config.js' "$PUBLIC/index.html"; then
  sed -i 's|</head>|<script src="/app-config.js"></script></head>|' "$PUBLIC/index.html" 2>/dev/null || \
    sed -i '' 's|</head>|<script src="/app-config.js"></script></head>|' "$PUBLIC/index.html" 2>/dev/null || true
fi

if [ -f "$SRC/public_html.htaccess" ]; then
  cp -f "$SRC/public_html.htaccess" "$PUBLIC/.htaccess"
  echo "Installed static .htaccess (no Passenger)"
elif [ -f "$SRC/public_html-static.htaccess" ]; then
  cp -f "$SRC/public_html-static.htaccess" "$PUBLIC/.htaccess"
fi

echo "Static PWA published to $PUBLIC ($(date -u))"
