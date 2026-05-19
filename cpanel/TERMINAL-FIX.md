# cPanel — fix backend deps (copy entire block into Terminal)

Parent `~/ehealth-ai/package-lock.json` breaks `npm install` in `backend/` (only ~39 packages, no express/bcryptjs).

```bash
source /home/ehealtha/nodevenv/ehealth-ai/20/bin/activate
unset NODE_PATH
rm -f /home/ehealtha/ehealth-ai/package-lock.json
rm -rf /home/ehealtha/nodevenv/ehealth-ai/20/lib/node_modules/better-sqlite3
rm -rf /home/ehealtha/nodevenv/ehealth-ai/22/lib/node_modules/better-sqlite3

TMP=$(mktemp -d)
cat > "$TMP/package.json" << 'EOF'
{
  "name": "medassistant-api",
  "private": true,
  "dependencies": {
    "bcryptjs": "2.4.3",
    "better-sqlite3": "9.6.0",
    "cors": "2.8.5",
    "dotenv": "16.4.7",
    "express": "4.21.2",
    "jsonwebtoken": "9.0.2"
  }
}
EOF

cd "$TMP"
npm install --omit=dev
test -f node_modules/express/package.json
test -f node_modules/bcryptjs/package.json

rm -rf /home/ehealtha/ehealth-ai/backend/node_modules
mv "$TMP/node_modules" /home/ehealtha/ehealth-ai/backend/node_modules
rmdir "$TMP" 2>/dev/null || rm -rf "$TMP"

cd /home/ehealtha/ehealth-ai/backend
npm rebuild better-sqlite3 --build-from-source
find node_modules/better-sqlite3 -name better_sqlite3.node -type f
unset NODE_PATH
node -e "require('./db/init').initDatabase(); console.log('DB OK');"
```

Then **cPanel → Node.js → RESTART** → `https://www.ehealthaigh.com/api/health` must show `"db":true`.

After next GitHub deploy you can use: `bash ~/ehealth-ai/cpanel/install-backend-deps.sh`
