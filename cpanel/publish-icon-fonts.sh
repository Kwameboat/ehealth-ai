#!/bin/bash
# Hotfix broken dashboard icons without full redeploy
set -u
APP="${HOME}/ehealth-ai"
PUBLIC="${HOME}/public_html"

cd "$APP" || exit 1
if [ -f scripts/copy-icon-fonts.mjs ]; then
  for v in "$HOME/nodevenv/ehealth-ai"/*/bin/activate; do
    [ -f "$v" ] && . "$v" && break
  done
  node scripts/copy-icon-fonts.mjs
fi

mkdir -p "$PUBLIC/fonts"
if [ -d "$APP/public/fonts" ]; then
  cp -f "$APP/public/fonts/"*.ttf "$PUBLIC/fonts/" 2>/dev/null || true
fi
if [ -d "$APP/dist/fonts" ]; then
  cp -f "$APP/dist/fonts/"*.ttf "$PUBLIC/fonts/" 2>/dev/null || true
fi

echo "Fonts in $PUBLIC/fonts:"
ls -la "$PUBLIC/fonts/"*.ttf 2>/dev/null || echo "No .ttf files — run npm run build:web on server or wait for GitHub deploy"
