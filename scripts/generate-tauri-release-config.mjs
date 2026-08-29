import { writeFileSync } from 'node:fs';

const outputPath = process.env.GAMESKY_RELEASE_CONFIG_PATH;
const publicKey = process.env.GAMESKY_UPDATER_PUBKEY?.trim();
if (!outputPath || !publicKey) {
  throw new Error('GAMESKY_RELEASE_CONFIG_PATH and GAMESKY_UPDATER_PUBKEY are required.');
}

writeFileSync(outputPath, `${JSON.stringify({
  bundle: { createUpdaterArtifacts: true },
  plugins: {
    updater: {
      pubkey: publicKey,
      endpoints: ['https://gamesky.space/releases/latest.json']
    }
  }
}, null, 2)}\n`, { mode: 0o600 });
