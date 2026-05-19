# cPanel Terminal — full fix (copy entire block)

cPanel npm installs into the **venv**, not `/tmp`. Use `--prefix` and download new **sql.js** code from GitHub.

```bash
source /home/ehealtha/nodevenv/ehealth-ai/20/bin/activate
unset NODE_PATH

APP=/home/ehealtha/ehealth-ai
BACKEND=$APP/backend
BASE=https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main

# 1) Update backend code (sql.js — no better-sqlite3)
curl -fsSL -o "$BACKEND/db/driver-sqljs.js" "$BASE/backend/db/driver-sqljs.js"
curl -fsSL -o "$BACKEND/db/init.js" "$BASE/backend/db/init.js"
curl -fsSL -o "$BACKEND/server.js" "$BASE/backend/server.js"

grep -q driver-sqljs "$BACKEND/db/init.js" && echo "OK: new init.js" || echo "FAIL: init.js not updated"

# 2) Install packages INTO backend/node_modules (not /tmp, not venv-only)
rm -f "$APP/package-lock.json"
rm -rf "$BACKEND/node_modules"

npm install --prefix "$BACKEND" --omit=dev --install-strategy=nested --no-audit \
  express@4.21.2 bcryptjs@2.4.3 cors@2.8.5 dotenv@16.4.7 jsonwebtoken@9.0.2 sql.js@1.12.0

# If still empty, copy from venv (minus broken better-sqlite3)
if [ ! -d "$BACKEND/node_modules/express" ]; then
  echo "Fallback: copy venv node_modules into backend..."
  mkdir -p "$BACKEND/node_modules"
  rsync -a "$HOME/nodevenv/ehealth-ai/20/lib/node_modules/" "$BACKEND/node_modules/" 2>/dev/null || \
    cp -a "$HOME/nodevenv/ehealth-ai/20/lib/node_modules/." "$BACKEND/node_modules/"
  rm -rf "$BACKEND/node_modules/better-sqlite3"
  npm install --prefix "$BACKEND" --omit=dev sql.js@1.12.0 --no-audit
fi

ls "$BACKEND/node_modules/express" "$BACKEND/node_modules/bcryptjs" "$BACKEND/node_modules/sql.js"

# 3) Test database
cd "$BACKEND"
unset NODE_PATH
node -e "require('./db/init').initDatabase().then(() => console.log('DB OK')).catch(e => { console.error(e); process.exit(1); })"
```

Then **cPanel → Node.js → RESTART** → https://www.ehealthaigh.com/api/health → `"db":true`
