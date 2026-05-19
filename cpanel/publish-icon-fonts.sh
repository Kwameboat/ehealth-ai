#!/bin/bash
# Publish icon fonts to public_html/fonts (fixes broken dashboard icons on web).
# Works without git — downloads from GitHub if files are missing locally.
set -u

HOME_DIR="${HOME:-/home/ehealtha}"
APP="${APP_SRC:-$HOME_DIR/ehealth-ai}"
PUBLIC="${PUBLIC_HTML:-$HOME_DIR/public_html}"
BASE="${GITHUB_RAW:-https://raw.githubusercontent.com/Kwameboat/ehealth-ai/main}"

FONT_NAMES=(
  MaterialCommunityIcons.ttf
  Ionicons.ttf
  Feather.ttf
  MaterialIcons.ttf
  FontAwesome5_Solid.ttf
  FontAwesome5_Regular.ttf
)

mkdir -p "$APP/public/fonts" "$PUBLIC/fonts"

copy_from_dir() {
  local dir="$1"
  [ -d "$dir" ] || return 1
  local n=0
  for f in "${FONT_NAMES[@]}"; do
    if [ -f "$dir/$f" ]; then
      cp -f "$dir/$f" "$PUBLIC/fonts/$f"
      cp -f "$dir/$f" "$APP/public/fonts/$f" 2>/dev/null || true
      n=$((n + 1))
    fi
  done
  [ "$n" -gt 0 ]
}

echo "=== Publish icon fonts -> $PUBLIC/fonts ==="

if copy_from_dir "$APP/public/fonts" || copy_from_dir "$APP/dist/fonts"; then
  echo "Copied from app public/dist fonts"
else
  VEC="$APP/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts"
  if copy_from_dir "$VEC"; then
    echo "Copied from node_modules/@expo/vector-icons"
  else
    echo "Downloading fonts from GitHub ($BASE)..."
    ok=0
    for f in "${FONT_NAMES[@]}"; do
      if curl -fsSL -o "$PUBLIC/fonts/$f" "$BASE/public/fonts/$f"; then
        cp -f "$PUBLIC/fonts/$f" "$APP/public/fonts/$f" 2>/dev/null || true
        ok=$((ok + 1))
      else
        echo "WARN: could not fetch $f"
      fi
    done
    if [ "$ok" -lt 3 ]; then
      echo "ERROR: too few fonts downloaded ($ok). Wait for GitHub deploy or run: npm run build:web"
      exit 1
    fi
  fi
fi

if [ -f "$APP/scripts/copy-icon-fonts.mjs" ]; then
  for v in "$HOME_DIR/nodevenv/ehealth-ai"/*/bin/activate; do
    [ -f "$v" ] && . "$v" && break
  done
  command -v node >/dev/null 2>&1 && node "$APP/scripts/copy-icon-fonts.mjs" 2>/dev/null || true
  copy_from_dir "$APP/public/fonts" || true
fi

chmod 644 "$PUBLIC/fonts/"*.ttf 2>/dev/null || true

echo ""
echo "Installed:"
ls -la "$PUBLIC/fonts/"*.ttf 2>/dev/null || { echo "No fonts found"; exit 1; }

if ! grep -q 'RewriteRule \^fonts/' "$PUBLIC/.htaccess" 2>/dev/null; then
  if [ -f "$APP/cpanel/merge-htaccess.sh" ]; then
    chmod +x "$APP/cpanel/merge-htaccess.sh"
    APP_SRC="$APP" PUBLIC_HTML="$PUBLIC" bash "$APP/cpanel/merge-htaccess.sh" || true
  elif [ -f "$APP/public_html.htaccess" ]; then
    curl -fsSL -o "$APP/public_html.htaccess" "$BASE/public_html.htaccess" 2>/dev/null || true
    APP_SRC="$APP" PUBLIC_HTML="$PUBLIC" bash "$APP/cpanel/merge-htaccess.sh" 2>/dev/null || true
  fi
fi

echo ""
echo "Done. Hard-refresh the site (Ctrl+Shift+R)."
echo "Test: https://www.ehealthaigh.com/fonts/MaterialCommunityIcons.ttf"
