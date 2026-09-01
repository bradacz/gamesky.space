import { existsSync, readFileSync, readdirSync, statSync, createReadStream } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createServer } from 'node:http';

// Load .env.release if present
const projectRoot = resolve(import.meta.dirname, '..');
const envPath = resolve(projectRoot, '.env.release');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME;
const storageAccessKey = process.env.BUNNY_STORAGE_ACCESS_KEY;
const storagePath = (process.env.BUNNY_STORAGE_PATH || 'gamesky.space').replace(/^\/+|\/+$/g, '');
const cdnBaseUrl = (process.env.BUNNY_CDN_BASE_URL || 'https://cdn.gamesky.space').replace(/\/+$/, '');
const storageRegion = (process.env.BUNNY_STORAGE_REGION || 'de').toLowerCase();
const bunnyApiKey = process.env.BUNNY_API_KEY;

if (!storageZone || !storageAccessKey) {
  console.error('❌ Error: BUNNY_STORAGE_ZONE_NAME and BUNNY_STORAGE_ACCESS_KEY must be set in .env.release or environment.');
  process.exit(1);
}

// Storage endpoint mapping
const REGION_ENDPOINTS = {
  de: 'storage.bunnycdn.com',
  ny: 'ny.storage.bunnycdn.com',
  la: 'la.storage.bunnycdn.com',
  sg: 'sg.storage.bunnycdn.com',
  syd: 'syd.storage.bunnycdn.com',
  uk: 'uk.storage.bunnycdn.com',
  se: 'se.storage.bunnycdn.com',
  br: 'br.storage.bunnycdn.com',
  jh: 'jh.storage.bunnycdn.com',
};
const storageEndpoint = REGION_ENDPOINTS[storageRegion] || 'storage.bunnycdn.com';

// Uploads go to /<storagePath>/releases/, so public URLs must carry that same
// prefix. Dropping it yields links that 404 while the upload itself succeeds.
const releasesBasePath = `${storagePath ? `/${storagePath}` : ''}/releases`;
const publicUrl = name => `${cdnBaseUrl}${releasesBasePath}/${encodeURIComponent(name)}`;

// 1. Locate release artifacts
const tauriTargetDir = resolve(projectRoot, 'src-tauri/target/universal-apple-darwin/release/bundle');
const dmgDir = resolve(tauriTargetDir, 'dmg');
const macosDir = resolve(tauriTargetDir, 'macos');

if (!existsSync(dmgDir)) {
  console.error(`❌ Build directory not found: ${dmgDir}. Run "npm run release:macos" first.`);
  process.exit(1);
}

const dmgFiles = readdirSync(dmgDir).filter(f => f.endsWith('.dmg'));
if (dmgFiles.length === 0) {
  console.error('❌ No .dmg file found in bundle/dmg/');
  process.exit(1);
}
const dmgPath = resolve(dmgDir, dmgFiles[0]);

// Find tar.gz updater bundle and sig
let tarGzPath = null;
let sigPath = null;
if (existsSync(macosDir)) {
  const tarFiles = readdirSync(macosDir).filter(f => f.endsWith('.app.tar.gz'));
  if (tarFiles.length > 0) {
    tarGzPath = resolve(macosDir, tarFiles[0]);
  }
  const sigFiles = readdirSync(macosDir).filter(f => f.endsWith('.app.tar.gz.sig') || f.endsWith('.sig'));
  if (sigFiles.length > 0) {
    sigPath = resolve(macosDir, sigFiles[0]);
  }
}

// Read version from tauri.conf.json
const tauriConf = JSON.parse(readFileSync(resolve(projectRoot, 'src-tauri/tauri.conf.json'), 'utf8'));
const appVersion = tauriConf.version || '1.0.0';

console.log('🚀 ========================================================');
console.log(`📦 Deploying GameSky.space v${appVersion} to Bunny.net`);
console.log('🚀 ========================================================');
console.log(`📁 Storage Zone:     ${storageZone}`);
console.log(`📂 Project Folder:   /${storagePath}/releases/`);
console.log(`🌐 Storage Endpoint: https://${storageEndpoint}`);
console.log(`⚡ CDN Base URL:     ${cdnBaseUrl}`);
console.log('------------------------------------------------------------');

// Helper to upload file via HTTP PUT
// Every uploaded name, so the cache purge covers all of them. Purging only
// some leaves the CDN serving a stale updater archive against a fresh
// manifest, and the signature check then rejects the update.
const uploadedNames = [];

