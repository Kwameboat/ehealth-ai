#!/bin/bash
# Build better-sqlite3 for this server's glibc (run in cPanel Terminal)
set -e
source /home/ehealtha/nodevenv/ehealth-ai/20/bin/activate 2>/dev/null || \
  source /home/ehealtha/nodevenv/ehealth-ai/18/bin/activate

rm -rf /home/ehealtha/nodevenv/ehealth-ai/*/lib/node_modules/better-sqlite3 2>/dev/null || true

cd /home/ehealtha/ehealth-ai/backend
export npm_config_build_from_source=true
npm install better-sqlite3 --build-from-source

node -e "require('./db/init').initDatabase(); console.log('DB OK');"
echo "Restart Node.js app in cPanel."
