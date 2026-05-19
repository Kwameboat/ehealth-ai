# Fix admin panel 503 (Points Shop / API)

## Cause

sql.js + multiple Passenger workers can conflict when writing the SQLite file.

## Fix on server (Terminal)

```bash
source /home/ehealtha/nodevenv/ehealth-ai/20/bin/activate
unset NODE_PATH
BASE=https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main
BACKEND=/home/ehealtha/ehealth-ai/backend

curl -fsSL -o "$BACKEND/db/driver-sqljs.js" "$BASE/backend/db/driver-sqljs.js"
curl -fsSL -o "$BACKEND/db/init.js" "$BASE/backend/db/init.js"
curl -fsSL -o "$BACKEND/server.js" "$BASE/backend/server.js"
curl -fsSL -o "$BACKEND/db/sql-wasm.wasm" "$BASE/backend/db/sql-wasm.wasm" 2>/dev/null || \
  cp -f "$(dirname $(dirname $(node -e "console.log(require.resolve('sql.js/package.json'))")))/dist/sql-wasm.wasm" "$BACKEND/db/sql-wasm.wasm"

node -e "require('./db/init').initDatabase().then(() => console.log('DB OK')).catch(e => { console.error(e); process.exit(1); })"
```

Then **cPanel → Node.js → RESTART**.

## cPanel (recommended)

In Node.js app settings, if available set **max application instances / workers to 1** for this app.

## Test

- https://www.ehealthaigh.com/api/health → `"db":true`
- Admin → Points Shop → should load (no 503)
