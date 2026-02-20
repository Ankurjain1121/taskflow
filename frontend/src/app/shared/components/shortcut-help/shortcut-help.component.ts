import {
  Component,
  signal,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  KeyboardShortcutsService,
  KeyboardShortcut,
} from '../../../core/services/keyboard-shortcuts.service';

@Component({
  selector: 'app-shortcut-help',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        (click)="close()"
        (keydown.escape)="close()"
      >
        <div
          class="bg-[var(--card)] rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
          (click)="$event.stopPropagation()"
        >
          <div
            class="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]"
          >
            <h2 class="text-lg font-semibold text-[var(--card-foreground)]">
              Keyboard Shortcuts
            </h2>
            <button
              (click)="close()"
              class="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <svg
                class="w-5 h-5"
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

          <div class="px-6 py-4 space-y-6">
            @for (cat of categories(); track cat.name) {
              <div>
                <h3
                  class="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2"
                >
                  {{ cat.name }}
                </h3>
                <div class="space-y-1">
                  @for (s of cat.shortcuts; track s.key) {
                    <div class="flex items-center justify-between py-1.5">
                      <span class="text-sm text-[var(--foreground)]">{{
                        s.description
                      }}</span>
                      <kbd
                        class="px-2 py-0.5 text-xs font-mono bg-[var(--secondary)] border border-[var(--border)] rounded text-[var(--muted-foreground)]"
                      >
                        {{ formatShortcut(s) }}
                      </kbd>
                    </div>
                  }
                </div>
              </div>
            }

            <div>
              <h3
                class="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2"
              >
                Help
              </h3>
              <div class="flex items-center justify-between py-1.5">
                <span class="text-sm text-[var(--foreground)]"
                  >Show this help</span
                >
                <kbd
                  class="px-2 py-0.5 text-xs font-mono bg-[var(--secondary)] border border-[var(--border)] rounded text-[var(--muted-foreground)]"
                  >?</kbd
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShortcutHelpComponent implements OnInit, OnDestroy {
  private shortcutsService = inject(KeyboardShortcutsService);
  private sub!: Subscription;

  visible = signal(false);
  categories = signal<{ name: string; shortcuts: KeyboardShortcut[] }[]>([]);

  ngOnInit(): void {
    this.sub = this.shortcutsService.helpRequested$.subscribe(() => {
      this.updateCategories();
      this.visible.set(true);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  close(): void {
    this.visible.set(false);
  }

  formatShortcut(s: KeyboardShortcut): string {
    return this.shortcutsService.formatShortcut(s);
  }

  private updateCategories(): void {
    const grouped = this.shortcutsService.getByCategory();
    const cats: { name: string; shortcuts: KeyboardShortcut[] }[] = [];
    grouped.forEach((shortcuts, name) => {
      cats.push({ name, shortcuts });
    });
    this.categories.set(cats);
  }
}
