#!/bin/bash
# Diagnose + fix LiteSpeed 503 when Node/Passenger is down (api/health returns HTML not JSON).
# Usage: curl -fsSL https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main/cpanel/fix-node-503.sh | bash
set -eo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
BACKEND="$APP/backend"
PUBLIC="$HOME_DIR/public_html"
BASE="https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main"

echo "=========================================="
echo " eHealth AI — FIX NODE 503 (API DOWN)"
echo "=========================================="

# --- 1. Node available? ---
# shellcheck disable=SC1091
. "$APP/cpanel/activate-nodevenv.sh" 2>/dev/null || {
  for bin in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin "$HOME_DIR/nodevenv/ehealth_ai"/*/bin; do
    [ -x "$bin/node" ] && export PATH="$bin:$PATH" && break
  done
}
if ! command -v node >/dev/null 2>&1; then
  echo "FAIL: node not found."
  echo "  -> cPanel -> Setup Node.js App -> create app (root: ehealth-ai, startup: server.js)"
  echo "  -> Run NPM Install, then RESTART"
  exit 1
fi
echo "OK node: $(node -v) at $(command -v node)"

# --- 2. Critical files ---
for f in "$APP/server.js" "$BACKEND/server.js"; do
  [ -f "$f" ] && echo "OK $f" || echo "MISSING $f"
done
[ -f "$BACKEND/server.js" ] || { echo "Upload backend/ or run deploy-live.sh first"; exit 1; }

# --- 3. Clear DB locks ---
mkdir -p "$APP/data" "$BACKEND/db" "$PUBLIC/tmp"
chmod 775 "$APP/data" 2>/dev/null || true
rm -f "$APP/data/"*.lock "$APP/data/"*.tmp "$BACKEND/db/"*.lock "$BACKEND/db/"*.tmp 2>/dev/null || true
echo "OK cleared lock/tmp files"

# --- 4. Sync latest backend from GitHub ---
echo ""
echo "=== Sync backend from GitHub ==="
curl -fsSL -o "$APP/cpanel/repair-production.sh" "$BASE/cpanel/repair-production.sh"
chmod +x "$APP/cpanel/repair-production.sh"
bash "$APP/cpanel/repair-production.sh" || echo "WARN: repair had errors — continue"

# --- 5. Passenger in .htaccess? ---
echo ""
echo "=== Check Passenger .htaccess ==="
if grep -q 'PASSENGER CONFIGURATION BEGIN' "$PUBLIC/.htaccess" 2>/dev/null; then
  echo "OK Passenger block found in public_html/.htaccess"
else
  echo "FAIL: Passenger missing — fixing..."
  curl -fsSL -o "$APP/cpanel/fix-api-404.sh" "$BASE/cpanel/fix-api-404.sh"
  chmod +x "$APP/cpanel/fix-api-404.sh"
  bash "$APP/cpanel/fix-api-404.sh"
fi

# --- 6. Try starting server manually (5s) — shows crash reason ---
echo ""
echo "=== Test server startup (5 second smoke test) ==="
cd "$BACKEND"
export DATABASE_PATH="${DATABASE_PATH:-$APP/data/medassistant.db}"
export NODE_ENV=production
timeout 5 node -e "
require('./db/ensureDb').ensureDbReady()
  .then(() => { console.log('DB OK'); process.exit(0); })
  .catch(e => { console.error('DB FAIL:', e.message); process.exit(1); });
" 2>&1 || true

timeout 8 node server.js 2>&1 &
SPID=$!
sleep 4
if kill -0 "$SPID" 2>/dev/null; then
  echo "OK server.js started (manual test — killed after 4s)"
  kill "$SPID" 2>/dev/null || true
else
  echo "FAIL: server.js crashed on startup — read error above"
  echo "Common fixes:"
  echo "  bash $APP/cpanel/install-backend-deps.sh"
  echo "  cPanel -> Node.js -> Run NPM Install -> RESTART"
fi

touch "$PUBLIC/tmp/restart.txt" 2>/dev/null || true

echo ""
echo "=========================================="
echo " MANUAL STEP (you MUST do this in cPanel):"
echo "   Setup Node.js App -> RESTART"
echo "   (or STOP then START)"
echo ""
echo " If RESTART is greyed out -> DESTROY app and"
echo " recreate per cpanel/FIX-VENV-ERROR.md"
echo ""
echo " Then test in browser:"
echo "   https://www.ehealthaigh.com/api/health"
echo " Must show JSON {\"status\":\"ok\"...}"
echo " NOT a big HTML 503 page"
echo "=========================================="