async function uploadToBunnyStorage(localFilePath, remoteFileName, contentType = 'application/octet-stream') {
  const remoteUrl = `https://${storageEndpoint}/${storageZone}/${storagePath}/releases/${encodeURIComponent(remoteFileName)}`;
  console.log(`⬆️  Uploading: ${remoteFileName} (${(statSync(localFilePath).size / (1024 * 1024)).toFixed(2)} MB)...`);

  const fileData = readFileSync(localFilePath);
  const response = await fetch(remoteUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': storageAccessKey,
      'Content-Type': contentType,
    },
    body: fileData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload ${remoteFileName} (${response.status} ${response.statusText}): ${errorText}`);
  }
  uploadedNames.push(remoteFileName);
  console.log(`✅ Uploaded:  ${remoteFileName}`);
}

async function uploadStringContent(content, remoteFileName, contentType = 'application/json') {
  const remoteUrl = `https://${storageEndpoint}/${storageZone}/${storagePath}/releases/${encodeURIComponent(remoteFileName)}`;
  console.log(`⬆️  Uploading: ${remoteFileName}...`);

  const response = await fetch(remoteUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': storageAccessKey,
      'Content-Type': contentType,
    },
    body: content,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload ${remoteFileName} (${response.status} ${response.statusText}): ${errorText}`);
  }
  uploadedNames.push(remoteFileName);
  console.log(`✅ Uploaded:  ${remoteFileName}`);
}

async function purgeBunnyCdnUrl(urlToPurge) {
  if (!bunnyApiKey) {
    console.log('ℹ️  BUNNY_API_KEY not set. Skipping automatic CDN cache purge.');
    return;
  }
  console.log(`🧹 Purging CDN cache for: ${urlToPurge}...`);
  try {
    const response = await fetch(`https://api.bunny.net/purge?url=${encodeURIComponent(urlToPurge)}`, {
      method: 'POST',
      headers: {
        'AccessKey': bunnyApiKey,
      },
    });
    if (response.ok) {
      console.log('✅ CDN Cache Purged successfully.');
    } else {
      console.warn(`⚠️ CDN Purge failed (${response.status}): ${await response.text()}`);
    }
  } catch (err) {
    console.warn(`⚠️ CDN Purge request error: ${err.message}`);
  }
}

async function run() {
  try {
    // 1. Upload DMG
    await uploadToBunnyStorage(dmgPath, basename(dmgPath));

    // 2. Also upload standardized named DMG for static download links (e.g. GameSky.space-latest.dmg)
    await uploadToBunnyStorage(dmgPath, 'GameSky.space-latest.dmg');

    // 3. Upload updater archive and sig if present
    let signatureContent = '';
    if (tarGzPath && sigPath) {
      await uploadToBunnyStorage(tarGzPath, basename(tarGzPath));
      await uploadToBunnyStorage(sigPath, basename(sigPath), 'text/plain');
      signatureContent = readFileSync(sigPath, 'utf8').trim();
    }

    // 4. Generate and upload latest.json manifest for Tauri v2 updater.
    // A manifest with no signature or URL is worse than none: clients fetch it,
    // find a release they cannot verify or download, and the cache purge makes
    // it live immediately.
    if (!tarGzPath || !sigPath || !signatureContent) {
      throw new Error(
        'Updater archive or signature is missing, so latest.json would advertise a release with no download. ' +
        `Expected a .app.tar.gz and .sig in ${macosDir}. Run "npm run release:macos" first.`
      );
    }

    const updateManifest = {
      version: appVersion,
      notes: `GameSky.space v${appVersion} release for macOS (Universal Apple Silicon & Intel).`,
      pub_date: new Date().toISOString(),
      platforms: {
        'darwin-aarch64': {
          signature: signatureContent,
          url: tarGzPath ? publicUrl(basename(tarGzPath)) : '',
        },
        'darwin-x86_64': {
          signature: signatureContent,
          url: tarGzPath ? publicUrl(basename(tarGzPath)) : '',
        },
        'macos-universal': {
          signature: signatureContent,
          url: tarGzPath ? publicUrl(basename(tarGzPath)) : '',
        },
      },
    };

    const manifestJson = JSON.stringify(updateManifest, null, 2);
    await uploadStringContent(manifestJson, 'latest.json', 'application/json');

    // 5. Purge every file we just uploaded
    for (const name of [...new Set(uploadedNames)]) {
      await purgeBunnyCdnUrl(publicUrl(name));
    }

    console.log('\n🎉 ========================================================');
    console.log('✅ RELEASE DEPLOYMENT COMPLETE!');
    console.log('🎉 ========================================================');
    console.log(`📥 Download URL (Versioned):  ${publicUrl(basename(dmgPath))}`);
    console.log(`📥 Download URL (Latest):     ${publicUrl('GameSky.space-latest.dmg')}`);
    console.log(`🔄 Auto-Updater Endpoint:    ${publicUrl('latest.json')}`);
    console.log('===========================================================\n');
  } catch (err) {
    console.error(`\n❌ Deployment Failed: ${err.message}`);
    process.exit(1);
  }
}

run();
