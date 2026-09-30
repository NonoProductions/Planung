#!/bin/zsh
# Builds "Noes Planer.app" into macos/build/. Usage: ./build.sh [--install]
set -euo pipefail
cd "$(dirname "$0")"

APP="build/Noes Planer.app"
rm -rf build && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" build/tmp

swiftc -O -parse-as-library -target arm64-apple-macos14.0 -o build/tmp/arm64 Sources/*.swift
swiftc -O -parse-as-library -target x86_64-apple-macos14.0 -o build/tmp/x86_64 Sources/*.swift
lipo -create build/tmp/arm64 build/tmp/x86_64 -output "$APP/Contents/MacOS/NoesPlaner"
cp Info.plist "$APP/Contents/"

swift make-icon.swift build/tmp/icon.png
ICONSET=build/tmp/AppIcon.iconset && mkdir -p $ICONSET
for s in 16 32 128 256 512; do
  sips -z $s $s build/tmp/icon.png --out $ICONSET/icon_${s}x${s}.png >/dev/null
  sips -z $((s*2)) $((s*2)) build/tmp/icon.png --out $ICONSET/icon_${s}x${s}@2x.png >/dev/null
done
iconutil -c icns $ICONSET -o "$APP/Contents/Resources/AppIcon.icns"

codesign --force --deep --sign - "$APP"
rm -rf build/tmp
echo "Fertig: $APP"

if [[ "${1:-}" == "--install" ]]; then
  rm -rf "/Applications/Noes Planer.app"
  cp -R "$APP" /Applications/
  echo "Installiert in /Applications"
fi
