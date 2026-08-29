import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const [bundleArg, signatureArg, outputArg = 'latest.json'] = process.argv.slice(2);
if (!bundleArg || !signatureArg || !process.env.GAMESKY_RELEASE_BASE_URL) {
  console.error('Usage: GAMESKY_RELEASE_BASE_URL=https://gamesky.space/releases npm run release:manifest -- <app.tar.gz> <app.tar.gz.sig> [latest.json]');
  process.exit(1);
}

const bundle = resolve(bundleArg);
const signature = readFileSync(resolve(signatureArg), 'utf8').trim();
if (!signature) throw new Error('Updater signature file is empty.');
const baseUrl = process.env.GAMESKY_RELEASE_BASE_URL.replace(/\/$/, '');
const manifest = {
  version: '1.0.0',
  notes: 'GameSky.space release',
  pub_date: new Date().toISOString(),
  platforms: {
    'macos-universal': {
      signature,
      url: `${baseUrl}/${encodeURIComponent(basename(bundle))}`
    }
  }
};
writeFileSync(resolve(outputArg), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote signed updater manifest to ${resolve(outputArg)}`);
