import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import {
  MyTasksService,
  MyTask,
  MyTasksSummary,
  MyTasksParams,
} from '../../../core/services/my-tasks.service';
import { BoardService, Board } from '../../../core/services/board.service';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { TaskListItemComponent } from '../task-list-item/task-list-item.component';

type SortBy = 'due_date' | 'priority' | 'board' | 'created_at';
type SortOrder = 'asc' | 'desc';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TaskListItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--background)]">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-[var(--foreground)]">My Tasks</h1>
          <p class="text-sm text-[var(--muted-foreground)] mt-1">
            All tasks assigned to you across workspaces
          </p>
        </div>

        <!-- Summary Cards -->
        @if (summary()) {
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <!-- Total Assigned -->
            <div
              class="bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-4"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-full bg-[var(--secondary)] flex items-center justify-center"
                >
                  <svg
                    class="w-5 h-5 text-[var(--muted-foreground)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-2xl font-bold text-[var(--foreground)]">
                    {{ summary()!.total_assigned }}
                  </p>
                  <p class="text-xs text-[var(--muted-foreground)]">
                    Total Assigned
                  </p>
                </div>
              </div>
            </div>

            <!-- Due Soon -->
            <div
              class="bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-4"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"
                >
                  <svg
                    class="w-5 h-5 text-amber-600"
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
                </div>
                <div>
                  <p class="text-2xl font-bold text-amber-600">
                    {{ summary()!.due_soon }}
                  </p>
                  <p class="text-xs text-[var(--muted-foreground)]">Due Soon</p>
                </div>
              </div>
            </div>

            <!-- Overdue -->
            <div
              class="bg-[var(--card)] rounded-lg shadow-sm border border-[var(--status-red-border)] p-4"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"
                >
                  <svg
                    class="w-5 h-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-2xl font-bold text-red-600">
                    {{ summary()!.overdue }}
                  </p>
                  <p class="text-xs text-[var(--muted-foreground)]">Overdue</p>
                </div>
              </div>
            </div>

            <!-- Completed This Week -->
            <div
              class="bg-[var(--card)] rounded-lg shadow-sm border border-[var(--status-green-border)] p-4"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"
                >
                  <svg
                    class="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-2xl font-bold text-green-600">
                    {{ summary()!.completed_this_week }}
                  </p>
                  <p class="text-xs text-[var(--muted-foreground)]">
                    Completed This Week
                  </p>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Filters and Sort -->
        <div
          class="bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-4 mb-4"
        >
          <div class="flex flex-wrap items-center gap-4">
            <!-- Board Filter -->
            <div class="flex items-center gap-2">
              <label
                for="board-filter"
                class="text-sm text-[var(--muted-foreground)]"
              >
                Board:
              </label>
              <select
                id="board-filter"
                [(ngModel)]="selectedBoardId"
                (ngModelChange)="onFilterChange()"
                class="text-sm border-[var(--border)] rounded-md shadow-sm focus:border-primary focus:ring-primary bg-[var(--card)] text-[var(--foreground)]"
              >
                <option value="">All Boards</option>
                @for (board of boards(); track board.id) {
                  <option [value]="board.id">{{ board.name }}</option>
                }
              </select>
            </div>

            <!-- Sort By -->
            <div class="flex items-center gap-2">
              <label
                for="sort-by"
                class="text-sm text-[var(--muted-foreground)]"
                >Sort by:</label
              >
              <select
                id="sort-by"
                [(ngModel)]="sortBy"
                (ngModelChange)="onSortChange()"
                class="text-sm border-[var(--border)] rounded-md shadow-sm focus:border-primary focus:ring-primary bg-[var(--card)] text-[var(--foreground)]"
              >
                <option value="due_date">Due Date</option>
                <option value="priority">Priority</option>
                <option value="board">Board</option>
                <option value="created_at">Created</option>
              </select>
            </div>

            <!-- Sort Order -->
            <button
              (click)="toggleSortOrder()"
              class="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)]"
            >
              @if (sortOrder === 'asc') {
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                  />
                </svg>
                Ascending
              } @else {
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
                  />
                </svg>
                Descending
              }
            </button>
          </div>
        </div>

        <!-- Skeleton Loading State -->
        @if (loading() && tasks().length === 0) {
          <div class="space-y-3">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div
                class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 flex items-center gap-4"
              >
                <div
                  class="skeleton skeleton-circle w-5 h-5 flex-shrink-0"
                ></div>
                <div class="flex-1 space-y-2">
                  <div
                    class="skeleton skeleton-text"
                    [style.width]="60 + i * 8 + '%'"
                  ></div>
                  <div
                    class="skeleton skeleton-text w-24"
                    style="height: 0.625rem"
                  ></div>
                </div>
                <div
                  class="skeleton skeleton-circle w-7 h-7 flex-shrink-0"
                ></div>
              </div>
            }
          </div>
        }

        <!-- Error State -->
        @if (error()) {
          <div
            class="bg-[var(--status-red-bg)] border border-[var(--status-red-border)] rounded-lg p-4 flex items-center gap-3"
          >
            <svg
              class="w-5 h-5 text-red-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            <div>
              <p class="text-sm font-medium text-[var(--status-red-text)]">
                {{ error() }}
              </p>
              <button
                (click)="loadTasks(true)"
                class="text-sm text-red-600 hover:text-red-800 underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        }

        <!-- Empty State -->
        @if (!loading() && !error() && tasks().length === 0) {
          <div class="animate-fade-in-up text-center py-16">
            <div
              class="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 via-teal-50 to-primary/10 dark:from-emerald-900/30 dark:via-teal-900/20 dark:to-primary/10 flex items-center justify-center mb-5"
            >
              <svg
                class="w-10 h-10 text-emerald-500 dark:text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="1.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-[var(--foreground)] mb-2">
              You're all caught up!
            </h3>
            <p class="text-sm text-[var(--muted-foreground)] max-w-xs mx-auto">
              No tasks assigned to you right now. Enjoy the calm, or jump into a
              board to pick up some work.
            </p>
          </div>
        }

        <!-- Task List -->
        @if (!error() && tasks().length > 0) {
          <div class="space-y-3">
            @for (task of tasks(); track task.id) {
              <app-task-list-item [task]="task"></app-task-list-item>
            }
          </div>

          <!-- Infinite Scroll Trigger -->
          @if (hasMore()) {
            <div #scrollTrigger class="flex items-center justify-center py-8">
              @if (loading()) {
                <svg
                  class="animate-spin h-6 w-6 text-primary"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              } @else {
                <button
                  (click)="loadMore()"
                  class="text-sm text-primary hover:text-primary font-medium"
                >
                  Load more
                </button>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class MyTasksComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollTrigger') scrollTrigger: ElementRef | undefined;

  private myTasksService = inject(MyTasksService);
  private boardService = inject(BoardService);
  private authService = inject(AuthService);
  private wsService = inject(WebSocketService);
  private destroy$ = new Subject<void>();
  private intersectionObserver: IntersectionObserver | null = null;
  private observerInitialized = false;

  loading = signal(true);
  error = signal<string | null>(null);
  tasks = signal<MyTask[]>([]);
  summary = signal<MyTasksSummary | null>(null);
  boards = signal<Board[]>([]);
  nextCursor = signal<string | null>(null);

  hasMore = computed(() => this.nextCursor() !== null);

  selectedBoardId = '';
  sortBy: SortBy = 'due_date';
  sortOrder: SortOrder = 'asc';

  ngOnInit(): void {
    this.loadInitialData();
    this.setupWebSocket();
  }

  ngAfterViewChecked(): void {
    this.setupInfiniteScroll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    // Unsubscribe from user channel
    const userId = this.authService.currentUser()?.id;
    if (userId) {
      this.wsService.send('unsubscribe', { channel: `user:${userId}` });
    }
  }

  loadInitialData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      tasks: this.myTasksService.getMyTasks(this.buildParams()),
      summary: this.myTasksService.getMyTasksSummary(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ tasks, summary }) => {
          this.tasks.set(tasks.items);
          this.nextCursor.set(tasks.next_cursor);
          this.summary.set(summary);
          this.loading.set(false);
          this.loadBoards();
        },
        error: (err) => {
          console.error('Failed to load tasks:', err);
          this.error.set('Failed to load tasks. Please try again.');
          this.loading.set(false);
        },
      });
  }

  loadTasks(reset = false): void {
    if (reset) {
      this.tasks.set([]);
      this.nextCursor.set(null);
    }

    this.loading.set(true);
    this.error.set(null);

    this.myTasksService
      .getMyTasks(this.buildParams())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (reset) {
            this.tasks.set(response.items);
          } else {
            this.tasks.update((tasks) => [...tasks, ...response.items]);
          }
          this.nextCursor.set(response.next_cursor);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load tasks:', err);
          this.error.set('Failed to load tasks. Please try again.');
          this.loading.set(false);
        },
      });
  }

  loadMore(): void {
    if (this.loading() || !this.hasMore()) {
      return;
    }
    this.loadTasks(false);
  }

  onFilterChange(): void {
    this.loadTasks(true);
    this.loadSummary();
  }

  onSortChange(): void {
    this.loadTasks(true);
  }

  toggleSortOrder(): void {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.loadTasks(true);
  }

  private buildParams(): MyTasksParams {
    const params: MyTasksParams = {
      sort_by: this.sortBy,
      sort_order: this.sortOrder,
      limit: 20,
    };

    if (this.selectedBoardId) {
      params.board_id = this.selectedBoardId;
    }

    if (this.nextCursor()) {
      params.cursor = this.nextCursor()!;
    }

    return params;
  }

  private loadBoards(): void {
    // Extract unique boards from tasks
    const boardMap = new Map<string, Board>();
    for (const task of this.tasks()) {
      if (!boardMap.has(task.board_id)) {
        boardMap.set(task.board_id, {
          id: task.board_id,
          name: task.board_name,
          workspace_id: task.workspace_id,
          description: null,
          is_sample: false,
          position: '',
          created_at: '',
          updated_at: '',
        });
      }
    }
    this.boards.set(Array.from(boardMap.values()));
  }

  private loadSummary(): void {
    this.myTasksService
      .getMyTasksSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
        },
        error: (err) => {
          console.error('Failed to load summary:', err);
        },
      });
  }

  private setupWebSocket(): void {
    const userId = this.authService.currentUser()?.id;
    if (!userId) {
      return;
    }

    this.wsService.connect();

    // Subscribe to user channel for personal task updates
    this.wsService.send('subscribe', { channel: `user:${userId}` });

    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        this.handleWebSocketMessage(message);
      });
  }

  private handleWebSocketMessage(message: {
    type: string;
    payload: unknown;
  }): void {
    switch (message.type) {
      case 'task:assigned':
      case 'task:unassigned':
      case 'task:updated':
      case 'task:moved':
      case 'task:deleted':
        // Reload tasks and summary when relevant changes occur
        this.loadTasks(true);
        this.loadSummary();
        break;
    }
  }

  private setupInfiniteScroll(): void {
    // Only initialize once when the scroll trigger element exists
    if (this.observerInitialized || !this.scrollTrigger) {
      return;
    }

    this.observerInitialized = true;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.loading() && this.hasMore()) {
          this.loadMore();
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      },
    );

    this.intersectionObserver.observe(this.scrollTrigger.nativeElement);
  }
}
