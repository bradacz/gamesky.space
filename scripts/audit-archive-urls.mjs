import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/services/archiveDownloader.ts', import.meta.url), 'utf8');
const archiveUrls = [...new Set(
  [...source.matchAll(/https:\/\/[^"'\s]+\.zip/g)]
    .map(match => match[0])
    .filter(url => !url.includes('${'))
)];
const freeDosSource = await readFile(new URL('../src/database/freedosCatalog.ts', import.meta.url), 'utf8');
const freeDosPackages = [...freeDosSource.matchAll(/package: '([a-z0-9_]+)'/g)].map(match => match[1]);
const freeDosBase = 'https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/repositories/1.4/games';
const urls = [...archiveUrls, ...freeDosPackages.map(packageName => `${freeDosBase}/${packageName}.zip`)];
const concurrency = 6;
const results = new Array(urls.length);
let nextIndex = 0;

async function checkUrl(url) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
      headers: { 'user-agent': 'GameSky-space-Audit/1.0' }
    });
    return {
      url,
      ok: response.ok,
      status: response.status,
      type: response.headers.get('content-type') || '',
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: 0,
      type: '',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function worker() {
  while (nextIndex < urls.length) {
    const index = nextIndex++;
    results[index] = await checkUrl(urls[index]);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));

const failed = results.filter(result => !result.ok);
for (const result of failed) {
  console.error(`FAIL ${result.status || 'ERR'} ${result.url}${result.error ? ` — ${result.error}` : ''}`);
}
console.log(`Checked ${results.length} catalog ZIP URLs (${archiveUrls.length} Internet Archive, ${freeDosPackages.length} FreeDOS): ${results.length - failed.length} available, ${failed.length} unavailable.`);

process.exitCode = failed.length > 0 ? 1 : 0;
