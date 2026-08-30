#!/bin/zsh
set -euo pipefail

app_path=${1:-}
dmg_path=${2:-}
[[ -d $app_path ]] || { print -u2 "Application bundle not found: $app_path"; exit 1; }
[[ -f $dmg_path ]] || { print -u2 "DMG not found: $dmg_path"; exit 1; }

binary_path="$app_path/Contents/MacOS/gamesky-space"
[[ -f $binary_path ]] || { print -u2 "Application binary not found: $binary_path"; exit 1; }

architectures=$(lipo -archs "$binary_path")
[[ $architectures == *arm64* && $architectures == *x86_64* ]] \
  || { print -u2 "Binary is not Universal: $architectures"; exit 1; }

codesign --verify --deep --strict --verbose=2 "$app_path"
spctl --assess --type execute --verbose=2 "$app_path"
xcrun stapler validate "$app_path"
# The DMG is what users download, so its notarization ticket is not optional.
# Stapling is allowed to fail (the ticket may already be attached); validation
# is not — swallowing it lets an un-notarized DMG be reported as verified.
xcrun stapler staple "$dmg_path" 2>/dev/null || true
xcrun stapler validate "$dmg_path" \
  || { print -u2 "DMG is not notarized (no stapled ticket): $dmg_path"; exit 1; }

print "Verified Universal architectures: $architectures"
print 'Verified Developer ID signature, Gatekeeper assessment and notarization tickets.'
