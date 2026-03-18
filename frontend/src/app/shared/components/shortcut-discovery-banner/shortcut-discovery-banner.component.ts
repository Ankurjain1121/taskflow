import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  inject,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';

const MODAL_OPENED_KEY = 'tf_shortcut_modal_opened';
const BANNER_DISMISSED_KEY = 'tf_shortcut_dismissed_banner';

@Component({
  selector: 'app-shortcut-discovery-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--primary)]/20 text-sm text-[var(--foreground)]"
        style="background: color-mix(in srgb, var(--primary) 8%, transparent)"
        role="status"
      >
        <span class="text-[var(--primary)] select-none">⌨</span>
        <span>
          Press
          <kbd
            class="mx-1 px-1.5 py-0.5 text-xs font-mono bg-[var(--secondary)] border border-[var(--border)] rounded"
            >?</kbd
          >
          anytime to see all keyboard shortcuts
        </span>
        <button
          (click)="dismiss()"
          class="ml-auto p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors"
          aria-label="Dismiss shortcut hint"
        >
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    }
  `,
})
export class ShortcutDiscoveryBannerComponent implements OnInit, OnDestroy {
  private readonly shortcutsService = inject(KeyboardShortcutsService);

  readonly visible = signal(false);

  private autoDismissTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const count = this.shortcutsService.helpRequested();
      if (count > 0) {
        this.hide();
      }
    });
  }

  ngOnInit(): void {
    try {
      const alreadyOpened = localStorage.getItem(MODAL_OPENED_KEY);
      const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
      if (!alreadyOpened && !dismissed) {
        this.visible.set(true);
        this.autoDismissTimer = setTimeout(() => this.dismiss(), 8000);
      }
    } catch {
      // localStorage unavailable — skip banner
    }
  }

  ngOnDestroy(): void {
    if (this.autoDismissTimer !== undefined) {
      clearTimeout(this.autoDismissTimer);
    }
  }

  dismiss(): void {
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
    this.hide();
  }

  private hide(): void {
    this.visible.set(false);
    if (this.autoDismissTimer !== undefined) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = undefined;
    }
  }
}
