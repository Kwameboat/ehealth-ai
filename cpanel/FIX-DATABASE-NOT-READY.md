# Fix "Database not ready" in admin

## Cause

Missing **`backend/db/sql-wasm.wasm`** on the server (Terminal `DB OK` works if sql.js is in venv, but Passenger cannot find WASM).

## Fix (Terminal) — copy entire block

```bash
source /home/ehealtha/nodevenv/ehealth-ai/20/bin/activate
unset NODE_PATH
BASE=https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main
BACKEND=/home/ehealtha/ehealth-ai/backend

rm -f "$BACKEND/db/"*.lock "$BACKEND/db/"*.tmp
mkdir -p "$BACKEND/db"
chmod 755 "$BACKEND/db"

curl -fsSL -o "$BACKEND/db/sql-wasm.wasm" "$BASE/backend/db/sql-wasm.wasm"
curl -fsSL -o "$BACKEND/db/driver-sqljs.js" "$BASE/backend/db/driver-sqljs.js"
curl -fsSL -o "$BACKEND/db/ensureDb.js" "$BASE/backend/db/ensureDb.js"
curl -fsSL -o "$BACKEND/db/init.js" "$BASE/backend/db/init.js"
curl -fsSL -o "$BACKEND/server.js" "$BASE/backend/server.js"
curl -fsSL -o "$BACKEND/public/admin/app.js" "$BASE/backend/public/admin/app.js"
cp -f "$BACKEND/public/admin/app.js" ~/public_html/admin/app.js

ls -la "$BACKEND/db/sql-wasm.wasm"
cd "$BACKEND" && node -e "require('./db/ensureDb').ensureDbReady().then(() => console.log('DB OK')).catch(e => { console.error(e); process.exit(1); })"
```

Must show **`sql-wasm.wasm`** (~650 KB) and **`DB OK`**.

Then **cPanel → Node.js → RESTART** and hard-refresh admin (Ctrl+Shift+R).

## Verify

Open: https://www.ehealthaigh.com/api/health → `"db":true`

If `"db":false`, read the `error` and `wasm` fields in the JSON.
