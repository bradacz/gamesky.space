import { writeFileSync } from 'node:fs';

const outputPath = process.env.GAMESKY_RELEASE_CONFIG_PATH;
const publicKey = process.env.GAMESKY_UPDATER_PUBKEY?.trim();
if (!outputPath || !publicKey) {
  throw new Error('GAMESKY_RELEASE_CONFIG_PATH and GAMESKY_UPDATER_PUBKEY are required.');
}

const cdnBase = (process.env.BUNNY_CDN_BASE_URL || 'https://cdn.gamesky.space').replace(/\/+$/, '');
const endpoint = `${cdnBase}/releases/latest.json`;

writeFileSync(outputPath, `${JSON.stringify({
  bundle: { createUpdaterArtifacts: true },
  plugins: {
    updater: {
      pubkey: publicKey,
      endpoints: [endpoint]
    }
  }
}, null, 2)}\n`, { mode: 0o600 });

