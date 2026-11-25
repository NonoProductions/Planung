#!/bin/zsh
# Signs Planung Sync with the free Apple ID from Xcode and installs it on the iPhone (cable or Wi-Fi).
#   ./renew-xcode.sh           copy the current code, sign and install now
#   ./renew-xcode.sh --setup   same, and install the background job
# The background job (--auto) works on a copy because launchd may not read ~/Documents.
set -euo pipefail

BASE="$HOME/Library/Application Support/PlanungSyncRenew"
source "$BASE/config"   # DEVICE=<iPhone UDID> and TEAM=<team ID>, kept out of the repo
BUNDLE=com.noelamborelle.planungsync.$TEAM   # same ID SideStore used, so the app is replaced in place
LABEL=com.noelamborelle.planungsync.renew
PROFILES="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
MODE=${1:-}

mkdir -p "$BASE"
echo "--- $(date '+%F %T') ${MODE:-manual}"

if [[ $MODE == --auto ]]; then
  # Renew every 2 days at most, the signature lasts 7.
  if [[ -f "$BASE/last-success" && -n "$(find "$BASE/last-success" -mmin -2880)" ]]; then
    echo "still fresh"; exit 0
  fi
else
  HERE="${0:A:h}"
  mkdir -p "$BASE/src"
  rsync -a --delete --exclude build --exclude xcuserdata "$HERE/" "$BASE/src/"
fi

if ! xcrun devicectl device info details --device $DEVICE --timeout 30 >/dev/null 2>&1; then
  echo "iPhone not reachable"; [[ $MODE == --auto ]] && exit 0 || exit 1
fi

# Xcode reuses a cached profile until it expires, so set ours aside to get a new 7-day one.
HELD="$BASE/held-profiles"; rm -rf "$HELD"; mkdir -p "$HELD"
if [[ -d "$PROFILES" ]]; then
  for p in "$PROFILES"/*.mobileprovision(N); do
    if security cms -D -i "$p" 2>/dev/null | grep -qF "<string>$TEAM.$BUNDLE</string>"; then mv "$p" "$HELD/"; fi
  done
fi
restore() { for p in "$HELD"/*.mobileprovision(N); do mv "$p" "$PROFILES/"; done }

cd "$BASE/src"
if ! xcodebuild -project PlanungSync.xcodeproj -scheme PlanungSync -configuration Release \
  -destination "platform=iOS,id=$DEVICE" -derivedDataPath "$BASE/derived" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM=$TEAM PRODUCT_BUNDLE_IDENTIFIER=$BUNDLE -quiet; then
  restore; echo "BUILD FAILED"
  osascript -e 'display notification "Signieren fehlgeschlagen. In Xcode unter Settings die Apple-ID prüfen." with title "Planung Sync"' || true
  exit 1
fi

APP="$BASE/derived/Build/Products/Release-iphoneos/PlanungSync.app"
xcrun devicectl device install app --device $DEVICE --timeout 120 "$APP" >/dev/null
touch "$BASE/last-success"
security cms -D -i "$APP/embedded.mobileprovision" 2>/dev/null | grep -A1 ExpirationDate | tail -1
echo "installed"

if [[ $MODE == --setup ]]; then
  cp "$0" "$BASE/renew.sh"
  cat > "$PLIST" <<XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$BASE/renew.sh</string><string>--auto</string></array>
  <key>StartInterval</key><integer>3600</integer>
  <key>StandardOutPath</key><string>$BASE/renew.log</string>
  <key>StandardErrorPath</key><string>$BASE/renew.log</string>
</dict></plist>
XML
  plutil -lint "$PLIST"
  launchctl bootout gui/$UID/$LABEL 2>/dev/null || true
  launchctl bootstrap gui/$UID "$PLIST"
fi
