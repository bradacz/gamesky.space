#!/bin/zsh
set -euo pipefail

project_dir=${0:A:h:h}
cd "$project_dir"

fail() {
  print -u2 "GameSky.space release check failed: $1"
  exit 1
}

# Auto-load .env.release if present
if [[ -f "$project_dir/.env.release" ]]; then
  print 'Loading configuration from .env.release…'
  set -a
  source "$project_dir/.env.release"
  set +a
fi

# Auto-detect Minisign keys from .tauri-keys/ if not set in environment
if [[ -z ${TAURI_SIGNING_PRIVATE_KEY:-} && -f "$project_dir/.tauri-keys/updater.key" ]]; then
  export TAURI_SIGNING_PRIVATE_KEY="$project_dir/.tauri-keys/updater.key"
fi

if [[ -z ${GAMESKY_UPDATER_PUBKEY:-} && -f "$project_dir/.tauri-keys/updater.key.pub" ]]; then
  export GAMESKY_UPDATER_PUBKEY="$(cat "$project_dir/.tauri-keys/updater.key.pub" | tr -d '\r\n')"
fi

# The public key is baked into the app and the private key signs the update, so
# they must be a pair. .env.release is loaded first and wins, which means a
# rotated key leaves a stale public key behind — the build would then ship
# updates every client rejects, with nothing failing until users stop updating.
if [[ -n ${GAMESKY_UPDATER_PUBKEY:-} && -f "$project_dir/.tauri-keys/updater.key.pub" ]]; then
  keyfile_pubkey="$(tr -d '\r\n' < "$project_dir/.tauri-keys/updater.key.pub")"
  if [[ "$GAMESKY_UPDATER_PUBKEY" != "$keyfile_pubkey" ]]; then
    fail "GAMESKY_UPDATER_PUBKEY does not match .tauri-keys/updater.key.pub.
  The build would embed one key while signing with another, and every update
  would be rejected as unsigned. If the keypair was rotated, copy the current
  public key into .env.release (run: npm run release:keys to print it)."
  fi
fi

rustup target list --installed | grep -qx 'aarch64-apple-darwin' || fail 'Apple Silicon Rust target is missing (run: rustup target add aarch64-apple-darwin).'
rustup target list --installed | grep -qx 'x86_64-apple-darwin' || fail 'Intel Rust target is missing (run: rustup target add x86_64-apple-darwin).'
security find-identity -v -p codesigning | grep -q 'Developer ID Application' || fail 'No valid Developer ID Application identity is available in Keychain.'
[[ -n ${TAURI_SIGNING_PRIVATE_KEY:-} ]] || fail 'TAURI_SIGNING_PRIVATE_KEY is not configured (run: npm run release:keys).'
[[ -n ${GAMESKY_UPDATER_PUBKEY:-} ]] || fail 'GAMESKY_UPDATER_PUBKEY is not configured (run: npm run release:keys).'

if [[ -z ${APPLE_API_ISSUER:-} || -z ${APPLE_API_KEY:-} || -z ${APPLE_API_KEY_PATH:-} ]]; then
  [[ -n ${APPLE_ID:-} && -n ${APPLE_PASSWORD:-} && -n ${APPLE_TEAM_ID:-} ]] \
    || fail 'Configure either App Store Connect API credentials or APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID for notarization.'
fi

print 'Building signed and notarized Universal GameSky.space application…'
release_config=$(mktemp "${TMPDIR:-/tmp}/gamesky-tauri-release-XXXXXX")
trap 'rm -f "$release_config"' EXIT
GAMESKY_RELEASE_CONFIG_PATH="$release_config" node "$project_dir/scripts/generate-tauri-release-config.mjs"
npm run tauri build -- --config "$release_config" --target universal-apple-darwin --bundles app,dmg

app_path="$project_dir/src-tauri/target/universal-apple-darwin/release/bundle/macos/GameSky.space.app"
dmg_candidates=("$project_dir"/src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg(N))
(( ${#dmg_candidates[@]} == 1 )) || fail 'Expected exactly one Universal DMG artifact.'
dmg_path=$dmg_candidates[1]

# Tauri notarizes the .app and then builds the DMG from it, so the DMG itself
# carries no ticket. Gatekeeper checks the artifact the user downloads, so the
# DMG has to be submitted and stapled in its own right.
print 'Notarizing the DMG…'
if [[ -n ${APPLE_API_KEY:-} && -n ${APPLE_API_ISSUER:-} && -n ${APPLE_API_KEY_PATH:-} ]]; then
  xcrun notarytool submit "$dmg_path" \
    --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER" \
    --wait || fail 'Notarization of the DMG failed.'
else
  xcrun notarytool submit "$dmg_path" \
    --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" \
    --wait || fail 'Notarization of the DMG failed.'
fi
xcrun stapler staple "$dmg_path" || fail 'Could not staple the notarization ticket to the DMG.'

"$project_dir/scripts/verify-macos-release.sh" "$app_path" "$dmg_path"

print "Release ready: $dmg_path"

