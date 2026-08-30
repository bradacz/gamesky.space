export interface ArtworkLookup {
  title: string;
  year?: number | string;
  coverImage?: string;
  catalogIdentifier?: string;
  catalogSource?: 'internet-archive' | 'freedos';
}

const LIBRETRO_BOXART_BASE = 'https://thumbnails.libretro.com/DOS/Named_Boxarts/';

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*\((?:shareware|freeware|demo|dos)\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function libretroFileTitle(title: string): string {
  // Libretro replaces filename-hostile characters with underscores.
  return title.replace(/[&*\/:`<>?"\\|]/g, '_').trim();
}

function titleVariants(title: string): string[] {
  const cleaned = cleanTitle(title);
  const variants = [cleaned];
  const article = cleaned.match(/^(The|A|An)\s+(.+)$/i);
  if (article) variants.push(`${article[2]}, ${article[1]}`);
  return unique(variants.map(libretroFileTitle));
}

function isTrustedArtworkUrl(value: string): boolean {
  if (value.startsWith('data:image/')) return true;
  if (value.startsWith('asset:') || value.startsWith('http://asset.localhost/') || value.startsWith('https://asset.localhost/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (
      url.hostname === 'thumbnails.libretro.com'
      || url.hostname === 'archive.org'
      || url.hostname.endsWith('.archive.org')
    );
  } catch {
    return false;
  }
}

export class ArtworkService {
  public static isRemoteArtwork(value: string): boolean {
    return value.startsWith('https://');
  }

  public static async cache(gameId: string, sourceUrl: string): Promise<string | null> {
    if (!this.isRemoteArtwork(sourceUrl)
      || typeof window === 'undefined'
      || !('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) return null;
    try {
      const [{ invoke }, { convertFileSrc }] = await Promise.all([
        import('@tauri-apps/api/core'),
        import('@tauri-apps/api/core')
      ]);
      const localPath = await invoke<string>('cache_artwork', { gameId, sourceUrl });
      return convertFileSrc(localPath);
    } catch (error) {
      console.warn('Artwork cache failed:', error);
      return null;
    }
  }
  /** Copies a local image into the artwork cache and returns its asset URL. */
  public static async importLocalFile(gameId: string, sourcePath: string): Promise<string | null> {
    if (typeof window === 'undefined'
      || !('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) return null;
    const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
    const localPath = await invoke<string>('import_artwork_file', { gameId, sourcePath });
    return convertFileSrc(localPath);
  }

  public static candidates(item: ArtworkLookup): string[] {
    const year = item.year ? String(item.year).match(/\d{4}/)?.[0] : undefined;
    const libretroCandidates = titleVariants(item.title).flatMap(title => [
      year ? `${LIBRETRO_BOXART_BASE}${encodeURIComponent(`${title} (${year}).png`)}` : '',
      `${LIBRETRO_BOXART_BASE}${encodeURIComponent(`${title}.png`)}`
    ]);

    const archiveCandidates = item.catalogSource === 'internet-archive' && item.catalogIdentifier
      ? [`https://archive.org/services/img/${encodeURIComponent(item.catalogIdentifier)}`]
      : [];

    const existing = item.coverImage && isTrustedArtworkUrl(item.coverImage)
      ? [item.coverImage]
      : [];

    // Reuse a verified working URL first. New profiles try scanned DOS box art,
    // with Internet Archive as the real-image fallback for catalog installs.
    return unique([...existing, ...libretroCandidates, ...archiveCandidates]);
  }

  public static loadInto(
    image: HTMLImageElement,
    candidates: string[],
    onLoaded?: (url: string) => void,
    onExhausted?: () => void
  ): void {
    let index = 0;

    const tryNext = () => {
      if (index >= candidates.length) {
        image.hidden = true;
        image.removeAttribute('src');
        onExhausted?.();
        return;
      }
      image.hidden = true;
      image.src = candidates[index++];
    };

    image.onload = () => {
      image.hidden = false;
      onLoaded?.(image.currentSrc || image.src);
    };
    image.onerror = tryNext;
    tryNext();
  }

  public static titleFallback(title: string, sourceLabel = 'DOS'): string {
    const safeTitle = title.trim().slice(0, 28) || 'DOS GAME';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300" viewBox="0 0 420 300">
      <rect width="420" height="300" fill="#071b70"/>
      <path d="M0 30h420M0 90h420M0 150h420M0 210h420M0 270h420M30 0v300M90 0v300M150 0v300M210 0v300M270 0v300M330 0v300M390 0v300" stroke="#0d3a9d" stroke-width="2"/>
      <rect x="24" y="28" width="372" height="244" rx="4" fill="#06134e" stroke="#40e5eb" stroke-width="4"/>
      <text x="210" y="124" fill="#fff36a" text-anchor="middle" font-family="monospace" font-size="30" font-weight="bold">${this.escapeSvg(safeTitle)}</text>
      <text x="210" y="181" fill="#55ffff" text-anchor="middle" font-family="monospace" font-size="19">${this.escapeSvg(sourceLabel)}</text>
      <text x="210" y="224" fill="#d8f7f7" text-anchor="middle" font-family="monospace" font-size="13">ARTWORK NOT FOUND</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  private static escapeSvg(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
