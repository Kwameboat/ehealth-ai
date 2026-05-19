# Fix health check: `UNKNOWN: unknown error, write`

WASM is OK. The app **cannot write** to `backend/db/medassistant.db` (FTP/cPanel often makes that folder read-only).

## Fix (Terminal)

```bash
source /home/ehealtha/nodevenv/ehealth-ai/20/bin/activate
unset NODE_PATH
APP=/home/ehealtha/ehealth-ai
BACKEND=$APP/backend
BASE=https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main

mkdir -p "$APP/data"
chmod 775 "$APP/data"

# Move existing DB if any
[ -f "$BACKEND/db/medassistant.db" ] && cp -f "$BACKEND/db/medassistant.db" "$APP/data/medassistant.db"
chmod 664 "$APP/data/medassistant.db" 2>/dev/null || true

curl -fsSL -o "$BACKEND/db/resolveDbPath.js" "$BASE/backend/db/resolveDbPath.js"
curl -fsSL -o "$BACKEND/db/driver-sqljs.js" "$BASE/backend/db/driver-sqljs.js"
curl -fsSL -o "$BACKEND/db/ensureDb.js" "$BASE/backend/db/ensureDb.js"
curl -fsSL -o "$BACKEND/db/init.js" "$BASE/backend/db/init.js"
curl -fsSL -o "$BACKEND/server.js" "$BASE/backend/server.js"
curl -fsSL -o "$BACKEND/db/sql-wasm.wasm" "$BASE/backend/db/sql-wasm.wasm"

cd "$BACKEND"
node -e "const p=require('./db/init').DB_PATH; console.log('Using', p); require('./db/ensureDb').ensureDbReady().then(()=>console.log('DB OK')).catch(e=>{console.error(e);process.exit(1)})"
```

## cPanel environment variable

Change **DATABASE_PATH** to:

```
/home/ehealtha/ehealth-ai/data/medassistant.db
```

Save → **RESTART** Node.js app.

## Verify

https://www.ehealthaigh.com/api/health → `"db":true`

Admin dashboard should load data (0 users is OK on a new DB).
