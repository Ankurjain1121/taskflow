import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root',
})
export class BadgeService {
  private badgePlugin: typeof import('@capawesome/capacitor-badge').Badge | null =
    null;
  private initialized = false;

  /**
   * Lazily load the badge plugin only on native platforms.
   */
  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (Capacitor.isNativePlatform()) {
      try {
        const mod = await import('@capawesome/capacitor-badge');
        this.badgePlugin = mod.Badge;
      } catch {
        // Plugin not available on this platform
        this.badgePlugin = null;
      }
    }
  }

  async set(count: number): Promise<void> {
    await this.init();
    if (!this.badgePlugin) return;

    try {
      await this.badgePlugin.set({ count });
    } catch {
      // Badge not supported — silently ignore
    }
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.badgePlugin) return;

    try {
      await this.badgePlugin.clear();
    } catch {
      // Badge not supported — silently ignore
    }
  }
}
