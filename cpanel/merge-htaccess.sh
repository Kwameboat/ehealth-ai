#!/bin/bash
# Merge rewrite rules into public_html/.htaccess WITHOUT removing Passenger block.
# Usage: APP_SRC=~/ehealth-ai PUBLIC_HTML=~/public_html bash cpanel/merge-htaccess.sh

HOME_DIR="${HOME:-/home/ehealtha}"
SRC="${APP_SRC:-$HOME_DIR/ehealth-ai}"
PUBLIC="${PUBLIC_HTML:-$HOME_DIR/public_html}"
HT_SRC="$SRC/public_html.htaccess"
dest="$PUBLIC/.htaccess"

resolve_node_bin() {
  for v in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin/node "$HOME_DIR/nodevenv/ehealth_ai"/*/bin/node; do
    [ -x "$v" ] && echo "$v" && return 0
  done
  command -v node 2>/dev/null || true
}

if [ ! -f "$HT_SRC" ]; then
  echo "ERROR: missing $HT_SRC"
  exit 1
fi

passblock=""
if [ -f "$dest" ] && grep -q 'PASSENGER CONFIGURATION BEGIN' "$dest"; then
  passblock="$(sed -n '/PASSENGER CONFIGURATION BEGIN/,/PASSENGER CONFIGURATION END/p' "$dest")"
  if ! echo "$passblock" | grep -Fq "$SRC"; then
    echo "Passenger block stale AppRoot — will regenerate"
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
PassengerMaxPoolSize 1
PassengerMinInstances 1
PassengerMaxRequestTime 120
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END"
    echo "Injected Passenger block (AppRoot=$SRC)"
  fi
fi

{
  [ -n "$passblock" ] && printf '%s\n\n' "$passblock"
  cat "$HT_SRC"
} > "$dest.tmp"
mv "$dest.tmp" "$dest"

if [ -z "$passblock" ]; then
  echo "CRITICAL: No Passenger block — cPanel -> Node.js -> RESTART"
  exit 1
fi

if grep -q 'PASSENGER CONFIGURATION BEGIN' "$dest"; then
  echo "OK: .htaccess has Passenger + rewrite rules"
else
  echo "ERROR: merge failed"
  exit 1
fi
