import { GameProfile } from '../types';
import { generateDosboxConf } from './confGenerator';
import { AppPreferences } from './storage';

export interface LaunchResult {
  success: boolean;
  message: string;
  commandExecuted?: string;
  confGenerated?: string;
  sessionId?: number;
}

export interface DosboxInstallation {
  name: string;
  path: string;
  emulatorType: string;
  exists: boolean;
}

interface PreparedGameLaunch {
  cDrivePath: string;
  workingDir: string;
  executable: string;
  cdRomPath: string;
}

export interface DiscoveredGame {
  title: string;
  targetFolder: string;
  workingDir: string;
  executable: string;
  cdRomPath?: string;
}

export interface ExecutableCandidate {
  executable: string;
  workingDir: string;
  absolutePath: string;
  score: number;
  role: 'game' | 'installer' | 'configuration' | 'uninstaller' | 'windows';
  reason: string;
}

export interface DiagnosticItem {
  id: string;
  status: 'ok' | 'warning' | 'error';
  label: string;
  message: string;
  repairAction?: string;
}

export class EmulatorLauncher {
  public static isTauriEnvironment(): boolean {
    return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  }

  public static async detectInstallations(): Promise<DosboxInstallation[]> {
    if (this.isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const res = await invoke<DosboxInstallation[]>('detect_dosbox_installations');
        return res;
      } catch (err) {
        console.warn('Failed to detect dosbox installations:', err);
      }
    }
    return [
      { name: 'DOSBox (Default)', path: '/Applications/DOSBox.app/Contents/MacOS/DOSBox', emulatorType: 'dosbox', exists: false },
      { name: 'DOSBox Staging', path: '/Applications/DOSBox Staging.app/Contents/MacOS/dosbox', emulatorType: 'dosbox-staging', exists: false },
      { name: 'DOSBox-X', path: '/Applications/DOSBox-X.app/Contents/MacOS/dosbox-x', emulatorType: 'dosbox-x', exists: false },
      { name: 'Homebrew DOSBox', path: '/opt/homebrew/bin/dosbox', emulatorType: 'dosbox', exists: false }
    ];
  }

  /** Extractors that are not installed; Inno Setup packages need innoextract. */
  public static async missingUnpackTools(): Promise<string[]> {
    if (!this.isTauriEnvironment()) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string[]>('missing_unpack_tools').catch(() => []);
  }

  public static async scanLibraryEntries(baseDir: string): Promise<import('../types').LibraryEntry[]> {
    if (!this.isTauriEnvironment()) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<import('../types').LibraryEntry[]>('scan_library_entries', { baseDir });
  }

  public static async scanInstalledGames(baseDir: string): Promise<DiscoveredGame[]> {
    if (!this.isTauriEnvironment()) return [];
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<DiscoveredGame[]>('scan_installed_games', { baseDir });
    } catch (error) {
      console.warn('Failed to scan installed games:', error);
      return [];
    }
  }

  public static async launchGame(
    game: GameProfile,
    prefs: AppPreferences,
    options?: import('./confGenerator').GenerateConfOptions
  ): Promise<LaunchResult> {
    const emuType = game.settings.emulatorType || prefs.activeEmulator;
    
    let binaryPath = prefs.dosboxPath;
    if (emuType === 'dosbox-staging') binaryPath = prefs.dosboxStagingPath;
    if (emuType === 'dosbox-x') binaryPath = prefs.dosboxXPath;
    if (emuType === 'scummvm') binaryPath = prefs.scummvmPath;
    if (emuType === 'custom' && game.settings.customEmulatorPath) binaryPath = game.settings.customEmulatorPath;

    // ScummVM takes a game id and folder rather than a DOSBox conf, and its
    // games have no DOS executable to validate, so it skips prepareGame.
    if (emuType === 'scummvm') {
      return this.launchScummvmGame(game, binaryPath);
    }

    if (this.isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const preparedGame = await this.prepareGame(game);
        
        let toolsMountPath = options?.toolsMountPath;
        const customNC = options?.customNortonCommanderPath || prefs.customNortonCommanderPath;
        if (options?.mode === 'file-manager' && !toolsMountPath) {
          if (customNC && customNC.trim() !== '') {
            const trimmed = customNC.trim();
            if (/\.(exe|com|bat)$/i.test(trimmed)) {
              const lastSlash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
              toolsMountPath = lastSlash > 0 ? trimmed.substring(0, lastSlash) : trimmed;
            } else {
              toolsMountPath = trimmed;
            }
          } else {
            toolsMountPath = await this.ensureDosTools();
          }
        }

        const conf = generateDosboxConf(preparedGame, {
          ...options,
          toolsMountPath,
          customNortonCommanderPath: options?.customNortonCommanderPath || prefs.customNortonCommanderPath
        });

        const res = await invoke<LaunchResult>('launch_dosbox_command', {
          binaryPath,
          confContent: conf,
          gameTitle: game.title,
          gameId: game.id,
          emulatorType: emuType
        });
        return res;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          message: message || 'The game could not be prepared for launch.'
        };
      }
    }

    // Web / Standalone mode fallback
    const conf = generateDosboxConf(game, options);
    const cliCommand = `"${binaryPath}" -conf dosbox_${game.id}.conf`;
    return {
      success: true,
      message: `Generated DOSBox configuration for "${game.title}".`,
      commandExecuted: cliCommand,
      confGenerated: conf
    };
  }

  private static async launchScummvmGame(game: GameProfile, binaryPath: string): Promise<LaunchResult> {
    if (!this.isTauriEnvironment()) {
      return {
        success: false,
        message: 'Native environment is required to start ScummVM.'
      };
    }
    const gameDir = game.drives.cDrivePath;
    if (!gameDir || gameDir.trim() === '') {
      return { success: false, message: 'The game folder is not configured.' };
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      let targetId = game.scummvmGameId;
      if (!targetId || targetId.trim() === '') {
        const detected = await invoke<{ gameId: string; description: string; path: string } | null>(
          'detect_scummvm_game',
          { binaryPath, gameDir }
        );
        if (!detected) {
          return {
            success: false,
            message: 'ScummVM did not recognise a game in this folder.'
          };
        }
        targetId = detected.gameId;
      }
      return await invoke<LaunchResult>('launch_scummvm_command', {
        binaryPath,
        gameDir,
        scummvmGameId: targetId,
        gameTitle: game.title,
        gameId: game.id,
        fullscreen: game.settings.fullscreen === true
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: message || 'ScummVM could not be started.' };
    }
  }

  /** Asks ScummVM to identify the game in a folder; null when it recognises none. */
  public static async detectScummvmGame(
    binaryPath: string,
    gameDir: string
  ): Promise<{ gameId: string; description: string; path: string } | null> {
    if (!this.isTauriEnvironment()) return null;
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<{ gameId: string; description: string; path: string } | null>('detect_scummvm_game', {
      binaryPath,
      gameDir
    });
  }

  public static async launchFileManager(game: GameProfile, prefs: AppPreferences): Promise<LaunchResult> {
    return this.launchGame(game, prefs, {
      mode: 'file-manager',
      customNortonCommanderPath: prefs.customNortonCommanderPath
    });
  }

  public static async launchInstaller(
    game: GameProfile,
    executable: string,
    workingDir: string,
    prefs: AppPreferences
  ): Promise<LaunchResult> {
    return this.launchGame(game, prefs, {
      mode: 'installer',
      overrideExecutable: executable,
      overrideWorkingDir: workingDir
    });
  }

  public static async ensureDosTools(): Promise<string> {
    if (!this.isTauriEnvironment()) return '';
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('ensure_dos_tools');
    } catch (err) {
      console.warn('Failed to ensure DOS tools folder:', err);
      return '';
    }
  }

  public static async scanGameArchives(gameDir: string): Promise<import('../types').DiscoveredArchiveItem[]> {
    if (!this.isTauriEnvironment()) return [];
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<import('../types').DiscoveredArchiveItem[]>('scan_game_archives', { gameDir });
    } catch (err) {
      console.warn('Failed to scan game archives:', err);
      return [];
    }
  }

  public static async unpackGameArchive(
    archivePath: string,
    destinationFolder: string,
    flattenSingleRoot = true,
    deleteArchiveAfter = false
  ): Promise<import('../types').UnpackArchiveResult> {
    if (!this.isTauriEnvironment()) {
      return {
        success: false,
        message: 'Native environment is required to unpack archives.',
        extractedFilesCount: 0,
        installerCandidates: []
      };
    }
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<import('../types').UnpackArchiveResult>('unpack_game_archive', {
      archivePath,
      destinationFolder,
      flattenSingleRoot,
      deleteArchiveAfter
    });
  }

  public static async prepareGame(game: GameProfile): Promise<GameProfile> {
    if (!this.isTauriEnvironment()) return game;

    const { invoke } = await import('@tauri-apps/api/core');
    const managedItems = (game.drives.mediaSets || []).flatMap(set => set.items);
    let preparedMediaSets = game.drives.mediaSets;
    if (managedItems.length > 0) {
      const validated = await invoke<string[]>('validate_media_paths', {
        items: managedItems.map(item => ({ path: item.path, kind: item.kind }))
      });
      let index = 0;
      preparedMediaSets = (game.drives.mediaSets || []).map(set => ({
        ...set,
        items: set.items.map(item => ({ ...item, path: validated[index++] || item.path }))
      }));
    }
    const prepared = await invoke<PreparedGameLaunch>('prepare_game_launch', {
      gameDir: game.drives.cDrivePath,
      workingDir: game.workingDir || '',
      executable: game.executable,
      cdRomPath: managedItems.length > 0 ? '' : game.drives.cdRomPath || ''
    });
    return {
      ...game,
      executable: prepared.executable,
      workingDir: prepared.workingDir,
      drives: {
        ...game.drives,
        cDrivePath: prepared.cDrivePath,
        cdRomPath: prepared.cdRomPath,
        mediaSets: preparedMediaSets
      }
    };
  }

  public static async inspectGameFolder(gameDir: string): Promise<ExecutableCandidate[]> {
    if (!this.isTauriEnvironment()) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<ExecutableCandidate[]>('inspect_game_folder', { gameDir });
  }

  public static async diagnoseGame(game: GameProfile, prefs: AppPreferences): Promise<DiagnosticItem[]> {
    if (!this.isTauriEnvironment()) return [];
    const emuType = game.settings.emulatorType || prefs.activeEmulator;
    const binaryPath = emuType === 'dosbox-staging'
      ? prefs.dosboxStagingPath
      : emuType === 'dosbox-x'
        ? prefs.dosboxXPath
        : emuType === 'custom'
          ? game.settings.customEmulatorPath || ''
          : prefs.dosboxPath;
    const mediaPaths = (game.drives.mediaSets || []).flatMap(set =>
      set.items.map(item => ({ path: item.path, kind: item.kind }))
    );
    if (mediaPaths.length === 0) {
      if (game.drives.cdRomPath) mediaPaths.push({ path: game.drives.cdRomPath, kind: 'cdrom' });
      if (game.drives.floppyPath) mediaPaths.push({ path: game.drives.floppyPath, kind: 'floppy' });
    }
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<DiagnosticItem[]>('diagnose_game', {
      binaryPath,
      gameDir: game.drives.cDrivePath,
      workingDir: game.workingDir || '',
      executable: game.executable,
      mediaPaths
    });
  }

  public static async browseForEmulator(title: string = 'Select DOSBox App or Binary'): Promise<string | null> {
    let selected = await this.browseForFile({
      title,
      extensions: ['app', '', 'exe', 'bin']
    });

    if (!selected) {
      selected = await this.browseForFolder(title);
    }

    if (selected) {
      // If user selected /Applications/DOSBox.app (or similar bundle), auto-append inner MacOS binary
      if (selected.endsWith('.app')) {
        const appName = selected.split('/').pop()?.replace('.app', '') || '';
        if (appName.toLowerCase().includes('staging')) {
          return `${selected}/Contents/MacOS/dosbox`;
        } else if (appName.toLowerCase().includes('x')) {
          return `${selected}/Contents/MacOS/dosbox-x`;
        } else {
          return `${selected}/Contents/MacOS/DOSBox`;
        }
      }
      return selected;
    }
    return null;
  }

  public static async browseForFile(options?: { title?: string; extensions?: string[] }): Promise<string | null> {
    if (this.isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const selected = await invoke<string | null>('pick_file_native', {
          title: options?.title || 'Select File',
          extensions: options?.extensions || ['iso', 'cue', 'bin', 'img', 'exe', 'bat', 'com', 'app']
        });
        // The native picker answered; null means the user cancelled. Falling
        // through would reopen a second picker whose result is a bare filename.
        return selected ?? null;
      } catch (err) {
        console.warn('Native pick_file_native failed, trying dialog plugin:', err);
        try {
          const { open } = await import('@tauri-apps/plugin-dialog');
          const res = await open({
            multiple: false,
            directory: false,
            title: options?.title || 'Select File',
            filters: options?.extensions ? [{ name: 'Allowed Files', extensions: options.extensions }] : undefined
          });
          if (typeof res === 'string') return res;
        } catch (dialogErr) {
          console.warn('Dialog plugin failed:', dialogErr);
        }
      }
    }

    // HTML5 File / Prompt fallback
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (options?.extensions) {
        input.accept = options.extensions.map(e => `.${e}`).join(',');
      }
      input.onchange = () => {
        if (input.files && input.files[0]) {
          const file = input.files[0];
          resolve(file.name);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  }

  public static async browseForFiles(options?: { title?: string; extensions?: string[] }): Promise<string[]> {
    if (this.isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string[]>('pick_files_native', {
          title: options?.title || 'Select Files',
          extensions: options?.extensions || ['iso', 'cue', 'img', 'ima', 'vfd']
        });
      } catch (error) {
        console.warn('Native multi-file picker failed:', error);
      }
    }
    const selected = await this.browseForFile(options);
    return selected ? [selected] : [];
  }

  public static async browseForFolder(title?: string): Promise<string | null> {
    if (this.isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const selected = await invoke<string | null>('pick_folder_native', {
          title: title || 'Select Folder for Drive C:'
        });
        if (selected) return selected;
      } catch (err) {
        console.warn('Native pick_folder_native failed, trying dialog plugin:', err);
        try {
          const { open } = await import('@tauri-apps/plugin-dialog');
          const res = await open({
            multiple: false,
            directory: true,
            title: title || 'Select Folder'
          });
          if (typeof res === 'string') return res;
        } catch (dialogErr) {
          console.warn('Dialog plugin failed:', dialogErr);
        }
      }
    }

    const mock = window.prompt(title || 'Enter absolute path to folder on your Mac (Drive C:):');
    return mock ? mock.trim() : null;
  }
}
