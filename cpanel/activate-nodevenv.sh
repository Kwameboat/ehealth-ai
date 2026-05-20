#!/bin/bash
# Add cPanel Node.js to PATH without sourcing activate (avoids CL_VIRTUAL_ENV + set -u errors).
# Usage: HOME_DIR=/home/ehealtha . ~/ehealth-ai/cpanel/activate-nodevenv.sh
HOME_DIR="${HOME_DIR:-${HOME:-/home/ehealtha}}"

for bin in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin "$HOME_DIR/nodevenv/ehealth_ai"/*/bin; do
  if [ -x "$bin/node" ]; then
    export PATH="$bin:$PATH"
    break
  fi
done

for n in /opt/cpanel/ea-nodejs*/bin; do
  if [ -x "$n/node" ]; then
    export PATH="$n:$PATH"
    break
  fi
done

unset NODE_PATH 2>/dev/null || true
