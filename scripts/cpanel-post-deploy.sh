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

# cPanel Node (PATH only — do not source activate; avoids CL_VIRTUAL_ENV error with set -u)
if [ -f "$SRC/cpanel/activate-nodevenv.sh" ]; then
  # shellcheck disable=SC1091
  HOME_DIR="$HOME_DIR" . "$SRC/cpanel/activate-nodevenv.sh"
else
  for bin in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin "$HOME_DIR/nodevenv/ehealth_ai"/*/bin; do
    if [ -x "$bin/node" ]; then export PATH="$bin:$PATH"; break; fi
  done
  for n in /opt/cpanel/ea-nodejs*/bin; do
    [ -x "$n/node" ] && export PATH="$n:$PATH" && break
  done
  unset NODE_PATH 2>/dev/null || true
fi

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
  if [ -d "$SRC/public/fonts" ]; then
    mkdir -p "$PUBLIC/fonts"
    cp -f "$SRC/public/fonts/"*.ttf "$PUBLIC/fonts/" 2>/dev/null || true
    echo "Published icon fonts to $PUBLIC/fonts"
  fi
  if [ -f "$SRC/public/icon-fonts.css" ]; then
    cp -f "$SRC/public/icon-fonts.css" "$PUBLIC/icon-fonts.css"
    INDEX="$PUBLIC/index.html"
    if [ -f "$INDEX" ] && ! grep -q 'icon-fonts.css' "$INDEX"; then
      sed -i 's|</head>|<link rel="stylesheet" href="/icon-fonts.css" />\n</head>|' "$INDEX" 2>/dev/null || \
        sed -i '' 's|</head>|<link rel="stylesheet" href="/icon-fonts.css" />\n</head>|' "$INDEX" 2>/dev/null || true
      echo "Linked icon-fonts.css in PWA index.html"
    fi
  fi
  mkdir -p "$PUBLIC/admin"
  cp -r "$SRC/backend/public/admin/"* "$PUBLIC/admin/" 2>/dev/null || true
  echo "Published PWA to $PUBLIC"
fi

if [ -f "$SRC/cpanel/merge-htaccess.sh" ]; then
  chmod +x "$SRC/cpanel/merge-htaccess.sh" 2>/dev/null || true
  APP_SRC="$SRC" PUBLIC_HTML="$PUBLIC" bash "$SRC/cpanel/merge-htaccess.sh" || \
    echo "WARN: merge-htaccess failed — cPanel Node.js -> RESTART"
else
  echo "WARN: cpanel/merge-htaccess.sh missing — RESTART Node app in cPanel"
fi

# Writable database directory (always use this in cPanel DATABASE_PATH)
mkdir -p "$SRC/data" "$SRC/backend/db"
chmod 775 "$SRC/data" 2>/dev/null || true
if [ -f "$SRC/backend/db/sql-wasm.wasm" ]; then
  cp -f "$SRC/backend/db/sql-wasm.wasm" "$SRC/backend/db/sql-wasm.wasm" 2>/dev/null || true
fi
if [ -f "$SRC/backend/db/medassistant.db" ] && [ ! -f "$SRC/data/medassistant.db" ]; then
  cp -f "$SRC/backend/db/medassistant.db" "$SRC/data/medassistant.db" 2>/dev/null || true
fi
rm -f "$SRC/data/"*.lock "$SRC/data/"*.tmp "$SRC/backend/db/"*.lock 2>/dev/null || true

# npm in deploy folder (only if nodevenv exists or npm in PATH)
NODE_BIN="$(resolve_node_bin)"
if [ -n "$NODE_BIN" ] && [ -x "$(dirname "$NODE_BIN")/npm" ]; then
  NPM_BIN="$(dirname "$NODE_BIN")/npm"
  rm -f "$SRC/package-lock.json" 2>/dev/null || true
  if [ ! -f "$SRC/backend/node_modules/express/package.json" ]; then
    echo "backend/node_modules missing — running isolated install script ..."
    chmod +x "$SRC/cpanel/install-backend-deps.sh" 2>/dev/null || true
    bash "$SRC/cpanel/install-backend-deps.sh" || true
  fi
  (cd "$SRC/backend" && "$NODE_BIN" -e "require('./db/ensureDb').ensureDbReady().then(()=>{const s=require('./services/settings');s.migrateLegacyGeminiModel();console.log('DB OK',require('./db/init').DB_PATH);}).catch(e=>{console.error(e);process.exit(1);})") \
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
