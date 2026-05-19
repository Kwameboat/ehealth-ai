#!/bin/bash
# Update Health Chat triage: max 5 follow-up questions then recommendations.
set -euo pipefail
HOME_DIR="${HOME:-/home/ehealtha}"
APP="${APP_SRC:-$HOME_DIR/ehealth-ai}"
BASE="https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main/backend"

curl -fsSL -o "$APP/backend/services/medicalChatPrompt.js" "$BASE/services/medicalChatPrompt.js"
curl -fsSL -o "$APP/backend/services/gemini.js" "$BASE/services/gemini.js"
echo "Published chat triage backend. Restart Node.js app in cPanel."
