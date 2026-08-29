export interface SaveFileInfo {
  fileName: string;
  filePath: string;
  relativePath: string;
  sizeBytes: number;
  modifiedTimestamp: number;
}

export interface SaveBackupInfo {
  id: string;
  name: string;
  folderPath: string;
  timestamp: number;
  fileCount: number;
}

export class SaveManager {
  private static isTauri(): boolean {
    return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  }

  public static async scanGameSaves(gameDir: string): Promise<SaveFileInfo[]> {
    if (this.isTauri() && gameDir) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<SaveFileInfo[]>('scan_game_saves', { gameDir });
      } catch (err) {
        console.warn('Failed to scan game saves:', err);
      }
    }
    return [];
  }

  public static async listCheckpoints(gameId: string): Promise<SaveBackupInfo[]> {
    if (this.isTauri() && gameId) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<SaveBackupInfo[]>('list_save_backups', { gameId });
      } catch (err) {
        console.warn('Failed to list save backups:', err);
      }
    }
    return [];
  }

  public static async createCheckpoint(gameId: string, gameDir: string, name: string): Promise<SaveBackupInfo> {
    if (this.isTauri() && gameId && gameDir) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<SaveBackupInfo>('create_save_backup', {
          gameId,
          gameDir,
          backupName: name || 'Checkpoint'
        });
      } catch (err) {
        console.warn('Failed to create save backup in Tauri:', err);
        throw new Error(`Failed to create checkpoint: ${String(err)}`);
      }
    }

    throw new Error('Save checkpoints require the native Tauri app.');
  }

  public static async restoreCheckpoint(gameId: string, gameDir: string, backupFolder: string): Promise<boolean> {
    if (this.isTauri() && gameDir && backupFolder) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<boolean>('restore_save_backup', { gameId, gameDir, backupFolder });
      } catch (err) {
        console.warn('Failed to restore save backup:', err);
        return false;
      }
    }
    return false;
  }

  public static async deleteCheckpoint(gameId: string, backupFolder: string, checkpointId: string): Promise<boolean> {
    if (this.isTauri() && backupFolder) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<boolean>('delete_save_backup', { gameId, backupFolder });
      } catch (err) {
        console.warn('Failed to delete save backup:', err);
        return false;
      }
    }
    void gameId;
    void checkpointId;
    return false;
  }

  public static async openInFinder(folderPath: string): Promise<boolean> {
    if (this.isTauri() && folderPath) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<boolean>('open_folder_in_finder', { folderPath });
      } catch (err) {
        console.warn('Failed to open in finder:', err);
      }
    }
    return false;
  }

  public static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  public static formatTimestamp(sec: number): string {
    if (!sec) return 'Unknown';
    const d = new Date(sec * 1000);
    return d.toLocaleString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}
