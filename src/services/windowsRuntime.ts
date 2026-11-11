/** Optional shared runtime: lazy installation, one download for concurrent callers. */
export class WindowsRuntime {
  private static pending: Promise<void> | undefined;

  static ensureReady(report: (message: string) => void = () => {}): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = this.installIfMissing(report).finally(() => { this.pending = undefined; });
    return this.pending;
  }

  private static async installIfMissing(report: (message: string) => void): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    if (await invoke<boolean>('embedded_runtime_status')) return;
    report('Preparing Windows support — downloading the free engine…');
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<number>('windows-install-progress', event => {
      report(event.payload < 100 ? `Preparing Windows support: ${event.payload}%` : 'Verifying and installing Windows support…');
    });
    try {
      await invoke('install_embedded_runtime');
      report('Windows support ready.');
    } finally { unlisten(); }
  }
}
