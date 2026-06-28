#!/bin/bash
# === PASTE THIS ENTIRE BLOCK into cPanel Terminal ===
# Run AFTER uploading admin files via FTP (see FTP-PATHS.txt)

BACKEND="$HOME/ehealth-ai/backend"
PUBLIC="$HOME/public_html"

echo "========== STEP 0: Where are your files? =========="
for f in "$BACKEND/public/admin/whatsapp-admin.js" "$PUBLIC/admin/whatsapp-admin.js"; do
  if [ -f "$f" ]; then
    BYTES=$(wc -c < "$f" | tr -d ' ')
    HAS_PAIR=$(grep -c 'wa-pair-btn' "$f" 2>/dev/null || echo 0)
    echo "  $f  ($BYTES bytes, wa-pair-btn=$HAS_PAIR)"
  else
    echo "  MISSING: $f"
  fi
done

echo ""
echo "========== STEP 1: Copy backend -> public_html =========="
if grep -q 'wa-pair-btn' "$BACKEND/public/admin/whatsapp-admin.js" 2>/dev/null; then
  mkdir -p "$PUBLIC/admin"
  cp -fv "$BACKEND/public/admin/index.html" "$PUBLIC/admin/"
  cp -fv "$BACKEND/public/admin/whatsapp-admin.js" "$PUBLIC/admin/"
  cp -fv "$BACKEND/public/admin/styles.css" "$PUBLIC/admin/"
  cp -fv "$BACKEND/public/admin/app.js" "$PUBLIC/admin/"
  echo "Copied from backend to public_html"
elif grep -q 'wa-pair-btn' "$PUBLIC/admin/whatsapp-admin.js" 2>/dev/null; then
  echo "public_html already has new whatsapp-admin.js — skip copy"
else
  echo ""
  echo "!!! STOP: New files not found anywhere !!!"
  echo "Upload via FTP to:  $PUBLIC/admin/"
  echo "  - index.html"
  echo "  - whatsapp-admin.js  (must contain 'Get link code' button)"
  echo "  - styles.css"
  echo "  - app.js"
  echo ""
  echo "Also upload to:  $BACKEND/whatsapp/dist/"
  echo "  - adminRouter.js"
  echo "  - evolution.js"
  echo "  - phone.js"
  exit 1
fi

echo ""
echo "========== STEP 2: Verify live admin =========="
grep -q 'v=10' "$PUBLIC/admin/index.html" && echo "OK index.html v10" || echo "WARN: index.html still old version"
grep -q 'wa-pair-btn' "$PUBLIC/admin/whatsapp-admin.js" && echo "OK Get link code button" || echo "FAIL pairing UI"
LIVE_BYTES=$(wc -c < "$PUBLIC/admin/whatsapp-admin.js" | tr -d ' ')
echo "Live whatsapp-admin.js size: $LIVE_BYTES bytes (need ~28000+)"

echo ""
echo "========== STEP 3: Backend pair route =========="
if grep -q 'connection/pair' "$BACKEND/whatsapp/dist/adminRouter.js" 2>/dev/null; then
  echo "OK backend has /connection/pair"
else
  echo "FAIL: upload $BACKEND/whatsapp/dist/adminRouter.js"
fi

echo ""
echo "========== STEP 4: npm deps =========="
cd "$BACKEND" && npm install qrcode@1.5.4 axios@1.7.9 --omit=dev --no-audit 2>/dev/null || true

echo ""
echo "========== DONE =========="
echo "1. cPanel -> Node.js -> RESTART"
echo "2. Open admin, press Ctrl+Shift+R"
echo "3. WhatsApp page must show badge 'v3' and green 'Get link code' button"
echo "4. If still old UI, upload DIRECTLY to $PUBLIC/admin/ (not only backend folder)"
