import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  Injector,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  effect,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  tap,
  finalize,
} from 'rxjs/operators';
import {
  SearchService,
  SearchResults,
  TaskSearchResult,
  BoardSearchResult,
  CommentSearchResult,
} from '../../../core/services/search.service';
import { ThemeService } from '../../../core/services/theme.service';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';

export interface CommandAction {
  icon: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

const RECENT_SEARCHES_KEY = 'taskflow_recent_searches';
const MAX_RECENT_SEARCHES = 5;

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
        (click)="onBackdropClick($event)"
        (keydown)="onKeydown($event)"
      >
        <!-- Search Dialog -->
        <div
          class="w-full max-w-2xl bg-[var(--card)] dark:bg-gray-800 rounded-xl shadow-2xl border border-[var(--border)] dark:border-gray-700 overflow-hidden"
          (click)="$event.stopPropagation()"
        >
          <!-- Search Input -->
          <div
            class="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] dark:border-gray-700"
          >
            <!-- Search Icon -->
            <svg
              class="w-5 h-5 text-gray-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              #searchInput
              type="text"
              [ngModel]="query()"
              (ngModelChange)="onQueryChange($event)"
              [placeholder]="
                isCommandMode()
                  ? 'Type a command...'
                  : 'Search tasks, boards, comments... (type > for commands)'
              "
              class="flex-1 bg-transparent border-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] text-lg text-[var(--card-foreground)] dark:text-gray-100 placeholder-gray-400"
              autocomplete="off"
            />
            @if (query()) {
              <button
                (click)="clearQuery()"
                class="p-1 hover:bg-[var(--secondary)] dark:hover:bg-gray-700 rounded"
              >
                <svg
                  class="w-4 h-4 text-gray-400"
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
            }
            <kbd
              class="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-medium text-gray-400 bg-[var(--secondary)] dark:bg-gray-700 rounded"
            >
              ESC
            </kbd>
          </div>

