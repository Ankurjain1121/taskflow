import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

export interface KeyboardShortcut {
  key: string;
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
  private enabled = true;
  private listener: ((e: KeyboardEvent) => void) | null = null;

  readonly helpRequested$ = new Subject<void>();

  constructor() {
    this.listener = (e: KeyboardEvent) => this.handleKeydown(e);
    document.addEventListener('keydown', this.listener);
  }

  ngOnDestroy(): void {
    if (this.listener) {
      document.removeEventListener('keydown', this.listener);
    }
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

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
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
    if (!this.enabled) return;

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
      this.helpRequested$.next();
      return;
    }

    for (const shortcut of this.shortcuts.values()) {
      if (this.matches(e, shortcut)) {
        e.preventDefault();
        shortcut.action();
        return;
      }
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
    return parts.join(' + ');
  }
}
