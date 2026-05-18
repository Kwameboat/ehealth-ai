#!/bin/bash
# Run on server after FTP deploy — sync Node app root, merge .htaccess (keep Passenger), publish static files.
set -euo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
SRC="${APP_SRC:-$HOME_DIR/ehealth-ai}"
NODE_ROOT="${NODE_APP_ROOT:-$HOME_DIR/ehealth_ai}"
PUBLIC="${PUBLIC_HTML:-$HOME_DIR/public_html}"
HT_SRC="$SRC/public_html.htaccess"

# cPanel nodevenv + npm (required for better-sqlite3 on server)
for v in "$HOME_DIR/nodevenv/ehealth_ai"/*/bin/activate "$HOME_DIR/nodevenv/ehealth-ai"/*/bin/activate; do
  if [ -f "$v" ]; then
    # shellcheck disable=SC1090
    . "$v"
    break
  fi
done
for n in /opt/cpanel/ea-nodejs*/bin; do
  [ -x "$n/node" ] && export PATH="$n:$PATH" && break
done

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
  mkdir -p "$SRC/backend/db" "$NODE_ROOT/backend/db"
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

# Resolve Node binary (cPanel nodevenv for ehealth_ai)
resolve_node_bin() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  for v in "$HOME_DIR/nodevenv/ehealth_ai"/*/bin/node "$HOME_DIR/nodevenv/ehealth-ai"/*/bin/node; do
    if [ -x "$v" ]; then echo "$v"; return 0; fi
  done
  for v in "$HOME_DIR/nodevenv"/*/bin/activate; do
    # shellcheck disable=SC1090
    . "$v" 2>/dev/null && command -v node && return 0
  done
  for n in /opt/cpanel/ea-nodejs*/bin/node; do
    if [ -x "$n" ]; then echo "$n"; return 0; fi
  done
  command -v node 2>/dev/null || echo "node"
}

# Merge .htaccess: NEVER drop CloudLinux Passenger block (required for /api and /admin/api)
merge_htaccess() {
  local dest="$PUBLIC/.htaccess"
  [ -f "$HT_SRC" ] || { echo "No htaccess source at $HT_SRC"; return 0; }

  local passblock=""
  if [ -f "$dest" ] && grep -q 'PASSENGER CONFIGURATION BEGIN' "$dest"; then
    passblock="$(sed -n '/PASSENGER CONFIGURATION BEGIN/,/PASSENGER CONFIGURATION END/p' "$dest")"
    if ! echo "$passblock" | grep -Fq "$NODE_ROOT"; then
      echo "Replacing Passenger block (wrong AppRoot)"
      passblock=""
    fi
  fi

  if [ -z "$passblock" ] && [ -d "$NODE_ROOT/backend" ]; then
    local node_bin
    node_bin="$(resolve_node_bin)"
    passblock="# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot \"$NODE_ROOT\"
PassengerBaseURI \"/\"
PassengerNodejs \"$node_bin\"
PassengerAppType node
PassengerStartupFile backend/server.js
PassengerAppEnv production
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END"
    echo "Injected Passenger block (app=$NODE_ROOT node=$node_bin)"
  fi

  {
    if [ -n "$passblock" ]; then
      printf '%s\n\n' "$passblock"
    fi
    cat "$HT_SRC"
  } > "$dest.tmp"
  mv "$dest.tmp" "$dest"

  if [ -n "$passblock" ]; then
    echo "Merged .htaccess (Passenger OK)"
  else
    echo "WARNING: No Passenger block — cPanel -> Setup Node.js App -> RESTART"
  fi
}
merge_htaccess

# npm in Node app root (native modules must be built on server)
if [ -f "$NODE_ROOT/package.json" ] && command -v npm >/dev/null 2>&1; then
  mkdir -p "$NODE_ROOT/backend/db"
  echo "npm install in $NODE_ROOT ..."
  (cd "$NODE_ROOT" && npm install --omit=dev) || (cd "$NODE_ROOT" && npm install) || echo "WARN: root npm install failed"
  if [ -f "$NODE_ROOT/backend/package.json" ]; then
    echo "npm install in $NODE_ROOT/backend ..."
    (cd "$NODE_ROOT/backend" && npm install --omit=dev) || (cd "$NODE_ROOT/backend" && npm install) || echo "WARN: backend npm install failed"
  fi
else
  echo "WARN: npm not available — use cPanel Run NPM Install + Restart"
fi

# Touch Passenger restart (cPanel / Phusion)
mkdir -p "$PUBLIC/tmp" "$NODE_ROOT/tmp" 2>/dev/null || true
touch "$PUBLIC/tmp/restart.txt" "$NODE_ROOT/tmp/restart.txt" 2>/dev/null || true

echo "cpanel-post-deploy OK $(date -u)"
