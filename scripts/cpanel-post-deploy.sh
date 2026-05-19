#!/bin/bash
# Run on server after FTP deploy — publish static files, keep Passenger htaccess, npm in ehealth-ai.
set -eo pipefail

HOME_DIR="${HOME:-/home/ehealtha}"
SRC="${APP_SRC:-$HOME_DIR/ehealth-ai}"
PUBLIC="${PUBLIC_HTML:-$HOME_DIR/public_html}"
HT_SRC="$SRC/public_html.htaccess"

# Legacy cPanel app name ehealth_ai → point at deploy folder (do not rsync into underscore folder)
if [ -d "$SRC" ]; then
  ln -sfn "$SRC" "$HOME_DIR/ehealth_ai" 2>/dev/null || true
fi

# cPanel nodevenv (folder name matches application root: ehealth-ai)
for v in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin/activate "$HOME_DIR/nodevenv/ehealth_ai"/*/bin/activate; do
  if [ -f "$v" ]; then
    # shellcheck disable=SC1090
    . "$v" 2>/dev/null || true
    break
  fi
done
for bin in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin "$HOME_DIR/nodevenv/ehealth_ai"/*/bin; do
  [ -d "$bin" ] && export PATH="$bin:$PATH" && break
done
for n in /opt/cpanel/ea-nodejs*/bin; do
  [ -x "$n/node" ] && export PATH="$n:$PATH" && break
done

echo "cpanel-post-deploy: APP=$SRC"

if [ ! -f "$SRC/backend/server.js" ]; then
  echo "ERROR: $SRC/backend/ missing — GitHub deploy must upload full app (backend/, server.js, dist/)"
  exit 1
fi

# cPanel "Run NPM Install" uses root package.json — Expo deps break venv creation on shared hosting
if [ -f "$SRC/cpanel/package.production.json" ]; then
  if [ -f "$SRC/package.json" ] && ! grep -q '"ehealth-ai-api"' "$SRC/package.json" 2>/dev/null; then
    cp -f "$SRC/package.json" "$SRC/package.json.expo"
  fi
  cp -f "$SRC/cpanel/package.production.json" "$SRC/package.json"
  rm -f "$SRC/package-lock.json" 2>/dev/null || true
  echo "Using slim package.json for cPanel (removed root package-lock.json so backend npm install works)"
fi

resolve_node_bin() {
  for v in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin/node "$HOME_DIR/nodevenv/ehealth_ai"/*/bin/node; do
    if [ -x "$v" ]; then echo "$v"; return 0; fi
  done
  command -v node 2>/dev/null || true
}

# Publish PWA + admin static files
if [ -d "$SRC/dist" ]; then
  find "$PUBLIC" -mindepth 1 -maxdepth 1 ! -name cgi-bin -exec rm -rf {} + 2>/dev/null || true
  cp -r "$SRC/dist/"* "$PUBLIC/"
  if [ -f "$PUBLIC/index.html" ] && ! grep -q 'app-config.js' "$PUBLIC/index.html"; then
    sed -i 's|</head>|<script src="/app-config.js"></script></head>|' "$PUBLIC/index.html" 2>/dev/null || \
      sed -i '' 's|</head>|<script src="/app-config.js"></script></head>|' "$PUBLIC/index.html" 2>/dev/null || true
    echo "Injected app-config.js into PWA index.html"
  fi
  cp -f "$SRC/public/manifest.json" "$PUBLIC/" 2>/dev/null || true
  cp -f "$SRC/public/sw.js" "$PUBLIC/" 2>/dev/null || true
  cp -r "$SRC/public/icons" "$PUBLIC/" 2>/dev/null || true
  mkdir -p "$PUBLIC/admin"
  cp -r "$SRC/backend/public/admin/"* "$PUBLIC/admin/" 2>/dev/null || true
  echo "Published PWA to $PUBLIC"
fi

merge_htaccess() {
  local dest="$PUBLIC/.htaccess"
  [ -f "$HT_SRC" ] || return 0
  local passblock=""
  if [ -f "$dest" ] && grep -q 'PASSENGER CONFIGURATION BEGIN' "$dest"; then
    passblock="$(sed -n '/PASSENGER CONFIGURATION BEGIN/,/PASSENGER CONFIGURATION END/p' "$dest")"
    if ! echo "$passblock" | grep -Fq "$SRC"; then
      echo "Replacing Passenger block (stale AppRoot)"
      passblock=""
    fi
  fi

  if [ -z "$passblock" ]; then
    NODE_BIN="$(resolve_node_bin)"
    if [ -n "$NODE_BIN" ] && [ -x "$NODE_BIN" ] && [ -f "$SRC/server.js" ]; then
      passblock="# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot \"$SRC\"
PassengerBaseURI \"/\"
PassengerNodejs \"$NODE_BIN\"
PassengerAppType node
PassengerStartupFile server.js
PassengerAppEnv production
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END"
      echo "Injected Passenger block (nodevenv OK, AppRoot=$SRC)"
    fi
  fi

  {
    [ -n "$passblock" ] && printf '%s\n\n' "$passblock"
    cat "$HT_SRC"
  } > "$dest.tmp"
  mv "$dest.tmp" "$dest"
  if [ -z "$passblock" ]; then
    echo "CRITICAL: No Passenger — cPanel -> Node.js app -> RESTART (creates nodevenv + .htaccess)"
  else
    echo "Merged .htaccess (Passenger OK)"
  fi
}
merge_htaccess

# npm in deploy folder (only if nodevenv exists or npm in PATH)
mkdir -p "$SRC/backend/db"
NODE_BIN="$(resolve_node_bin)"
if [ -n "$NODE_BIN" ] && [ -x "$(dirname "$NODE_BIN")/npm" ]; then
  NPM_BIN="$(dirname "$NODE_BIN")/npm"
  rm -f "$SRC/package-lock.json" 2>/dev/null || true
  if [ ! -f "$SRC/backend/node_modules/express/package.json" ]; then
    echo "backend/node_modules missing — running isolated install script ..."
    chmod +x "$SRC/cpanel/install-backend-deps.sh" 2>/dev/null || true
    bash "$SRC/cpanel/install-backend-deps.sh" || true
  fi
  (cd "$SRC/backend" && "$NODE_BIN" -e "require('./db/init').initDatabase().then(() => console.log('DB OK')).catch(e => { console.error(e); process.exit(1); })") \
    > "$SRC/startup-check.log" 2>&1 && echo "Startup check OK" || echo "WARN: see $SRC/startup-check.log"
elif [ -f "$SRC/package.json" ] && command -v npm >/dev/null 2>&1; then
  (cd "$SRC" && npm install --omit=dev) || true
  (cd "$SRC/backend" && npm install --omit=dev) || true
else
  echo "SKIP npm (no nodevenv yet) — create Node app root ehealth-ai, then Run NPM Install in cPanel"
fi

mkdir -p "$PUBLIC/tmp" "$SRC/tmp" 2>/dev/null || true
touch "$PUBLIC/tmp/restart.txt" "$SRC/tmp/restart.txt" 2>/dev/null || true
echo "cpanel-post-deploy OK $(date -u)"