          <!-- Results Area -->
          <div class="max-h-[60vh] overflow-y-auto">
            @if (isCommandMode()) {
              <!-- Command Palette Actions -->
              <div class="py-2">
                <div
                  class="px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] dark:text-gray-400 uppercase tracking-wide"
                >
                  Actions
                </div>
                @for (action of filteredActions(); track action.label) {
                  <button
                    class="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--secondary)] dark:hover:bg-gray-700 rounded-md transition-colors text-left"
                    (click)="executeAction(action)"
                  >
                    <svg
                      class="w-5 h-5 text-gray-400 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      @switch (action.icon) {
                        @case ('add_task') {
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 4v16m8-8H4"
                          />
                        }
                        @case ('dashboard') {
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                          />
                        }
                        @case ('task_alt') {
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                          />
                        }
                        @case ('dark_mode') {
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                          />
                        }
                        @case ('keyboard') {
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        }
                        @default {
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        }
                      }
                    </svg>
                    <span
                      class="flex-1 text-sm text-[var(--card-foreground)] dark:text-gray-100"
                      >{{ action.label }}</span
                    >
                    @if (action.shortcut) {
                      <kbd
                        class="text-xs px-1.5 py-0.5 rounded bg-[var(--secondary)] dark:bg-gray-700 text-[var(--muted-foreground)] dark:text-gray-400 font-mono"
                        >{{ action.shortcut }}</kbd
                      >
                    }
                  </button>
                }
                @if (filteredActions().length === 0) {
                  <div
                    class="flex flex-col items-center justify-center py-8 text-[var(--muted-foreground)] dark:text-gray-400"
                  >
                    <p class="text-sm">No matching commands</p>
                  </div>
                }
              </div>
            } @else if (loading()) {
              <!-- Loading -->
              <div class="flex items-center justify-center py-12">
                <div
                  class="flex items-center gap-3 text-[var(--muted-foreground)] dark:text-gray-400"
                >
                  <svg
                    class="w-5 h-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    ></path>
                  </svg>
                  <span>Searching...</span>
                </div>
              </div>
            } @else if (hasSearched() && !hasResults()) {
              <!-- No results -->
              <div
                class="flex flex-col items-center justify-center py-12 text-[var(--muted-foreground)] dark:text-gray-400"
              >
                <svg
                  class="w-12 h-12 mb-3 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p class="text-sm font-medium">No results found</p>
                <p class="text-xs mt-1">
                  Try different keywords or check spelling
                </p>
              </div>
            } @else if (!query() && recentSearches().length > 0) {
              <!-- Recent Searches -->
              <div class="px-4 py-3">
                <div class="flex items-center justify-between mb-2">
                  <span
                    class="text-xs font-semibold text-[var(--muted-foreground)] dark:text-gray-400 uppercase tracking-wider"
                    >Recent Searches</span
                  >
                  <button
                    (click)="clearRecentSearches()"
                    class="text-xs text-[var(--muted-foreground)]/70 hover:text-[var(--foreground)] dark:hover:text-gray-300"
                  >
                    Clear
                  </button>
                </div>
                @for (recent of recentSearches(); track recent) {
                  <button
                    (click)="onRecentClick(recent)"
                    class="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg hover:bg-[var(--secondary)] dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg
                      class="w-4 h-4 text-gray-400 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span
                      class="text-sm text-[var(--foreground)] dark:text-gray-300"
                      >{{ recent }}</span
                    >
                  </button>
                }
              </div>
            } @else if (results()) {
              <!-- Task Results -->
              @if (results()!.tasks.length > 0) {
                <div class="px-4 pt-3 pb-1">
                  <span
                    class="text-xs font-semibold text-[var(--muted-foreground)] dark:text-gray-400 uppercase tracking-wider"
                    >Tasks</span
                  >
                </div>
                @for (task of results()!.tasks; track task.id) {
                  <button
                    (click)="navigateToTask(task)"
                    class="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--secondary)] dark:hover:bg-gray-700 transition-colors"
                  >
                    <!-- Task icon -->
                    <svg
                      class="w-5 h-5 text-primary shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                      />
                    </svg>
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-sm font-medium text-[var(--card-foreground)] dark:text-gray-100 truncate"
                      >
                        {{ task.title }}
                      </p>
                      <p
                        class="text-xs text-[var(--muted-foreground)] dark:text-gray-400 truncate"
                      >
                        {{ task.workspace_name }} &rsaquo; {{ task.board_name }}
                      </p>
                      @if (task.description) {
                        <p
                          class="text-xs text-[var(--muted-foreground)]/70 dark:text-gray-500 truncate mt-0.5"
                        >
                          {{ task.description }}
                        </p>
                      }
                    </div>
                  </button>
                }
              }

              <!-- Board Results -->
              @if (results()!.boards.length > 0) {
                <div class="px-4 pt-3 pb-1">
                  <span
                    class="text-xs font-semibold text-[var(--muted-foreground)] dark:text-gray-400 uppercase tracking-wider"
                    >Projects</span
                  >
                </div>
                @for (board of results()!.boards; track board.id) {
                  <button
                    (click)="navigateToBoard(board)"
                    class="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--secondary)] dark:hover:bg-gray-700 transition-colors"
                  >
                    <!-- Board icon -->
                    <svg
                      class="w-5 h-5 text-emerald-500 shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                      />
                    </svg>
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-sm font-medium text-[var(--card-foreground)] dark:text-gray-100 truncate"
                      >
                        {{ board.name }}
                      </p>
                      <p
                        class="text-xs text-[var(--muted-foreground)] dark:text-gray-400 truncate"
                      >
                        {{ board.workspace_name }}
                      </p>
                      @if (board.description) {
                        <p
                          class="text-xs text-[var(--muted-foreground)]/70 dark:text-gray-500 truncate mt-0.5"
                        >
                          {{ board.description }}
                        </p>
                      }
                    </div>
                  </button>
                }
              }

              <!-- Comment Results -->
              @if (results()!.comments.length > 0) {
                <div class="px-4 pt-3 pb-1">
                  <span
                    class="text-xs font-semibold text-[var(--muted-foreground)] dark:text-gray-400 uppercase tracking-wider"
                    >Comments</span
                  >
                </div>
                @for (comment of results()!.comments; track comment.id) {
                  <button
                    (click)="navigateToComment(comment)"
                    class="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--secondary)] dark:hover:bg-gray-700 transition-colors"
                  >
                    <!-- Comment icon -->
                    <svg
                      class="w-5 h-5 text-amber-500 shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-sm text-[var(--card-foreground)] dark:text-gray-100 truncate"
                      >
                        {{ comment.content }}
                      </p>
                      <p
                        class="text-xs text-[var(--muted-foreground)] dark:text-gray-400 truncate"
                      >
                        on {{ comment.task_title }} &rsaquo;
                        {{ comment.board_name }}
                      </p>
                    </div>
                  </button>
                }
              }

              <!-- Bottom padding -->
              <div class="h-2"></div>
            }

            @if (!query() && recentSearches().length === 0 && !hasSearched()) {
              <!-- Initial state -->
              <div
                class="flex flex-col items-center justify-center py-12 text-[var(--muted-foreground)] dark:text-gray-400"
              >
                <svg
                  class="w-12 h-12 mb-3 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p class="text-sm font-medium">Search across your workspace</p>
                <p class="text-xs mt-1">Find tasks, boards, and comments</p>
              </div>
            }
          </div>

          <!-- Footer -->
          <div
            class="flex items-center justify-between px-4 py-2 border-t border-[var(--border)] dark:border-gray-700 text-xs text-gray-400"
          >
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1">
                <kbd
                  class="px-1.5 py-0.5 bg-[var(--secondary)] dark:bg-gray-700 rounded text-[10px]"
                  >&#8593;&#8595;</kbd
                >
                navigate
              </span>
              <span class="flex items-center gap-1">
                <kbd
                  class="px-1.5 py-0.5 bg-[var(--secondary)] dark:bg-gray-700 rounded text-[10px]"
                  >&#9166;</kbd
                >
                select
              </span>
            </div>
            <span class="flex items-center gap-1">
              <kbd
                class="px-1.5 py-0.5 bg-[var(--secondary)] dark:bg-gray-700 rounded text-[10px]"
                >&gt;</kbd
              >
              commands
            </span>
            <span class="flex items-center gap-1">
              <kbd
                class="px-1.5 py-0.5 bg-[var(--secondary)] dark:bg-gray-700 rounded text-[10px]"
                >esc</kbd
              >
              close
            </span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      @media (prefers-reduced-motion: reduce) {
        .backdrop-blur-sm {
          backdrop-filter: none !important;
        }
      }
    `,
  ],
})
export class GlobalSearchComponent implements OnInit, OnDestroy {
  isOpen = input(false);
  closed = output<void>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  private searchService = inject(SearchService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private shortcutsService = inject(KeyboardShortcutsService);

  query = signal('');
  loading = signal(false);
  results = signal<SearchResults | null>(null);
  hasSearched = signal(false);
  recentSearches = signal<string[]>([]);

  isCommandMode = computed(() => this.query().startsWith('>'));

  actions: CommandAction[] = [
    {
      icon: 'add_task',
      label: 'Create New Task',
      shortcut: 'N',
      action: () => {
        // Emit a synthetic keyboard event for the 'n' shortcut
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
      },
    },
    {
      icon: 'dashboard',
      label: 'Go to Dashboard',
      shortcut: 'G D',
      action: () => this.router.navigate(['/dashboard']),
    },
    {
      icon: 'task_alt',
      label: 'Go to My Tasks',
      shortcut: 'G M',
      action: () => this.router.navigate(['/my-tasks']),
    },
    {
      icon: 'dark_mode',
      label: 'Toggle Dark Mode',
      shortcut: 'Ctrl+Shift+D',
      action: () => {
        const current = this.themeService.resolvedTheme();
        this.themeService.setTheme(current === 'dark' ? 'light' : 'dark');
      },
    },
    {
      icon: 'keyboard',
      label: 'Show Keyboard Shortcuts',
      shortcut: '?',
      action: () => this.shortcutsService.helpRequested$.next(),
    },
  ];

  filteredActions = computed(() => {
    const raw = this.query().slice(1).trim().toLowerCase();
    if (!raw) return this.actions;
    return this.actions.filter((a) => a.label.toLowerCase().includes(raw));
  });

  hasResults = computed(() => {
    const r = this.results();
    if (!r) return false;
    return r.tasks.length > 0 || r.boards.length > 0 || r.comments.length > 0;
  });

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private injector = inject(Injector);

  ngOnInit(): void {
    // Focus input when dialog opens, reset state when closed
    effect(
      () => {
        const open = this.isOpen();
        if (open) {
          untracked(() => {
            // Use setTimeout to wait for the DOM to render
            setTimeout(() => {
              this.searchInput?.nativeElement?.focus();
            }, 50);
          });
        } else {
          untracked(() => {
            // Reset state when closed
            this.query.set('');
            this.results.set(null);
            this.hasSearched.set(false);
            this.loading.set(false);
          });
        }
      },
      { injector: this.injector },
    );

    this.loadRecentSearches();

    this.searchSubscription = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((q) => {
          if (q.trim()) {
            this.loading.set(true);
          }
        }),
        switchMap((q) => {
          if (!q.trim()) {
            this.results.set(null);
            this.hasSearched.set(false);
            this.loading.set(false);
            return [];
          }
          return this.searchService.search(q).pipe(
            tap((results) => {
              this.results.set(results);
              this.hasSearched.set(true);
              this.loading.set(false);
              this.saveRecentSearch(q);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    // Don't trigger search API when in command mode
    if (!value.startsWith('>')) {
      this.searchSubject.next(value);
    }
  }

  executeAction(action: CommandAction): void {
    action.action();
    this.close();
  }

  clearQuery(): void {
    this.query.set('');
    this.results.set(null);
    this.hasSearched.set(false);
    this.searchInput?.nativeElement?.focus();
  }

  onBackdropClick(event: MouseEvent): void {
    this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    }
  }

  close(): void {
    this.closed.emit(undefined);
  }

  onRecentClick(query: string): void {
    this.query.set(query);
    this.searchSubject.next(query);
  }

  navigateToTask(task: TaskSearchResult): void {
    this.router.navigate(
      ['/workspace', task.workspace_id, 'project', task.board_id],
      {
        queryParams: { task: task.id },
      },
    );
    this.close();
  }

  navigateToBoard(board: BoardSearchResult): void {
    this.router.navigate(['/workspace', board.workspace_id, 'project', board.id]);
    this.close();
  }

  navigateToComment(comment: CommentSearchResult): void {
    this.router.navigate(
      ['/workspace', comment.workspace_id, 'project', comment.board_id],
      {
        queryParams: { task: comment.task_id },
      },
    );
    this.close();
  }

  clearRecentSearches(): void {
    this.recentSearches.set([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }

  private loadRecentSearches(): void {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        this.recentSearches.set(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }

  private saveRecentSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;

    const current = this.recentSearches();
    const filtered = current.filter((s) => s !== trimmed);
    const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    this.recentSearches.set(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  }
}
