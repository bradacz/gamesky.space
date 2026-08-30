import { GameProfile, EmulationSettings } from '../types';

export interface AppPreferences {
  dosboxPath: string;
  dosboxStagingPath: string;
  dosboxXPath: string;
  scummvmPath: string;
  activeEmulator: 'dosbox' | 'dosbox-staging' | 'dosbox-x' | 'scummvm' | 'custom';
  defaultCDrive: string;
  crtFilterEnabled: boolean;
  soundEffectsEnabled: boolean;
  theme: 'classic-win95' | 'norton-blue' | 'dos-matrix' | 'dos-amber' | 'apple-light';
  setupCompleted: boolean;
  language: 'en' | 'cs';
  automaticArtwork: boolean;
  checkForUpdates: boolean;
  customNortonCommanderPath?: string;
  deleteArchiveAfterUnpack?: boolean;
  /** Folders in the library directory the startup scan must not re-add. */
  ignoredFolders?: string[];
}

export interface NativeDatabaseStatus {
  path: string;
  schemaVersion: number;
  gameCount: number;
}

export interface NativeLibraryState {
  games: GameProfile[];
  preferences: AppPreferences;
  database: NativeDatabaseStatus;
}

const PREFS_STORAGE_KEY = 'dosbox_retro_studio_prefs';
const GAMES_STORAGE_KEY = 'dosbox_retro_studio_games';

