#!/bin/bash
# Installs backend deps in an isolated temp dir (avoids parent Expo package-lock.json).
# Run in cPanel Terminal: bash ~/ehealth-ai/cpanel/install-backend-deps.sh
set -e
HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
BACKEND="$APP/backend"
PKG_SRC="$APP/cpanel/backend-production.package.json"

for v in "$HOME_DIR/nodevenv/ehealth-ai/20/bin/activate" \
         "$HOME_DIR/nodevenv/ehealth-ai/18/bin/activate"; do
  if [ -f "$v" ]; then
    # shellcheck disable=SC1090
    . "$v"
    break
  fi
done

export PATH="${VIRTUAL_ENV:+$VIRTUAL_ENV/bin:}$PATH"
unset NODE_PATH
NPM_BIN="$(command -v npm)"
NODE_BIN="$(command -v node)"

echo "node: $($NODE_BIN -v)"
echo "npm:  $($NPM_BIN -v)"

if [ ! -f "$PKG_SRC" ]; then
  PKG_SRC="$BACKEND/package.json"
fi
if ! grep -q '"express"' "$PKG_SRC" 2>/dev/null; then
  echo "ERROR: No valid backend package.json. Re-deploy from GitHub."
  exit 1
fi

rm -rf "$HOME_DIR/nodevenv/ehealth-ai/20/lib/node_modules/better-sqlite3" 2>/dev/null || true
rm -rf "$HOME_DIR/nodevenv/ehealth-ai/22/lib/node_modules/better-sqlite3" 2>/dev/null || true
rm -f "$APP/package-lock.json" 2>/dev/null || true

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp "$PKG_SRC" "$TMP/package.json"

echo "=== npm install (isolated, no parent lockfile) ==="
(cd "$TMP" && "$NPM_BIN" install --omit=dev)

if [ ! -f "$TMP/node_modules/express/package.json" ]; then
  echo "ERROR: express not installed"
  exit 1
fi
if [ ! -f "$TMP/node_modules/bcryptjs/package.json" ]; then
  echo "ERROR: bcryptjs not installed"
  exit 1
fi

echo "=== Installing into $BACKEND/node_modules ==="
rm -rf "$BACKEND/node_modules"
mkdir -p "$BACKEND"
mv "$TMP/node_modules" "$BACKEND/node_modules"
rm -rf "$TMP"
trap - EXIT

cd "$BACKEND"
export npm_config_build_from_source=true
echo "=== Rebuild better-sqlite3 for this server ==="
"$NPM_BIN" rebuild better-sqlite3 --build-from-source

NODE_FILE=$(find node_modules/better-sqlite3 -name better_sqlite3.node -type f 2>/dev/null | head -1)
if [ -z "$NODE_FILE" ]; then
  echo "ERROR: better_sqlite3.node missing — ask host to enable gcc/make"
  exit 1
fi
echo "SQLite: $NODE_FILE"

unset NODE_PATH
"$NODE_BIN" -e "require('./db/init').initDatabase(); console.log('DB OK');"

echo ""
echo "SUCCESS. cPanel -> Node.js -> RESTART"
echo "Test: https://www.ehealthaigh.com/api/health"
