import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, finalize } from 'rxjs/operators';
import {
  SearchService,
  SearchResults,
  TaskSearchResult,
  BoardSearchResult,
  CommentSearchResult,
} from '../../../core/services/search.service';

const RECENT_SEARCHES_KEY = 'taskflow_recent_searches';
const MAX_RECENT_SEARCHES = 5;

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
        (click)="onBackdropClick($event)"
        (keydown)="onKeydown($event)"
      >
        <!-- Search Dialog -->
        <div
          class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          (click)="$event.stopPropagation()"
        >
          <!-- Search Input -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <!-- Search Icon -->
            <svg class="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              #searchInput
              type="text"
              [ngModel]="query()"
              (ngModelChange)="onQueryChange($event)"
              placeholder="Search tasks, boards, comments..."
              class="flex-1 bg-transparent border-none outline-none text-lg text-gray-900 dark:text-gray-100 placeholder-gray-400"
              autocomplete="off"
            />
            @if (query()) {
              <button
                (click)="clearQuery()"
                class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            }
            <kbd class="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
              ESC
            </kbd>
          </div>

          <!-- Results Area -->
          <div class="max-h-[60vh] overflow-y-auto">
            @if (loading()) {
              <!-- Loading -->
              <div class="flex items-center justify-center py-12">
                <div class="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span>Searching...</span>
                </div>
              </div>
            } @else if (hasSearched() && !hasResults()) {
              <!-- No results -->
              <div class="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <svg class="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-sm font-medium">No results found</p>
                <p class="text-xs mt-1">Try different keywords or check spelling</p>
              </div>
            } @else if (!query() && recentSearches().length > 0) {
              <!-- Recent Searches -->
              <div class="px-4 py-3">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recent Searches</span>
                  <button
                    (click)="clearRecentSearches()"
                    class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Clear
                  </button>
                </div>
                @for (recent of recentSearches(); track recent) {
                  <button
                    (click)="onRecentClick(recent)"
                    class="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="text-sm text-gray-700 dark:text-gray-300">{{ recent }}</span>
                  </button>
                }
              </div>
            } @else if (results()) {
              <!-- Task Results -->
              @if (results()!.tasks.length > 0) {
                <div class="px-4 pt-3 pb-1">
                  <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tasks</span>
                </div>
                @for (task of results()!.tasks; track task.id) {
                  <button
                    (click)="navigateToTask(task)"
                    class="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <!-- Task icon -->
                    <svg class="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ task.title }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {{ task.workspace_name }} &rsaquo; {{ task.board_name }}
                      </p>
                      @if (task.description) {
                        <p class="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{{ task.description }}</p>
                      }
                    </div>
                  </button>
                }
              }

              <!-- Board Results -->
              @if (results()!.boards.length > 0) {
                <div class="px-4 pt-3 pb-1">
                  <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Boards</span>
                </div>
                @for (board of results()!.boards; track board.id) {
                  <button
                    (click)="navigateToBoard(board)"
                    class="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <!-- Board icon -->
                    <svg class="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ board.name }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {{ board.workspace_name }}
                      </p>
                      @if (board.description) {
                        <p class="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{{ board.description }}</p>
                      }
                    </div>
                  </button>
                }
              }

              <!-- Comment Results -->
              @if (results()!.comments.length > 0) {
                <div class="px-4 pt-3 pb-1">
                  <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comments</span>
                </div>
                @for (comment of results()!.comments; track comment.id) {
                  <button
                    (click)="navigateToComment(comment)"
                    class="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <!-- Comment icon -->
                    <svg class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-gray-900 dark:text-gray-100 truncate">{{ comment.content }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                        on {{ comment.task_title }} &rsaquo; {{ comment.board_name }}
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
              <div class="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <svg class="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p class="text-sm font-medium">Search across your workspace</p>
                <p class="text-xs mt-1">Find tasks, boards, and comments</p>
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1">
                <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">&#8593;&#8595;</kbd>
                navigate
              </span>
              <span class="flex items-center gap-1">
                <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">&#9166;</kbd>
                select
              </span>
            </div>
            <span class="flex items-center gap-1">
              <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    }
  `,
})
export class GlobalSearchComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  private searchService = inject(SearchService);
  private router = inject(Router);

  query = signal('');
  loading = signal(false);
  results = signal<SearchResults | null>(null);
  hasSearched = signal(false);
  recentSearches = signal<string[]>([]);

  hasResults = computed(() => {
    const r = this.results();
    if (!r) return false;
    return r.tasks.length > 0 || r.boards.length > 0 || r.comments.length > 0;
  });

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  constructor() {
    // Focus input when dialog opens
    effect(() => {
      if (this.isOpen) {
        // Use setTimeout to wait for the DOM to render
        setTimeout(() => {
          this.searchInput?.nativeElement?.focus();
        }, 50);
      } else {
        // Reset state when closed
        this.query.set('');
        this.results.set(null);
        this.hasSearched.set(false);
        this.loading.set(false);
      }
    });
  }

  ngOnInit(): void {
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
            finalize(() => this.loading.set(false))
          );
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.searchSubject.next(value);
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
    this.closed.emit();
  }

  onRecentClick(query: string): void {
    this.query.set(query);
    this.searchSubject.next(query);
  }

  navigateToTask(task: TaskSearchResult): void {
    this.router.navigate(['/workspace', task.workspace_id, 'board', task.board_id], {
      queryParams: { task: task.id },
    });
    this.close();
  }

  navigateToBoard(board: BoardSearchResult): void {
    this.router.navigate(['/workspace', board.workspace_id, 'board', board.id]);
    this.close();
  }

  navigateToComment(comment: CommentSearchResult): void {
    this.router.navigate(['/workspace', comment.workspace_id, 'board', comment.board_id], {
      queryParams: { task: comment.task_id },
    });
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
