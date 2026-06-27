#!/bin/bash
# Isolated install — sql.js only (no better-sqlite3 / GLIBC)
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
rm -f "$APP/package-lock.json" 2>/dev/null || true

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp "$PKG_SRC" "$TMP/package.json"

echo "=== npm install (isolated) ==="
(cd "$TMP" && "$NPM_BIN" install --omit=dev --install-strategy=nested --no-audit)

for pkg in express bcryptjs sql.js @google/genai; do
  [ -f "$TMP/node_modules/$pkg/package.json" ] || { echo "ERROR: missing $pkg"; exit 1; }
done

rm -rf "$BACKEND/node_modules"
mv "$TMP/node_modules" "$BACKEND/node_modules"
trap - EXIT

cd "$BACKEND"
unset NODE_PATH
"$NODE_BIN" -e "require('@google/genai'); console.log('npm deps OK')"
"$NODE_BIN" -e "require('./db/init').initDatabase().then(() => console.log('DB OK')).catch(e => { console.error(e); process.exit(1); })"

echo "SUCCESS — RESTART Node.js app in cPanel"
