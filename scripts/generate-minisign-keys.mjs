import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const projectRoot = resolve(import.meta.dirname, '..');
const keysDir = resolve(projectRoot, '.tauri-keys');
const privateKeyPath = resolve(keysDir, 'updater.key');
const publicKeyPath = resolve(keysDir, 'updater.key.pub');

if (!existsSync(keysDir)) {
  mkdirSync(keysDir, { recursive: true, mode: 0o700 });
}

if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
  console.log('✅ Tauri updater keypair already exists at:', keysDir);
} else {
  console.log('🔑 Generating new Minisign keypair for Tauri v2 updater...');
  try {
    execSync(`npx tauri signer generate -w "${privateKeyPath}" --ci`, {
      cwd: projectRoot,
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('Failed to generate signer keys via Tauri CLI:', err.message);
    process.exit(1);
  }
}

if (existsSync(publicKeyPath)) {
  const pubKey = readFileSync(publicKeyPath, 'utf8').trim();
  console.log('\n======================================================');
  console.log('🌟 YOUR TAURI UPDATER PUBLIC KEY:');
  console.log('======================================================');
  console.log(pubKey);
  console.log('======================================================\n');
  console.log('Add the following to your .env.release file:');
  console.log(`TAURI_SIGNING_PRIVATE_KEY="${privateKeyPath}"`);
  console.log(`GAMESKY_UPDATER_PUBKEY="${pubKey}"\n`);
}
