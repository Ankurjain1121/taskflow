import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { AuthService } from './auth.service';

interface HintStorageData {
  dismissed: string[];
  spotlightCompleted: boolean;
  boardVisitCount: number;
}

const STORAGE_PREFIX = 'tf_hints_';

@Injectable({ providedIn: 'root' })
export class FeatureHintsService {
  private authService = inject(AuthService);
  private loaded = false;

  readonly dismissedHints = signal<Set<string>>(new Set());
  readonly activeHint = signal<string | null>(null);
  readonly hasSeenSpotlight = signal<boolean>(false);
  readonly hintShownThisSession = signal<boolean>(false);
  readonly boardVisitCount = signal<number>(0);

  readonly canShowHint = computed(
    () => !this.hintShownThisSession() && this.activeHint() === null,
  );

  constructor() {
    effect(
      () => {
        const userId = this.authService.currentUser()?.id;
        if (!userId || this.loaded) return;
        const stored = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
        if (stored) {
          try {
            const data: HintStorageData = JSON.parse(stored);
            this.dismissedHints.set(new Set(data.dismissed ?? []));
            this.hasSeenSpotlight.set(data.spotlightCompleted ?? false);
            this.boardVisitCount.set(data.boardVisitCount ?? 0);
          } catch {
            // corrupted data — start fresh
          }
        }
        this.loaded = true;
      },
      { allowSignalWrites: true },
    );

    effect(() => {
      const userId = this.authService.currentUser()?.id;
      if (!userId || !this.loaded) return;
      const data: HintStorageData = {
        dismissed: Array.from(this.dismissedHints()),
        spotlightCompleted: this.hasSeenSpotlight(),
        boardVisitCount: this.boardVisitCount(),
      };
      try {
        localStorage.setItem(
          `${STORAGE_PREFIX}${userId}`,
          JSON.stringify(data),
        );
      } catch {
        // localStorage full — silently ignore
      }
    });
  }

  isHintDismissed(hintId: string): boolean {
    return this.dismissedHints().has(hintId);
  }

  dismissHint(hintId: string): void {
    const current = this.dismissedHints();
    if (current.has(hintId)) return;
    const next = new Set(current);
    next.add(hintId);
    this.dismissedHints.set(next);
    this.activeHint.set(null);

    // Persist immediately — the reactive effect may not fire if loaded is still false
    const userId = this.authService.currentUser()?.id;
    if (userId) {
      try {
        const data: HintStorageData = {
          dismissed: Array.from(next),
          spotlightCompleted: this.hasSeenSpotlight(),
          boardVisitCount: this.boardVisitCount(),
        };
        localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(data));
      } catch {
        // localStorage full — silently ignore
      }
    }
  }

  showHint(hintId: string): void {
    if (this.isHintDismissed(hintId)) return;
    this.activeHint.set(hintId);
    this.hintShownThisSession.set(true);
  }

  completeSpotlight(): void {
    this.hasSeenSpotlight.set(true);
  }

  incrementBoardVisit(): void {
    this.boardVisitCount.set(this.boardVisitCount() + 1);
  }

  resetAll(): void {
    this.dismissedHints.set(new Set());
    this.activeHint.set(null);
    this.hasSeenSpotlight.set(false);
    this.hintShownThisSession.set(false);
    this.boardVisitCount.set(0);
  }
}
