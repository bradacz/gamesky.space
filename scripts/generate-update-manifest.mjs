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

// The updater compares the client's version against this one, so it has to
// track the app rather than sit here as a literal that quietly goes stale.
const { version } = JSON.parse(
  readFileSync(resolve(new URL('..', import.meta.url).pathname, 'package.json'), 'utf8')
);
if (!/^\d+\.\d+\.\d+/.test(version ?? '')) {
  throw new Error(`package.json has no usable version (got ${JSON.stringify(version)}).`);
}

const manifest = {
  version,
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
