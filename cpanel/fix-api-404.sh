#!/bin/bash
# Restore /api/* routing (Passenger was removed from .htaccess).
# Usage: bash ~/ehealth-ai/cpanel/fix-api-404.sh
set -u

HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
PUBLIC="$HOME_DIR/public_html"

echo "=== Fix API 404 (restore Passenger in .htaccess) ==="

for v in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin/activate; do
  [ -f "$v" ] && . "$v" && break
done

if [ ! -f "$APP/public_html.htaccess" ]; then
  curl -fsSL -o "$APP/public_html.htaccess" \
    https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main/public_html.htaccess
fi

chmod +x "$APP/cpanel/merge-htaccess.sh" 2>/dev/null || true
bash "$APP/cpanel/merge-htaccess.sh" || exit 1

touch "$PUBLIC/tmp/restart.txt" 2>/dev/null || true

echo ""
echo "=== REQUIRED: cPanel -> Setup Node.js App -> RESTART ==="
echo "Then open: https://www.ehealthaigh.com/api/health"
echo "(Must show JSON, not LiteSpeed 404 HTML)"
