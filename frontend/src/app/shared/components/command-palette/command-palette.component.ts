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
import {
  RecentItemsService,
  RecentItem,
} from '../../../core/services/recent-items.service';

export interface CommandAction {
  id: string;
  icon: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

const RECENT_SEARCHES_KEY = 'taskflow_recent_searches';
const MAX_RECENT_SEARCHES = 5;
const SELECTED_BG = 'rgba(99,102,241,0.1)';

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
        (click)="onBackdropClick($event)"
        (keydown)="onKeydown($event)"
      >
        <div
          class="w-full max-w-2xl bg-[var(--card)] rounded-xl shadow-2xl border border-[var(--border)] overflow-hidden"
          role="dialog"
          aria-label="Command Palette"
          (click)="$event.stopPropagation()"
        >
          <!-- Search Input -->
          <div
            class="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]"
          >
            <i class="pi pi-search text-gray-400 shrink-0"></i>
            <input
              #searchInput
              type="text"
              [ngModel]="query()"
              (ngModelChange)="onQueryChange($event)"
              [placeholder]="
                isCommandMode()
                  ? 'Type a command...'
                  : 'Search tasks, projects... (> for commands)'
              "
              class="flex-1 bg-transparent border-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] text-lg text-[var(--card-foreground)] placeholder-gray-400"
              autocomplete="off"
              (keydown)="onInputKeydown($event)"
            />
            @if (query()) {
              <button
                (click)="clearQuery()"
                class="p-1 hover:bg-[var(--secondary)] rounded"
              >
                <i class="pi pi-times text-gray-400 text-sm"></i>
              </button>
            }
            <kbd
              class="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-medium text-gray-400 bg-[var(--secondary)] rounded"
            >
              ESC
            </kbd>
          </div>

