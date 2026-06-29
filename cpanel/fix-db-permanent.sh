#!/bin/bash
# Permanent DB fix — run once when admin shows 503 Database not ready.
# Usage: bash ~/ehealth-ai/cpanel/fix-db-permanent.sh
set -eo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
BACKEND="$APP/backend"
DATA="$APP/data"
DB="$DATA/medassistant.db"
BASE="https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main"

echo "=== eHealth AI — permanent DB fix ==="

mkdir -p "$DATA" "$BACKEND/db"
chmod 775 "$DATA" "$BACKEND/db" 2>/dev/null || true

# Remove stale locks / tmp from all known locations
rm -f "$DATA/"*.lock "$DATA/"*.tmp "$BACKEND/db/"*.lock "$BACKEND/db/"*.tmp 2>/dev/null || true
find "$DATA" "$BACKEND/db" -maxdepth 1 -name '.writetest-*' -delete 2>/dev/null || true
find "$DATA" "$BACKEND/db" -maxdepth 1 -name 'medassistant.db.corrupt-*.bak' -mtime +14 -delete 2>/dev/null || true

# Migrate DB from wrong paths into ~/ehealth-ai/data/
for legacy in "$BACKEND/db/medassistant.db" "$APP/backend/db/medassistant.db"; do
  if [ -f "$legacy" ] && [ "$legacy" != "$DB" ]; then
    if [ ! -f "$DB" ] || [ "$legacy" -nt "$DB" ]; then
      cp -f "$legacy" "$DB"
      echo "Copied $legacy -> $DB"
    fi
  fi
done

# shellcheck disable=SC1091
. "$APP/cpanel/activate-nodevenv.sh" 2>/dev/null || {
  for bin in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin; do
    [ -x "$bin/node" ] && export PATH="$bin:$PATH" && break
  done
}

export DATABASE_PATH="$DB"
export NODE_ENV=production

echo "DATABASE_PATH=$DATABASE_PATH"

curl -fsSL -o "$BACKEND/db/fileLock.js" "$BASE/backend/db/fileLock.js"
curl -fsSL -o "$BACKEND/db/driver-sqljs.js" "$BASE/backend/db/driver-sqljs.js"
curl -fsSL -o "$BACKEND/db/ensureDb.js" "$BASE/backend/db/ensureDb.js"
curl -fsSL -o "$BACKEND/db/resolveDbPath.js" "$BASE/backend/db/resolveDbPath.js"
curl -fsSL -o "$BACKEND/db/init.js" "$BASE/backend/db/init.js"
curl -fsSL -o "$BACKEND/server.js" "$BASE/backend/server.js"
curl -fsSL -o "$APP/server.js" "$BASE/server.js"

cd "$BACKEND"
node -e "
const fs = require('fs');
const path = require('path');
const dbPath = process.env.DATABASE_PATH;
const dir = path.dirname(dbPath);
fs.mkdirSync(dir, { recursive: true });
require('./db/ensureDb').startupDatabase(45000).then(() => {
  console.log('DB OK:', dbPath);
  console.log('Size:', fs.statSync(dbPath).size, 'bytes');
  process.exit(0);
}).catch(e => {
  console.error('DB FAIL:', e.message);
  process.exit(1);
});
"

touch "$HOME_DIR/public_html/tmp/restart.txt" 2>/dev/null || true

echo ""
echo "=== DONE ==="
echo "1. cPanel -> Node.js -> set DATABASE_PATH to: $DB"
echo "2. cPanel -> Node.js -> RESTART"
echo "3. Test: https://www.ehealthaigh.com/api/health?recover=1"
