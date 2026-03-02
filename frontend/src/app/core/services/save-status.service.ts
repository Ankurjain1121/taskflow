import { Injectable, signal, computed } from '@angular/core';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

@Injectable({
  providedIn: 'root',
})
export class SaveStatusService {
  private readonly pendingCount = signal(0);
  private readonly lastState = signal<SaveState>('idle');
  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  readonly state = computed<SaveState>(() => {
    if (this.pendingCount() > 0) return 'saving';
    return this.lastState();
  });

  markSaving(): void {
    this.pendingCount.update((c) => c + 1);
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
  }

  markSaved(): void {
    this.pendingCount.update((c) => Math.max(0, c - 1));
    if (this.pendingCount() === 0) {
      this.lastState.set('saved');
      this.scheduleClear(2000);
    }
  }

  markError(): void {
    this.pendingCount.update((c) => Math.max(0, c - 1));
    this.lastState.set('error');
    this.scheduleClear(5000);
  }

  private scheduleClear(ms: number): void {
    if (this.clearTimer) clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(() => {
      this.lastState.set('idle');
      this.clearTimer = null;
    }, ms);
  }
}