          <!-- Results Area -->
          <div #resultsList class="max-h-[60vh] overflow-y-auto">
            @if (isCommandMode()) {
              <!-- Command Mode: Actions -->
              <div class="py-2">
                <div
                  class="px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide"
                >
                  Actions
                </div>
                @for (
                  action of filteredActions();
                  track action.id;
                  let idx = $index
                ) {
                  <button
                    [attr.data-item-index]="idx"
                    class="cp-item w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-left"
                    [style.background]="
                      selectedIndex() === idx ? selectedBg : ''
                    "
                    (click)="executeAction(action)"
                    (mouseenter)="selectedIndex.set(idx)"
                  >
                    <i
                      [class]="
                        'pi pi-' +
                        action.icon +
                        ' w-5 h-5 text-gray-400 shrink-0'
                      "
                    ></i>
                    <span
                      class="flex-1 text-sm text-[var(--card-foreground)]"
                      >{{ action.label }}</span
                    >
                    @if (action.shortcut) {
                      <kbd
                        class="text-xs px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)] font-mono"
                      >
                        {{ action.shortcut }}
                      </kbd>
                    }
                  </button>
                }
                @if (filteredActions().length === 0) {
                  <div
                    class="flex flex-col items-center justify-center py-8 text-[var(--muted-foreground)]"
                  >
                    <p class="text-sm">No matching commands</p>
                  </div>
                }
              </div>
            } @else if (loading()) {
              <div class="flex items-center justify-center py-12">
                <div
                  class="flex items-center gap-3 text-[var(--muted-foreground)]"
                >
                  <i class="pi pi-spin pi-spinner text-xl"></i>
                  <span>Searching...</span>
                </div>
              </div>
            } @else if (hasSearched() && !hasResults()) {
              <div
                class="flex flex-col items-center justify-center py-12 text-[var(--muted-foreground)]"
              >
                <i class="pi pi-search text-4xl mb-3 opacity-50"></i>
                <p class="text-sm font-medium">No results found</p>
                <p class="text-xs mt-1">
                  Try different keywords or check spelling
                </p>
              </div>
            } @else if (!query()) {
              <!-- Default view: Recent Items + Quick Actions -->
              <div class="py-2">
                @if (recentItems().length > 0) {
                  <div
                    class="px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide"
                  >
                    Recent
                  </div>
                  @for (
                    item of recentItems();
                    track item.id;
                    let idx = $index
                  ) {
                    <button
                      [attr.data-item-index]="idx"
                      class="cp-item w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-left"
                      [style.background]="
                        selectedIndex() === idx ? selectedBg : ''
                      "
                      (click)="onRecentItemClick(item)"
                      (mouseenter)="selectedIndex.set(idx)"
                    >
                      <i
                        [class]="
                          item.entityType === 'board'
                            ? 'pi pi-table text-emerald-500 shrink-0'
                            : 'pi pi-check-square text-primary shrink-0'
                        "
                      ></i>
                      <div class="flex-1 min-w-0">
                        <span
                          class="text-sm text-[var(--card-foreground)] truncate block"
                          >{{ item.name }}</span
                        >
                        @if (item.context) {
                          <span
                            class="text-xs text-[var(--muted-foreground)] truncate block"
                            >{{ item.context }}</span
                          >
                        }
                      </div>
                      <span
                        class="text-xs text-[var(--muted-foreground)] shrink-0"
                      >
                        {{ item.entityType === 'board' ? 'Project' : 'Task' }}
                      </span>
                    </button>
                  }
                }

                <div
                  class="px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide"
                  [class.mt-2]="recentItems().length > 0"
                >
                  Quick Actions
                </div>
                @for (
                  action of quickActions();
                  track action.id;
                  let idx = $index
                ) {
                  <button
                    [attr.data-item-index]="recentItems().length + idx"
                    class="cp-item w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-left"
                    [style.background]="
                      selectedIndex() === recentItems().length + idx
                        ? selectedBg
                        : ''
                    "
                    (click)="executeAction(action)"
                    (mouseenter)="selectedIndex.set(recentItems().length + idx)"
                  >
                    <i
                      [class]="
                        'pi pi-' + action.icon + ' text-gray-400 shrink-0'
                      "
                    ></i>
                    <span
                      class="flex-1 text-sm text-[var(--card-foreground)]"
                      >{{ action.label }}</span
                    >
                    @if (action.shortcut) {
                      <kbd
                        class="text-xs px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)] font-mono"
                      >
                        {{ action.shortcut }}
                      </kbd>
                    }
                  </button>
                }

                @if (recentItems().length === 0) {
                  <div
                    class="px-4 py-6 text-center text-[var(--muted-foreground)]"
                  >
                    <i class="pi pi-search text-3xl mb-2 opacity-50 block"></i>
                    <p class="text-sm">Search across your workspace</p>
                    <p class="text-xs mt-1">Find tasks, projects, and comments</p>
                  </div>
                }
              </div>
            } @else if (results()) {
              <!-- Search Results -->
              @if (results()!.tasks.length > 0) {
                <div class="py-1">
                  <div
                    class="px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide"
                  >
                    Tasks ({{ results()!.tasks.length }})
                  </div>
                  @for (
                    task of results()!.tasks;
                    track task.id;
                    let idx = $index
                  ) {
                    <button
                      [attr.data-item-index]="idx"
                      class="cp-item w-full flex items-start gap-3 px-3 py-2 text-left rounded-md transition-colors"
                      [style.background]="
                        selectedIndex() === idx ? selectedBg : ''
                      "
                      (click)="navigateToTask(task)"
                      (mouseenter)="selectedIndex.set(idx)"
                    >
                      <i
                        class="pi pi-check-square text-primary shrink-0 mt-0.5"
                      ></i>
                      <div class="flex-1 min-w-0">
                        <p
                          class="text-sm font-medium text-[var(--card-foreground)] truncate"
                        >
                          {{ task.title }}
                        </p>
                        <p
                          class="text-xs text-[var(--muted-foreground)] truncate"
                        >
                          {{ task.workspace_name }} &rsaquo;
                          {{ task.board_name }}
                        </p>
                      </div>
                    </button>
                  }
                </div>
              }

              @if (results()!.boards.length > 0) {
                <div class="py-1">
                  <div
                    class="px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide"
                  >
                    Projects ({{ results()!.boards.length }})
                  </div>
                  @for (
                    board of results()!.boards;
                    track board.id;
                    let idx = $index
                  ) {
                    <button
                      [attr.data-item-index]="boardOffset() + idx"
                      class="cp-item w-full flex items-start gap-3 px-3 py-2 text-left rounded-md transition-colors"
                      [style.background]="
                        selectedIndex() === boardOffset() + idx
                          ? selectedBg
                          : ''
                      "
                      (click)="navigateToBoard(board)"
                      (mouseenter)="selectedIndex.set(boardOffset() + idx)"
                    >
                      <i
                        class="pi pi-table text-emerald-500 shrink-0 mt-0.5"
                      ></i>
                      <div class="flex-1 min-w-0">
                        <p
                          class="text-sm font-medium text-[var(--card-foreground)] truncate"
                        >
                          {{ board.name }}
                        </p>
                        <p
                          class="text-xs text-[var(--muted-foreground)] truncate"
                        >
                          {{ board.workspace_name }}
                        </p>
                      </div>
                    </button>
                  }
                </div>
              }

              @if (results()!.comments.length > 0) {
                <div class="py-1">
                  <div
                    class="px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide"
                  >
                    Comments ({{ results()!.comments.length }})
                  </div>
                  @for (
                    comment of results()!.comments;
                    track comment.id;
                    let idx = $index
                  ) {
                    <button
                      [attr.data-item-index]="commentOffset() + idx"
                      class="cp-item w-full flex items-start gap-3 px-3 py-2 text-left rounded-md transition-colors"
                      [style.background]="
                        selectedIndex() === commentOffset() + idx
                          ? selectedBg
                          : ''
                      "
                      (click)="navigateToComment(comment)"
                      (mouseenter)="selectedIndex.set(commentOffset() + idx)"
                    >
                      <i
                        class="pi pi-comment text-amber-500 shrink-0 mt-0.5"
                      ></i>
                      <div class="flex-1 min-w-0">
                        <p
                          class="text-sm text-[var(--card-foreground)] truncate"
                        >
                          {{ comment.content }}
                        </p>
                        <p
                          class="text-xs text-[var(--muted-foreground)] truncate"
                        >
                          on {{ comment.task_title }} &rsaquo;
                          {{ comment.board_name }}
                        </p>
                      </div>
                    </button>
                  }
                </div>
              }

              <div class="h-2"></div>
            }
          </div>

