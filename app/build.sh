#!/bin/bash
# ./build.sh builds ~/Applications/Mindmap.app; ./build.sh web only refreshes the page code inside it
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$PATH"
APP="${APP:-$HOME/Applications/Mindmap.app}"
if [ "$1" != "web" ]; then
  cargo build --release
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  cp target/release/mindmap "$APP/Contents/MacOS/Mindmap"
  cp Info.plist "$APP/Contents/Info.plist"
  cp icon.icns "$APP/Contents/Resources/icon.icns"
fi
rm -rf "$APP/Contents/Resources/web"
mkdir -p "$APP/Contents/Resources/web"
cp -R ../index.html ../css ../js "$APP/Contents/Resources/web/"
codesign --force --sign - "$APP"
echo "built $APP"
