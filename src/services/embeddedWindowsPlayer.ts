import { WindowsRuntime } from './windowsRuntime';
import type { GameProfile } from '../types';
import type { AppPreferences } from './storage';
import type { LaunchResult } from './emulatorLauncher';

/** A native child WebView renders the game inside the existing GameSky window. */
export class EmbeddedWindowsPlayer {
  private static active = false;

  static async open(game: GameProfile, prefs: AppPreferences, report?: (message: string) => void): Promise<LaunchResult> {
    if (this.active) return { success: false, message: 'Close the current game before starting another.' };
    this.active = true;
    let unlisten: (() => void) | undefined;
    try {
      await WindowsRuntime.ensureReady(report);
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen('embedded-player-ended', () => {
        this.active = false;
        unlisten?.();
      });
      const launch = await invoke<{ url: string; sessionId: number }>('start_embedded_game', {
        gameDir: game.drives.cDrivePath, workingDir: game.workingDir || '',
        executable: game.executable, gameId: game.id, language: prefs.language
      });
      return { success: true, message: 'Started inside GameSky.', sessionId: launch.sessionId };
    } catch (error) {
      this.active = false;
      unlisten?.();
      return { success: false, message: String(error) };
    }
  }
}
