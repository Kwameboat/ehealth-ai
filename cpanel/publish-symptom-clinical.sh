#!/bin/bash
# Quick server update: symptom clinical formatting + Gemini system instruction (no full PWA required).
set -euo pipefail
HOME_DIR="${HOME:-/home/ehealtha}"
APP="${APP_SRC:-$HOME_DIR/ehealth-ai}"
BASE="https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main/backend"

mkdir -p "$APP/backend/services" "$APP/backend/routes"
curl -fsSL -o "$APP/backend/services/clinicalResponseFormat.js" "$BASE/services/clinicalResponseFormat.js"
curl -fsSL -o "$APP/backend/services/symptomClinicalPrompt.js" "$BASE/services/symptomClinicalPrompt.js"
curl -fsSL -o "$APP/backend/services/gemini.js" "$BASE/services/gemini.js"
curl -fsSL -o "$APP/backend/routes/ai.js" "$BASE/routes/ai.js"
echo "Published symptom clinical backend files. Restart Node.js app in cPanel."