          <!-- Footer -->
          <div
            class="flex items-center justify-between px-4 py-2 border-t border-[var(--border)] text-xs text-gray-400"
          >
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1">
                <kbd
                  class="px-1.5 py-0.5 bg-[var(--secondary)] rounded text-[10px]"
                  >&#8593;&#8595;</kbd
                >
                navigate
              </span>
              <span class="flex items-center gap-1">
                <kbd
                  class="px-1.5 py-0.5 bg-[var(--secondary)] rounded text-[10px]"
                  >&#9166;</kbd
                >
                select
              </span>
            </div>
            <span class="flex items-center gap-1">
              <kbd
                class="px-1.5 py-0.5 bg-[var(--secondary)] rounded text-[10px]"
                >&gt;</kbd
              >
              commands
            </span>
            <span class="flex items-center gap-1">
              <kbd
                class="px-1.5 py-0.5 bg-[var(--secondary)] rounded text-[10px]"
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
      .cp-item:hover {
        background: var(--secondary);
      }
    `,
  ],
})
export class CommandPaletteComponent implements OnInit, OnDestroy {
  isOpen = input(false);
  closed = output<void>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('resultsList') resultsList!: ElementRef<HTMLDivElement>;

  readonly selectedBg = SELECTED_BG;

  private searchService = inject(SearchService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private shortcutsService = inject(KeyboardShortcutsService);
  private recentItemsService = inject(RecentItemsService);

  query = signal('');
  loading = signal(false);
  results = signal<SearchResults | null>(null);
  hasSearched = signal(false);
  selectedIndex = signal(0);

  isCommandMode = computed(() => this.query().startsWith('>'));

  recentItems = computed(() => this.recentItemsService.getForPalette());

  // Computed offsets for search result keyboard nav
  boardOffset = computed(() => {
    const r = this.results();
    return r ? r.tasks.length : 0;
  });

  commentOffset = computed(() => {
    const r = this.results();
    return r ? r.tasks.length + r.boards.length : 0;
  });

  actions: CommandAction[] = [
    {
      id: 'new-task',
      icon: 'plus',
      label: 'Create New Task',
      shortcut: 'N',
      action: () =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })),
    },
    {
      id: 'dashboard',
      icon: 'home',
      label: 'Go to Dashboard',
      shortcut: 'G D',
      action: () => this.router.navigate(['/dashboard']),
    },
    {
      id: 'my-tasks',
      icon: 'check-square',
      label: 'Go to My Tasks',
      shortcut: 'G M',
      action: () => this.router.navigate(['/my-tasks']),
    },
    {
      id: 'eisenhower',
      icon: 'th-large',
      label: 'Go to Eisenhower Matrix',
      shortcut: 'G E',
      action: () => this.router.navigate(['/eisenhower']),
    },
    {
      id: 'dark-mode',
      icon: 'moon',
      label: 'Toggle Dark Mode',
      shortcut: 'Ctrl+Shift+D',
      action: () => {
        const current = this.themeService.resolvedTheme();
        this.themeService.setTheme(current === 'dark' ? 'light' : 'dark');
      },
    },
    {
      id: 'shortcuts',
      icon: 'key',
      label: 'Show Keyboard Shortcuts',
      shortcut: '?',
      action: () => this.shortcutsService.helpRequested$.next(),
    },
    {
      id: 'settings',
      icon: 'cog',
      label: 'Go to Settings',
      action: () => this.router.navigate(['/settings']),
    },
    {
      id: 'profile',
      icon: 'user',
      label: 'Go to Profile',
      action: () => this.router.navigate(['/settings/profile']),
    },
    {
      id: 'toggle-sidebar',
      icon: 'bars',
      label: 'Toggle Sidebar',
      shortcut: 'Ctrl+B',
      action: () =>
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }),
        ),
    },
    {
      id: 'clear-filters',
      icon: 'filter-slash',
      label: 'Clear Project Filters',
      shortcut: 'C',
      action: () =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' })),
    },
  ];

  quickActions = computed(() => this.actions.slice(0, 6));

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

  totalItems = computed(() => {
    if (this.isCommandMode()) {
      return this.filteredActions().length;
    }
    if (!this.query()) {
      return this.recentItems().length + this.quickActions().length;
    }
    const r = this.results();
    if (!r) return 0;
    return r.tasks.length + r.boards.length + r.comments.length;
  });

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private injector = inject(Injector);

  ngOnInit(): void {
    effect(
      () => {
        const open = this.isOpen();
        if (open) {
          untracked(() => {
            this.shortcutsService.pushDisable();
            setTimeout(() => {
              this.searchInput?.nativeElement?.focus();
            }, 50);
          });
        } else {
          untracked(() => {
            this.shortcutsService.popDisable();
            this.query.set('');
            this.results.set(null);
            this.hasSearched.set(false);
            this.loading.set(false);
            this.selectedIndex.set(0);
          });
        }
      },
      { injector: this.injector },
    );

    this.searchSubscription = this.searchSubject
      .pipe(
        debounceTime(200),
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
            tap((searchResults) => {
              this.results.set(searchResults);
              this.hasSearched.set(true);
              this.loading.set(false);
              this.selectedIndex.set(0);
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
    this.selectedIndex.set(0);
    if (!value.startsWith('>')) {
      this.searchSubject.next(value);
    }
  }

  onInputKeydown(event: KeyboardEvent): void {
    const total = this.totalItems();
    if (total === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex.update((i) => (i + 1) % total);
        this.scrollSelectedIntoView();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex.update((i) => (i - 1 + total) % total);
        this.scrollSelectedIntoView();
        break;
      case 'Enter':
        event.preventDefault();
        this.selectCurrentItem();
        break;
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
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
    this.selectedIndex.set(0);
    this.searchInput?.nativeElement?.focus();
  }

  onBackdropClick(_event: MouseEvent): void {
    this.close();
  }

  close(): void {
    this.closed.emit(undefined);
  }

  onRecentItemClick(item: RecentItem): void {
    if (item.entityType === 'board') {
      this.router.navigate(['/workspace', item.workspaceId, 'project', item.id]);
    } else if (item.entityType === 'task' && item.boardId) {
      this.router.navigate(
        ['/workspace', item.workspaceId, 'project', item.boardId],
        { queryParams: { task: item.id } },
      );
    }
    this.close();
  }

  navigateToTask(task: TaskSearchResult): void {
    this.recentItemsService.recordTaskView({
      id: task.id,
      title: task.title,
      boardName: task.board_name,
      workspaceId: task.workspace_id,
      workspaceName: task.workspace_name,
      boardId: task.board_id,
    });
    this.router.navigate(
      ['/workspace', task.workspace_id, 'project', task.board_id],
      { queryParams: { task: task.id } },
    );
    this.close();
  }

  navigateToBoard(board: BoardSearchResult): void {
    this.recentItemsService.recordBoardView({
      id: board.id,
      name: board.name,
      workspaceId: board.workspace_id,
      workspaceName: board.workspace_name,
    });
    this.router.navigate(['/workspace', board.workspace_id, 'project', board.id]);
    this.close();
  }

  navigateToComment(comment: CommentSearchResult): void {
    this.router.navigate(
      ['/workspace', comment.workspace_id, 'project', comment.board_id],
      { queryParams: { task: comment.task_id } },
    );
    this.close();
  }

  private selectCurrentItem(): void {
    const idx = this.selectedIndex();

    if (this.isCommandMode()) {
      const acts = this.filteredActions();
      if (idx >= 0 && idx < acts.length) {
        this.executeAction(acts[idx]);
      }
      return;
    }

    if (!this.query()) {
      const recents = this.recentItems();
      if (idx < recents.length) {
        this.onRecentItemClick(recents[idx]);
        return;
      }
      const actionIdx = idx - recents.length;
      const quickActs = this.quickActions();
      if (actionIdx >= 0 && actionIdx < quickActs.length) {
        this.executeAction(quickActs[actionIdx]);
      }
      return;
    }

    const r = this.results();
    if (!r) return;

    const taskLen = r.tasks.length;
    const boardLen = r.boards.length;

    if (idx < taskLen) {
      this.navigateToTask(r.tasks[idx]);
    } else if (idx < taskLen + boardLen) {
      this.navigateToBoard(r.boards[idx - taskLen]);
    } else {
      const commentIdx = idx - taskLen - boardLen;
      if (commentIdx < r.comments.length) {
        this.navigateToComment(r.comments[commentIdx]);
      }
    }
  }

  private scrollSelectedIntoView(): void {
    requestAnimationFrame(() => {
      const container = this.resultsList?.nativeElement;
      if (!container) return;
      const item = container.querySelector(
        `[data-item-index="${this.selectedIndex()}"]`,
      ) as HTMLElement | null;
      item?.scrollIntoView({ block: 'nearest' });
    });
  }

  private saveRecentSearch(searchQuery: string): void {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      const current: string[] = stored ? JSON.parse(stored) : [];
      const filtered = current.filter((s) => s !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }
}
