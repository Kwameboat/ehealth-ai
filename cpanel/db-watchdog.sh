#!/bin/bash
# Cron-friendly DB probe — triggers auto-recovery if health fails.
# Install (cPanel Cron, every 5 min):
#   */5 * * * * bash ~/ehealth-ai/cpanel/db-watchdog.sh >> ~/ehealth-ai/data/watchdog.log 2>&1
set -eo pipefail

URL="${EHEALTH_HEALTH_URL:-https://www.ehealthaigh.com/api/health?recover=1}"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

BODY="$(curl -sf --max-time 25 "$URL" 2>/dev/null || true)"
if echo "$BODY" | grep -q '"db":true'; then
  echo "$TS OK"
  exit 0
fi

echo "$TS FAIL — attempting repair"
HOME_DIR="${HOME:-/home/ehealtha}"
APP="$HOME_DIR/ehealth-ai"
if [ -x "$APP/cpanel/repair-production.sh" ]; then
  bash "$APP/cpanel/repair-production.sh" >> "$HOME_DIR/ehealth-ai/data/watchdog.log" 2>&1 || true
fi
touch "${HOME_DIR}/public_html/tmp/restart.txt" 2>/dev/null || true
echo "$TS repair triggered — RESTART Node.js if still failing"
