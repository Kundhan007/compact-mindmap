#!/bin/bash
# ./build.sh builds ~/Applications/Mindmap.app from app/ + ../web; ./build.sh web only refreshes the page code
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$PATH"
APP="${APP:-$HOME/Applications/Mindmap.app}"
if [ "$1" != "web" ]; then
  cargo build --release
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  cp target/release/mindmap "$APP/Contents/MacOS/Mindmap.new"
  mv -f "$APP/Contents/MacOS/Mindmap.new" "$APP/Contents/MacOS/Mindmap" # swap the file, so a running copy is not disturbed
  cp Info.plist "$APP/Contents/Info.plist"
  cp icon.icns "$APP/Contents/Resources/icon.icns"
fi
rm -rf "$APP/Contents/Resources/web"
mkdir -p "$APP/Contents/Resources/web"
cp -R ../web/. "$APP/Contents/Resources/web/"
codesign --force --sign - "$APP"
echo "built $APP"
