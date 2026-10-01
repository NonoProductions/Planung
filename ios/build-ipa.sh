#!/bin/zsh
# Builds the next version as ../iPhone-Versionen/PlanungSync-v<N>.ipa for SideStore (unsigned,
# SideStore signs it). Every run bumps the version by one.
set -euo pipefail
cd "$(dirname "$0")"

PROJECT=PlanungSync.xcodeproj/project.pbxproj
VERSION=$(( $(grep -m1 -o 'CURRENT_PROJECT_VERSION = [0-9]*' $PROJECT | grep -o '[0-9]*$') + 1 ))
sed -i '' -E "s/(CURRENT_PROJECT_VERSION|MARKETING_VERSION) = [0-9.]+;/\1 = $VERSION;/" $PROJECT

rm -rf build
xcodebuild -project PlanungSync.xcodeproj -scheme PlanungSync -configuration Release \
  -sdk iphoneos -derivedDataPath build/derived CODE_SIGNING_ALLOWED=NO -quiet
mkdir -p build/Payload
cp -R build/derived/Build/Products/Release-iphoneos/PlanungSync.app build/Payload/
OUT="${PWD:h}/iPhone-Versionen" && mkdir -p "$OUT"
IPA="$OUT/PlanungSync-v$VERSION.ipa"
(cd build && zip -qr "$IPA" Payload)
echo "→ $IPA"
