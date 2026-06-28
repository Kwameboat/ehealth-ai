#!/bin/bash
# Publish admin UI (including WhatsApp link code) to public_html — fixes stale cached JS.
# Usage: bash ~/ehealth-ai/cpanel/publish-admin.sh
set -eo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
BACKEND="$HOME_DIR/ehealth-ai/backend"
PUBLIC="${PUBLIC_HTML:-$HOME_DIR/public_html}"

if [ ! -d "$BACKEND/public/admin" ]; then
  echo "ERROR: missing $BACKEND/public/admin"
  exit 1
fi

mkdir -p "$PUBLIC/admin"
cp -f "$BACKEND/public/admin/"* "$PUBLIC/admin/" 2>/dev/null || true

echo "Published admin UI -> $PUBLIC/admin"
for f in index.html whatsapp-admin.js whatsapp-connect.js styles.css app.js; do
  if [ -f "$PUBLIC/admin/$f" ]; then
    echo "  OK $f ($(wc -c < "$PUBLIC/admin/$f" | tr -d ' ') bytes)"
  else
    echo "  MISSING $f — copy from $BACKEND/public/admin/"
  fi
done
echo "RESTART Node.js in cPanel, then hard-refresh admin (Ctrl+Shift+R)"
