#!/bin/bash
# Run in cPanel Terminal — installs API dependencies (fixes 503)
set -e
cd /home/ehealtha/ehealth-ai/backend

if ! grep -q '"express"' package.json 2>/dev/null; then
  echo "ERROR: backend/package.json is wrong or missing. Re-deploy from GitHub first."
  exit 1
fi

source /home/ehealtha/nodevenv/ehealth-ai/22/bin/activate

echo "Installing API dependencies..."
rm -rf node_modules
npm install --omit=dev
npm rebuild better-sqlite3

echo "Testing modules..."
node -e "require('express'); require('better-sqlite3'); require('./db/init').initDatabase(); console.log('OK');"

echo "Done. Now cPanel -> Node.js app -> RESTART"
