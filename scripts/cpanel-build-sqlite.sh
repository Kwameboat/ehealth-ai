#!/bin/bash
# Build better-sqlite3 for this server's glibc (run in cPanel Terminal)
set -e
source /home/ehealtha/nodevenv/ehealth-ai/20/bin/activate 2>/dev/null || \
  source /home/ehealtha/nodevenv/ehealth-ai/18/bin/activate

rm -rf /home/ehealtha/nodevenv/ehealth-ai/*/lib/node_modules/better-sqlite3 2>/dev/null || true

cd /home/ehealtha/ehealth-ai/backend
unset NODE_PATH
export npm_config_build_from_source=true
rm -rf node_modules/better-sqlite3
npm install better-sqlite3@9.6.0 --build-from-source

NODE_FILE=$(find node_modules/better-sqlite3 -name better_sqlite3.node -type f | head -1)
if [ -z "$NODE_FILE" ]; then
  echo "ERROR: better_sqlite3.node not built — ask host to enable gcc/python for native modules"
  exit 1
fi
echo "Built: $NODE_FILE"

unset NODE_PATH
node -e "require('./db/init').initDatabase(); console.log('DB OK');"
echo "Restart Node.js app in cPanel."
