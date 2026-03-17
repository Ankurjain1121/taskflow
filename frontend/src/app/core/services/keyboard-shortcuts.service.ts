import { Injectable, OnDestroy, signal } from '@angular/core';

export interface KeyboardShortcut {
  key: string;
  /** For multi-key sequences like "G then D", set prefix to the first key */
  prefix?: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: string;
  action: () => void;
}

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService implements OnDestroy {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private disableCount = 0;
  private listener: ((e: KeyboardEvent) => void) | null = null;
  private pendingPrefix: string | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly SEQUENCE_TIMEOUT_MS = 500;

  readonly helpRequested = signal(0);

  readonly recentlyUsedIds = signal<string[]>([]);

  markUsed(description: string): void {
    const arr = [
      description,
      ...this.recentlyUsedIds().filter((x) => x !== description),
    ].slice(0, 5);
    this.recentlyUsedIds.set(arr);
  }

  constructor() {
    this.listener = (e: KeyboardEvent) => this.handleKeydown(e);
    document.addEventListener('keydown', this.listener);
  }

  ngOnDestroy(): void {
    if (this.listener) {
      document.removeEventListener('keydown', this.listener);
    }
    this.clearPending();
  }

  register(id: string, shortcut: KeyboardShortcut): void {
    this.shortcuts.set(id, shortcut);
  }

  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  unregisterByCategory(category: string): void {
    for (const [id, s] of this.shortcuts) {
      if (s.category === category) {
        this.shortcuts.delete(id);
      }
    }
  }

  pushDisable(): void {
    this.disableCount++;
  }

  popDisable(): void {
    this.disableCount = Math.max(0, this.disableCount - 1);
  }

  getAll(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  getByCategory(): Map<string, KeyboardShortcut[]> {
    const grouped = new Map<string, KeyboardShortcut[]>();
    for (const s of this.shortcuts.values()) {
      const list = grouped.get(s.category) || [];
      list.push(s);
      grouped.set(s.category, list);
    }
    return grouped;
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.disableCount > 0) return;

    // Don't intercept when typing in inputs/textareas/contenteditable
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      // Allow Escape in inputs
      if (e.key !== 'Escape') return;
    }

    // Show help on ?
    if (e.key === '?' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.helpRequested.update((n) => n + 1);
      return;
    }

    const key = e.key.toLowerCase();

    // If we have a pending prefix, try to match a sequence shortcut
    if (this.pendingPrefix) {
      const prefix = this.pendingPrefix;
      this.clearPending();

      for (const shortcut of this.shortcuts.values()) {
        if (
          shortcut.prefix?.toLowerCase() === prefix &&
          shortcut.key.toLowerCase() === key &&
          !e.ctrlKey &&
          !e.altKey
        ) {
          e.preventDefault();
          shortcut.action();
          this.markUsed(shortcut.description);
          return;
        }
      }
      // No matching sequence, fall through to single-key matching
    }

    // Check if this key is a prefix for any sequence shortcut
    const isPrefix = Array.from(this.shortcuts.values()).some(
      (s) => s.prefix?.toLowerCase() === key,
    );
    if (isPrefix && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      this.pendingPrefix = key;
      this.pendingTimer = setTimeout(
        () => this.clearPending(),
        KeyboardShortcutsService.SEQUENCE_TIMEOUT_MS,
      );
      return;
    }

    // Single-key shortcuts
    for (const shortcut of this.shortcuts.values()) {
      if (!shortcut.prefix && this.matches(e, shortcut)) {
        e.preventDefault();
        shortcut.action();
        this.markUsed(shortcut.description);
        return;
      }
    }
  }

  private clearPending(): void {
    this.pendingPrefix = null;
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  private matches(e: KeyboardEvent, s: KeyboardShortcut): boolean {
    if (e.key.toLowerCase() !== s.key.toLowerCase()) return false;
    if (!!s.ctrl !== e.ctrlKey) return false;
    if (!!s.shift !== e.shiftKey) return false;
    if (!!s.alt !== e.altKey) return false;
    return true;
  }

  formatShortcut(s: KeyboardShortcut): string {
    const parts: string[] = [];
    if (s.ctrl) parts.push('Ctrl');
    if (s.alt) parts.push('Alt');
    if (s.shift) parts.push('Shift');
    parts.push(s.key.length === 1 ? s.key.toUpperCase() : s.key);
    const combo = parts.join('+');
    return s.prefix ? `${s.prefix.toUpperCase()} then ${combo}` : combo;
  }
}
