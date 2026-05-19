# cPanel — install backend (no native SQLite / GLIBC)

The server cannot run `better-sqlite3` (GLIBC_2.29). The API uses **sql.js** (pure JavaScript).

```bash
source /home/ehealtha/nodevenv/ehealth-ai/20/bin/activate
unset NODE_PATH
rm -f /home/ehealtha/ehealth-ai/package-lock.json

TMP=$(mktemp -d)
cat > "$TMP/package.json" << 'EOF'
{
  "name": "medassistant-api",
  "private": true,
  "dependencies": {
    "bcryptjs": "2.4.3",
    "cors": "2.8.5",
    "dotenv": "16.4.7",
    "express": "4.21.2",
    "jsonwebtoken": "9.0.2",
    "sql.js": "1.12.0"
  }
}
EOF

cd "$TMP"
npm install --omit=dev --install-strategy=nested --no-audit
ls -la node_modules/express node_modules/bcryptjs node_modules/sql.js

rm -rf /home/ehealtha/ehealth-ai/backend/node_modules
mv "$TMP/node_modules" /home/ehealtha/ehealth-ai/backend/node_modules
rm -rf "$TMP"

cd /home/ehealtha/ehealth-ai/backend
unset NODE_PATH
node -e "require('./db/init').initDatabase().then(() => console.log('DB OK')).catch(e => { console.error(e); process.exit(1); })"
```

Then **RESTART** Node.js in cPanel → `/api/health` → `"db":true`.
