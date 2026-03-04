import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  KeyboardShortcutsService,
  KeyboardShortcut,
} from '../../../core/services/keyboard-shortcuts.service';

@Component({
  selector: 'app-shortcut-help',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        (click)="close()"
        (keydown.escape)="close()"
      >
        <div
          class="bg-[var(--card)] rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0"
          >
            <h2 class="text-lg font-semibold text-[var(--card-foreground)]">
              Keyboard Shortcuts
            </h2>
            <button
              (click)="close()"
              class="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              aria-label="Close keyboard shortcuts"
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

          <!-- Search -->
          <div class="px-6 py-3 border-b border-[var(--border)] flex-shrink-0">
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Search shortcuts..."
              class="w-full px-3 py-2 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded-md text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <!-- Body -->
          <div class="px-6 py-4 overflow-y-auto flex-1">
            <!-- Recently Used -->
            @if (!searchQuery && recentlyUsed().length > 0) {
              <div class="mb-6">
                <h3
                  class="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2"
                >
                  Recently Used
                </h3>
                <div class="space-y-1">
                  @for (s of recentlyUsed(); track s.key) {
                    <div class="flex items-center justify-between py-1.5">
                      <span class="text-sm text-[var(--foreground)]">{{
                        s.description
                      }}</span>
                      <kbd
                        class="px-2 py-0.5 text-xs font-mono bg-[var(--secondary)] border border-[var(--primary)]/30 rounded text-[var(--primary)]"
                        >{{ formatShortcut(s) }}</kbd
                      >
                    </div>
                  }
                </div>
              </div>
            }

            <!-- 2-col grid of categories -->
            <div class="grid grid-cols-2 gap-x-8 gap-y-6">
              @for (cat of filteredCategories(); track cat.name) {
                <div>
                  <h3
                    class="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2"
                  >
                    {{ cat.name }}
                  </h3>
                  <div class="space-y-1">
                    @for (s of cat.shortcuts; track s.description) {
                      <div class="flex items-center justify-between py-1.5">
                        <span class="text-sm text-[var(--foreground)]">{{
                          s.description
                        }}</span>
                        <kbd
                          class="px-2 py-0.5 text-xs font-mono bg-[var(--secondary)] border border-[var(--border)] rounded text-[var(--muted-foreground)]"
                          >{{ formatShortcut(s) }}</kbd
                        >
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Help entry -->
            @if (
              !searchQuery ||
              'show keyboard shortcuts'.includes(searchQuery.toLowerCase())
            ) {
              <div class="mt-6 pt-4 border-t border-[var(--border)]">
                <div class="flex items-center justify-between py-1.5">
                  <span class="text-sm text-[var(--foreground)]"
                    >Show keyboard shortcuts</span
                  >
                  <kbd
                    class="px-2 py-0.5 text-xs font-mono bg-[var(--secondary)] border border-[var(--border)] rounded text-[var(--muted-foreground)]"
                    >?</kbd
                  >
                </div>
              </div>
            }
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
  searchQuery = '';
  private allCategories = signal<
    { name: string; shortcuts: KeyboardShortcut[] }[]
  >([]);

  recentlyUsed = computed(() => {
    const descriptions = this.shortcutsService.recentlyUsedIds();
    const all = this.shortcutsService.getAll();
    return descriptions
      .map((desc) => all.find((s) => s.description === desc))
      .filter((s): s is KeyboardShortcut => s !== undefined);
  });

  filteredCategories = computed(() => {
    const q = this.searchQuery.toLowerCase();
    const cats = this.allCategories();
    if (!q) return cats;
    return cats
      .map((cat) => ({
        name: cat.name,
        shortcuts: cat.shortcuts.filter(
          (s) =>
            s.description.toLowerCase().includes(q) ||
            s.key.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.shortcuts.length > 0);
  });

  ngOnInit(): void {
    this.sub = this.shortcutsService.helpRequested$.subscribe(() => {
      this.updateCategories();
      this.shortcutsService.pushDisable();
      this.visible.set(true);
      try {
        localStorage.setItem('tf_shortcut_modal_opened', '1');
      } catch {
        /* ignore */
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.visible()) {
      this.shortcutsService.popDisable();
    }
  }

  close(): void {
    if (!this.visible()) return;
    this.visible.set(false);
    this.searchQuery = '';
    this.shortcutsService.popDisable();
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
    this.allCategories.set(cats);
  }
}
