#!/bin/bash
# Test API on the server (run in cPanel Terminal after npm install)
set -e
source /home/ehealtha/nodevenv/ehealth-ai/22/bin/activate
cd /home/ehealtha/ehealth-ai

export NODE_ENV=production
export PORT=3999
export APP_API_SECRET="${APP_API_SECRET:-test}"
export JWT_SECRET="${JWT_SECRET:-test-jwt}"
export DATABASE_PATH=/home/ehealtha/ehealth-ai/backend/db/medassistant.db
export WEB_DIST_PATH=/home/ehealtha/ehealth-ai/dist
export ALLOWED_ORIGINS=https://www.ehealthaigh.com

if [ -d node_modules ] && [ ! -d backend/node_modules ]; then
  mv node_modules backend/node_modules
fi

node server.js &
PID=$!
sleep 2
curl -s "http://127.0.0.1:3999/api/health" || true
kill $PID 2>/dev/null || true
echo ""
echo "If you saw JSON above, the app works — RESTART in cPanel Node.js app."
