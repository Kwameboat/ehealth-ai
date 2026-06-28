#!/bin/bash
# Production npm install for cPanel — explicit packages, no @google/genai (WhatsApp uses fetch).
set -e
HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
BACKEND="$APP/backend"

# shellcheck disable=SC1091
. "$APP/cpanel/activate-nodevenv.sh" 2>/dev/null || {
  for bin in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin; do
    [ -x "$bin/node" ] && export PATH="$bin:$PATH" && break
  done
}
NPM_BIN="$(command -v npm)"
NODE_BIN="$(command -v node)"

echo "=== npm install (explicit production packages) ==="
cd "$BACKEND"
rm -rf node_modules package-lock.json 2>/dev/null || true

"$NPM_BIN" install --omit=dev --no-audit --no-fund --no-package-lock \
  express@4.21.2 \
  bcryptjs@2.4.3 \
  sql.js@1.12.0 \
  cors@2.8.5 \
  dotenv@16.4.7 \
  jsonwebtoken@9.0.2 \
  qrcode@1.5.4 \
  axios@1.7.9

unset NODE_PATH

echo "=== Verify core packages ==="
"$NODE_BIN" -e "
require('express');
require('bcryptjs');
require('sql.js');
require('jsonwebtoken');
console.log('core deps OK');
"

"$NODE_BIN" -e "require('./db/init').initDatabase().then(() => console.log('DB OK')).catch(e => { console.error(e); process.exit(1); })"

echo "SUCCESS — RESTART Node.js app in cPanel"
