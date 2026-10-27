#!/bin/bash
# Re-seal a locally built macOS app after electron-builder adds the share extension.
# Developer ID builds use apps/desktop/scripts/sign-share-extension.cjs instead.
set -euo pipefail

app="${1:?Usage: sign-macos-share-extension-after-pack.sh <EdgeEver.app>}"
root="$(cd "$(dirname "$0")/.." && pwd)"
entitlements="$root/apps/desktop/share-extension/EdgeEverShare.entitlements"
appex="$app/Contents/PlugIns/EdgeEverShare.appex"

test -d "$app"
test -d "$appex"

codesign \
  --force \
  --sign - \
  --generate-entitlement-der \
  --entitlements "$entitlements" \
  "$appex"

# electron-builder leaves the outer bundle linker-signed in ad-hoc mode, which
# macOS rejects when the share extension is present. Re-seal it last.
app_entitlements="$(mktemp -t edgeever-app-entitlements)"
trap 'rm -f "$app_entitlements"' EXIT
cat > "$app_entitlements" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
</dict>
</plist>
PLIST

codesign --force --sign - --entitlements "$app_entitlements" "$app"
codesign --verify --deep --strict --verbose=1 "$app"

actual="$(codesign -d --entitlements :- "$appex" 2>/dev/null || true)"
grep -q 'com.apple.security.app-sandbox' <<< "$actual"
echo "Signed $app with sandboxed $appex"
