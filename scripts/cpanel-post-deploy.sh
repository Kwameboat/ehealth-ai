#!/bin/bash
# Run on server after FTP deploy — sync Node app root, merge .htaccess (keep Passenger), publish static files.
set -euo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
SRC="${APP_SRC:-$HOME_DIR/ehealth-ai}"
NODE_ROOT="${NODE_APP_ROOT:-$HOME_DIR/ehealth_ai}"
PUBLIC="${PUBLIC_HTML:-$HOME_DIR/public_html}"
HT_SRC="$SRC/public_html.htaccess"

echo "cpanel-post-deploy: SRC=$SRC NODE_ROOT=$NODE_ROOT"

# cPanel Node app may use ehealth_ai while FTP deploys to ehealth-ai — keep both in sync
if [ -d "$SRC" ]; then
  mkdir -p "$NODE_ROOT"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude node_modules \
      --exclude backend/node_modules \
      --exclude 'backend/db/*.db' \
      --exclude 'backend/db/*.db-*' \
      --exclude .git \
      "$SRC/" "$NODE_ROOT/"
  else
    find "$NODE_ROOT" -mindepth 1 -maxdepth 1 ! -name backend -exec rm -rf {} + 2>/dev/null || true
    cp -a "$SRC/." "$NODE_ROOT/"
  fi
  echo "Synced deploy -> $NODE_ROOT"
fi

# Publish PWA + admin static files
if [ -d "$SRC/dist" ]; then
  find "$PUBLIC" -mindepth 1 -maxdepth 1 ! -name cgi-bin -exec rm -rf {} + 2>/dev/null || true
  cp -r "$SRC/dist/"* "$PUBLIC/"
  cp -f "$SRC/public/manifest.json" "$PUBLIC/" 2>/dev/null || true
  cp -f "$SRC/public/sw.js" "$PUBLIC/" 2>/dev/null || true
  cp -r "$SRC/public/icons" "$PUBLIC/" 2>/dev/null || true
  mkdir -p "$PUBLIC/admin"
  cp -r "$SRC/backend/public/admin/"* "$PUBLIC/admin/" 2>/dev/null || true
  echo "Published PWA to $PUBLIC"
fi

# Merge .htaccess: NEVER drop CloudLinux Passenger block (required for /api and /admin/api)
merge_htaccess() {
  local dest="$PUBLIC/.htaccess"
  [ -f "$HT_SRC" ] || { echo "No htaccess source at $HT_SRC"; return 0; }

  local passblock=""
  if [ -f "$dest" ] && grep -q 'PASSENGER CONFIGURATION BEGIN' "$dest"; then
    passblock="$(sed -n '/PASSENGER CONFIGURATION BEGIN/,/PASSENGER CONFIGURATION END/p' "$dest")"
  fi

  {
    if [ -n "$passblock" ]; then
      printf '%s\n\n' "$passblock"
    fi
    cat "$HT_SRC"
  } > "$dest.tmp"
  mv "$dest.tmp" "$dest"

  if [ -n "$passblock" ]; then
    echo "Merged .htaccess (Passenger block preserved)"
  else
    echo "WARNING: No Passenger block in .htaccess — in cPanel open Setup Node.js App -> RESTART (injects Passenger into public_html)"
  fi
}
merge_htaccess

# npm in both roots (Passenger uses NODE_ROOT)
for dir in "$SRC" "$NODE_ROOT"; do
  if [ -f "$dir/package.json" ] && command -v npm >/dev/null 2>&1; then
    mkdir -p "$dir/backend/db"
    (cd "$dir" && npm install --omit=dev 2>/dev/null || npm install) || true
    if [ -f "$dir/backend/package.json" ]; then
      (cd "$dir/backend" && npm install --omit=dev 2>/dev/null || npm install) || true
    fi
  fi
done

# Touch Passenger restart (cPanel / Phusion)
mkdir -p "$PUBLIC/tmp" "$NODE_ROOT/tmp" 2>/dev/null || true
touch "$PUBLIC/tmp/restart.txt" "$NODE_ROOT/tmp/restart.txt" 2>/dev/null || true

echo "cpanel-post-deploy OK $(date -u)"