// These exact rows were shipped as visual placeholders by an older version.
// They are migrated away once and are never used as game data.
const LEGACY_DEMO_PROFILES = new Map<string, string>([
  ['game-doom2', '~/DOSGAMES/DOOM2'],
  ['game-duke3d', '~/DOSGAMES/DUKE3D'],
  ['game-warcraft2', '~/DOSGAMES/WAR2'],
  ['game-monkey2', '~/DOSGAMES/MONKEY2'],
  ['game-prince', '~/DOSGAMES/PRINCE']
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUninstalledLegacyDemo(game: GameProfile): boolean {
  return LEGACY_DEMO_PROFILES.get(game.id) === game.drives.cDrivePath;
}

function normalizeGameProfile(value: unknown, index: number): GameProfile | null {
  if (!isRecord(value) || typeof value.title !== 'string' || value.title.trim() === '') {
    return null;
  }

  const rawDrives = isRecord(value.drives) ? value.drives : {};
  const rawSettings = isRecord(value.settings) ? value.settings : {};
  const rawId = typeof value.id === 'string' ? value.id : '';
  const id = /^[A-Za-z0-9_-]{1,160}$/.test(rawId)
    ? rawId
    : `game-imported-${Date.now()}-${index}`;

  return {
    ...(value as unknown as Partial<GameProfile>),
    id,
    title: value.title.trim(),
    executable: typeof value.executable === 'string' ? value.executable : '',
    workingDir: typeof value.workingDir === 'string' ? value.workingDir : '',
    drives: {
      cDrivePath: typeof rawDrives.cDrivePath === 'string' ? rawDrives.cDrivePath : '',
      cdRomPath: typeof rawDrives.cdRomPath === 'string' ? rawDrives.cdRomPath : '',
      floppyPath: typeof rawDrives.floppyPath === 'string' ? rawDrives.floppyPath : '',
      mediaSets: Array.isArray(rawDrives.mediaSets)
        ? rawDrives.mediaSets as GameProfile['drives']['mediaSets']
        : undefined,
      mountExtraDrives: Array.isArray(rawDrives.mountExtraDrives)
        ? rawDrives.mountExtraDrives as GameProfile['drives']['mountExtraDrives']
        : undefined
    },
    settings: {
      ...DEFAULT_EMULATION_SETTINGS,
      ...rawSettings
    } as EmulationSettings,
    installationState: typeof value.installationState === 'string'
      ? value.installationState as GameProfile['installationState']
      : 'ready',
    collections: Array.isArray(value.collections) ? value.collections as string[] : [],
    playTimeSeconds: typeof value.playTimeSeconds === 'number'
      ? value.playTimeSeconds
      : typeof value.playTimeMinutes === 'number' ? value.playTimeMinutes * 60 : 0,
    playCount: typeof value.playCount === 'number' ? value.playCount : 0,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now()
  } as GameProfile;
}

export const DEFAULT_EMULATION_SETTINGS: EmulationSettings = {
  emulatorType: 'dosbox',
  cpuCore: 'auto',
  cpuType: 'auto',
  cycles: 20000,
  cycleUp: 1000,
  cycleDown: 1000,
  machine: 'svga_s3',
  scaler: 'normal2x',
  aspectCorrection: true,
  fullscreen: false,
  windowResolution: '1280x960',
  renderOutput: 'opengl',
  memSizeMb: 32,
  soundBlaster: 'sb16',
  sbPort: '220',
  sbIrq: 7,
  sbDma: 1,
  sbHdma: 5,
  enableGus: false,
  enableMidi: true,
  midiDevice: 'default',
  enablePcSpeaker: true
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  dosboxPath: '/Applications/DOSBox.app/Contents/MacOS/DOSBox',
  dosboxStagingPath: '/Applications/DOSBox Staging.app/Contents/MacOS/dosbox',
  dosboxXPath: '/Applications/DOSBox-X.app/Contents/MacOS/dosbox-x',
  scummvmPath: '/Applications/ScummVM.app/Contents/MacOS/scummvm',
  activeEmulator: 'dosbox',
  defaultCDrive: '~/DOSGAMES',
  crtFilterEnabled: false,
  soundEffectsEnabled: true,
  theme: 'apple-light',
  setupCompleted: false,
  language: 'en',
  automaticArtwork: true,
  checkForUpdates: true,
  customNortonCommanderPath: '',
  deleteArchiveAfterUnpack: false,
  ignoredFolders: []
};

export class StorageService {
  private static nativeReady = false;
  private static nativeWriteQueue: Promise<void> = Promise.resolve();

  private static isTauri(): boolean {
    return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  }

  public static async initializeNativePersistence(): Promise<NativeLibraryState | null> {
    if (!this.isTauri()) return null;

    const legacyGames = this.loadGames();
    const legacyPreferences = this.loadPreferences();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke<NativeDatabaseStatus>('database_initialize');
      const database = await invoke<NativeDatabaseStatus>('database_import_legacy', {
        gamesJson: JSON.stringify(legacyGames),
        preferencesJson: JSON.stringify(legacyPreferences)
      });
      const gamesJson = await invoke<string>('database_load_games');
      const preferencesJson = await invoke<string | null>('database_load_preferences');
      const parsedGames = JSON.parse(gamesJson);
      const games = Array.isArray(parsedGames)
        ? parsedGames
            .map(normalizeGameProfile)
            .filter((game): game is GameProfile => game !== null)
            .filter(game => !isUninstalledLegacyDemo(game))
        : [];
      const parsedPreferences = preferencesJson ? JSON.parse(preferencesJson) : legacyPreferences;
      const preferences = { ...DEFAULT_PREFERENCES, ...parsedPreferences } as AppPreferences;

      this.nativeReady = true;
      localStorage.setItem(GAMES_STORAGE_KEY, JSON.stringify(games));
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(preferences));
      return { games, preferences, database };
    } catch (error) {
      console.error('Native GameSky.space database initialization failed:', error);
      this.nativeReady = false;
      return null;
    }
  }

  private static enqueueNativeWrite(command: string, payload: Record<string, unknown>): void {
    if (!this.nativeReady || !this.isTauri()) return;
    this.nativeWriteQueue = this.nativeWriteQueue
      .catch(() => undefined)
      .then(async () => {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke(command, payload);
      })
      .catch(error => {
        console.error(`Native persistence command '${command}' failed:`, error);
      });
  }

  public static loadPreferences(): AppPreferences {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULT_PREFERENCES };
  }

  public static savePreferences(prefs: AppPreferences): void {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
    this.enqueueNativeWrite('database_save_preferences', {
      preferencesJson: JSON.stringify(prefs)
    });
  }

  public static loadGames(): GameProfile[] {
    try {
      const raw = localStorage.getItem(GAMES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map(normalizeGameProfile)
            .filter((game): game is GameProfile => game !== null)
            .filter(game => !isUninstalledLegacyDemo(game));
          this.saveGames(normalized);
          return normalized;
        }
      }
    } catch {}

    this.saveGames([]);
    return [];
  }

  public static saveGames(games: GameProfile[]): void {
    try {
      localStorage.setItem(GAMES_STORAGE_KEY, JSON.stringify(games));
    } catch {}
    this.enqueueNativeWrite('database_save_games', {
      gamesJson: JSON.stringify(games)
    });
  }

  public static exportLibraryAsJson(games: GameProfile[]): string {
    return JSON.stringify(games, null, 2);
  }

  public static importLibraryFromJson(jsonStr: string): GameProfile[] | null {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map(normalizeGameProfile)
          .filter((game): game is GameProfile => game !== null)
          .filter(game => !isUninstalledLegacyDemo(game));
        this.saveGames(normalized);
        return normalized;
      }
    } catch {}
    return null;
  }
}
