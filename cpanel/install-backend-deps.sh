#!/bin/bash
# Production npm install for cPanel — hoisted deps so @google/genai finds p-retry etc.
set -e
HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
BACKEND="$APP/backend"
PKG_SRC="$APP/cpanel/backend-production.package.json"

# shellcheck disable=SC1091
. "$APP/cpanel/activate-nodevenv.sh" 2>/dev/null || {
  for bin in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin; do
    [ -x "$bin/node" ] && export PATH="$bin:$PATH" && break
  done
}
NPM_BIN="$(command -v npm)"
NODE_BIN="$(command -v node)"

[ -f "$PKG_SRC" ] || PKG_SRC="$BACKEND/package.json"
rm -f "$APP/package-lock.json" "$BACKEND/package-lock.json" 2>/dev/null || true

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp "$PKG_SRC" "$TMP/package.json"

echo "=== npm install (production, hoisted) ==="
(cd "$TMP" && "$NPM_BIN" install --omit=dev --no-audit --no-fund)

REQUIRED=(express bcryptjs sql.js @google/genai p-retry google-auth-library protobufjs ws)
for pkg in "${REQUIRED[@]}"; do
  [ -f "$TMP/node_modules/$pkg/package.json" ] || { echo "ERROR: missing $pkg"; exit 1; }
done

rm -rf "$BACKEND/node_modules"
mv "$TMP/node_modules" "$BACKEND/node_modules"
trap - EXIT

cd "$BACKEND"
unset NODE_PATH

echo "=== Verify npm packages ==="
"$NODE_BIN" -e "
require('p-retry');
require('@google/genai');
console.log('genai deps OK');
"

if [ -f "$BACKEND/whatsapp/dist/index.js" ]; then
  "$NODE_BIN" -e "
require('./whatsapp/dist/index.js');
console.log('WhatsApp module OK');
"
fi

"$NODE_BIN" -e "require('./db/init').initDatabase().then(() => console.log('DB OK')).catch(e => { console.error(e); process.exit(1); })"

echo "SUCCESS — RESTART Node.js app in cPanel"
