#!/bin/bash
# ./build.sh builds ~/Applications/Mindmap.app; ./build.sh web only relinks the page code (the app is not re-signed)
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$PATH"
APP="${APP:-$HOME/Applications/Mindmap.app}"
LIVE="${LIVE:-$HOME/Library/Application Support/Mindmap/web}" # page code is read from here first: a link to ../web, so edits show on the next reload or restart
if [ "$1" != "web" ]; then
  cargo build --release
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  cp target/release/mindmap "$APP/Contents/MacOS/Mindmap.new"
  mv -f "$APP/Contents/MacOS/Mindmap.new" "$APP/Contents/MacOS/Mindmap" # swap the file, so a running copy is not disturbed
  cp Info.plist "$APP/Contents/Info.plist"
  cp icon.icns "$APP/Contents/Resources/icon.icns"
  rm -rf "$APP/Contents/Resources/web"
  mkdir -p "$APP/Contents/Resources/web"
  cp -R ../web/. "$APP/Contents/Resources/web/" # fallback copy, sealed in the signature
  # identity-only requirement: macOS keeps its folder permission across rebuilds
  codesign --force --sign - -r='designated => identifier "local.kundhan.mindmap"' "$APP"
fi
rm -rf "$LIVE"
mkdir -p "$(dirname "$LIVE")"
ln -s "$(cd ../web && pwd)" "$LIVE"
echo "built $APP"
