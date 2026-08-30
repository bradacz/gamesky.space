import { writeFileSync } from 'node:fs';

const outputPath = process.env.GAMESKY_RELEASE_CONFIG_PATH;
const publicKey = process.env.GAMESKY_UPDATER_PUBKEY?.trim();
if (!outputPath || !publicKey) {
  throw new Error('GAMESKY_RELEASE_CONFIG_PATH and GAMESKY_UPDATER_PUBKEY are required.');
}

const cdnBase = (process.env.BUNNY_CDN_BASE_URL || 'https://cdn.gamesky.space').replace(/\/+$/, '');
// Must match where deploy-bunny.mjs actually uploads: /<storagePath>/releases/.
const storagePath = (process.env.BUNNY_STORAGE_PATH || 'gamesky.space').replace(/^\/+|\/+$/g, '');
const endpoint = `${cdnBase}${storagePath ? `/${storagePath}` : ''}/releases/latest.json`;
const signingIdentity = process.env.APPLE_SIGNING_IDENTITY?.trim();

const config = {
  bundle: {
    createUpdaterArtifacts: true,
    macOS: {
      signingIdentity: signingIdentity || undefined,
    }
  },
  plugins: {
    updater: {
      pubkey: publicKey,
      endpoints: [endpoint]
    }
  }
};

writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });


