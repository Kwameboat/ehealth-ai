#!/bin/bash
# Publish icon fonts + CSS so dashboard icons render (no full PWA rebuild required).
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

if ! copy_from_dir "$APP/public/fonts"; then
  if ! copy_from_dir "$APP/dist/fonts"; then
    VEC="$APP/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts"
    if ! copy_from_dir "$VEC"; then
      echo "Downloading fonts from GitHub..."
      ok=0
      for f in "${FONT_NAMES[@]}"; do
        if curl -fsSL -o "$PUBLIC/fonts/$f" "$BASE/public/fonts/$f"; then
          ok=$((ok + 1))
        fi
      done
      [ "$ok" -ge 3 ] || { echo "ERROR: font download failed"; exit 1; }
    fi
  fi
fi

chmod 644 "$PUBLIC/fonts/"*.ttf 2>/dev/null || true

echo "=== Install icon-fonts.css ==="
if [ -f "$APP/public/icon-fonts.css" ]; then
  cp -f "$APP/public/icon-fonts.css" "$PUBLIC/icon-fonts.css"
else
  curl -fsSL -o "$PUBLIC/icon-fonts.css" "$BASE/public/icon-fonts.css" || {
    echo "ERROR: could not install icon-fonts.css"
    exit 1
  }
fi

INDEX="$PUBLIC/index.html"
if [ -f "$INDEX" ]; then
  if ! grep -q 'icon-fonts.css' "$INDEX"; then
    sed -i 's|</head>|<link rel="stylesheet" href="/icon-fonts.css" />\n</head>|' "$INDEX" 2>/dev/null || \
      sed -i '' 's|</head>|<link rel="stylesheet" href="/icon-fonts.css" />\n</head>|' "$INDEX" 2>/dev/null || true
    echo "Linked icon-fonts.css in index.html"
  else
    echo "index.html already links icon-fonts.css"
  fi
else
  echo "WARN: $INDEX not found"
fi

if ! grep -q 'RewriteRule \^fonts/' "$PUBLIC/.htaccess" 2>/dev/null; then
  if [ -f "$APP/cpanel/merge-htaccess.sh" ]; then
    chmod +x "$APP/cpanel/merge-htaccess.sh"
    APP_SRC="$APP" PUBLIC_HTML="$PUBLIC" bash "$APP/cpanel/merge-htaccess.sh" || true
  fi
fi

# LiteSpeed: correct MIME for .ttf (some hosts serve as text/plain)
if [ -f "$PUBLIC/.htaccess" ] && ! grep -q 'AddType font/ttf' "$PUBLIC/.htaccess" 2>/dev/null; then
  {
    echo ''
    echo '# Icon fonts (eHealth AI)'
    echo 'AddType font/ttf .ttf'
    echo 'AddType application/font-ttf .ttf'
  } >> "$PUBLIC/.htaccess"
fi

echo ""
echo "Fonts:"
ls -la "$PUBLIC/fonts/"*.ttf 2>/dev/null
echo ""
echo "CSS: $PUBLIC/icon-fonts.css ($(wc -c < "$PUBLIC/icon-fonts.css") bytes)"
echo ""
echo "Done — hard refresh: Ctrl+Shift+R"
echo "Test CSS: https://www.ehealthaigh.com/icon-fonts.css"
echo "Test font: https://www.ehealthaigh.com/fonts/MaterialCommunityIcons.ttf"
