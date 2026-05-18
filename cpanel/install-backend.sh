#!/bin/bash
# Run in cPanel Terminal — installs API dependencies (fixes 503)
set -e
cd /home/ehealtha/ehealth-ai/backend

if ! grep -q '"express"' package.json 2>/dev/null; then
  echo "ERROR: backend/package.json is wrong or missing. Re-deploy from GitHub first."
  exit 1
fi

for v in /home/ehealtha/nodevenv/ehealth-ai/20/bin/activate \
         /home/ehealtha/nodevenv/ehealth-ai/18/bin/activate; do
  [ -f "$v" ] && . "$v" && break
done
unset NODE_PATH

echo "Installing API dependencies..."
# Root Expo package-lock.json breaks backend npm (only ~39 packages, no express/bcryptjs)
rm -f ../package-lock.json 2>/dev/null || true
rm -rf node_modules package-lock.json 2>/dev/null || true
npm install --omit=dev \
  express@4.21.2 cors@2.8.5 dotenv@16.4.7 bcryptjs@2.4.3 jsonwebtoken@9.0.2 better-sqlite3@9.6.0
export npm_config_build_from_source=true
npm rebuild better-sqlite3 --build-from-source
test -d node_modules/express || { echo "ERROR: express not installed"; exit 1; }
npm rebuild better-sqlite3

echo "Testing modules..."
node -e "require('express'); require('better-sqlite3'); require('./db/init').initDatabase(); console.log('OK');"

echo "Done. Now cPanel -> Node.js app -> RESTART"
