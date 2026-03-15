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
import { RouterModule } from '@angular/router';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import {
  MyTasksService,
  MyTask,
  MyTasksSummary,
} from '../../../core/services/my-tasks.service';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { TaskListItemComponent } from '../task-list-item/task-list-item.component';

type TimelineGroup =
  | 'overdue'
  | 'today'
  | 'this_week'
  | 'next_week'
  | 'later'
  | 'no_due_date'
  | 'completed_today';

interface GroupedTasks {
  overdue: MyTask[];
  today: MyTask[];
  this_week: MyTask[];
  next_week: MyTask[];
  later: MyTask[];
  no_due_date: MyTask[];
  completed_today: MyTask[];
}

interface GroupConfig {
  key: TimelineGroup;
  title: string;
  color: string;
  bgColor: string;
  defaultCollapsed: boolean;
}

type ViewMode = 'assigned' | 'created';

@Component({
  selector: 'app-my-tasks-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TaskListItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen" style="background: var(--background)">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Welcome Banner -->
        @if (summary()) {
          <div
            class="mb-6 rounded-xl p-6 animate-fade-in-up relative overflow-hidden"
            style="background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 65%, #7c3aed)); color: var(--primary-foreground)"
          >
            <!-- Subtle pattern overlay -->
            <div
              class="absolute inset-0 opacity-[0.06]"
              style="background-image: radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0); background-size: 24px 24px"
            ></div>
            <div class="relative">
              <h1 class="text-3xl font-extrabold mb-3 tracking-tight">
                {{ getGreeting() }}, {{ userName() }}!
              </h1>
              <div class="flex items-center gap-4 flex-wrap">
                <div class="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                  <span class="text-xl font-bold">{{ summary()!.total_assigned }}</span>
                  <span class="text-sm opacity-90">tasks</span>
                </div>
                @if (summary()!.overdue > 0) {
                  <div class="flex items-center gap-2 bg-red-500/30 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    <span class="text-xl font-bold">{{ summary()!.overdue }}</span>
                    <span class="text-sm opacity-90">overdue</span>
                  </div>
                }
                <div class="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                  <span class="text-xl font-bold">{{ summary()!.due_soon }}</span>
                  <span class="text-sm opacity-90">due soon</span>
                </div>
                <div class="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                  <span class="text-xl font-bold">{{ summary()!.completed_this_week }}</span>
                  <span class="text-sm opacity-90">done this week</span>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- View Toggle & Quick Add -->
        <div class="mb-4 flex items-center justify-between">
          <div
            class="inline-flex rounded-lg p-1"
            style="border: 1px solid var(--border); background: var(--card)"
          >
            <button
              (click)="viewMode.set('assigned')"
              class="px-4 py-2 text-sm font-medium rounded-md transition-colors"
              [class]="
                viewMode() === 'assigned'
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'hover:bg-[var(--muted)]'
              "
              [style.color]="
                viewMode() !== 'assigned' ? 'var(--foreground)' : ''
              "
            >
              My Tasks
            </button>
            <button
              (click)="viewMode.set('created'); loadTasks()"
              class="px-4 py-2 text-sm font-medium rounded-md transition-colors"
              [class]="
                viewMode() === 'created'
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'hover:bg-[var(--muted)]'
              "
              [style.color]="
                viewMode() !== 'created' ? 'var(--foreground)' : ''
              "
            >
              Tasks I Created
            </button>
          </div>

          <div class="flex items-center gap-2">
            <a
              routerLink="/eisenhower"
              class="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style="background: var(--card); border: 1px solid var(--border); color: var(--foreground)"
            >
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
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              Matrix View
            </a>
          </div>
        </div>

        <!-- Loading State -->
        @if (loading()) {
          <div class="space-y-4">
            @for (i of [1, 2, 3]; track i) {
              <div
                class="rounded-lg p-4"
                style="background: var(--card); border: 1px solid var(--border)"
              >
                <div class="skeleton skeleton-text w-32 mb-3"></div>
                <div class="space-y-2">
                  @for (j of [1, 2, 3]; track j) {
                    <div class="skeleton skeleton-card h-16"></div>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <!-- Timeline Groups -->
          <div class="space-y-4">
            @for (group of groups; track group.key; let gi = $index) {
              @let groupTasks = groupedTasks()[group.key];
              @if (groupTasks.length > 0 || group.key === 'overdue') {
                <div
                  class="rounded-lg border transition-all animate-fade-in-up"
                  [style.border-color]="group.color"
                  [style.background]="'var(--card)'"
                  [style.animation-delay]="gi * 0.06 + 's'"
                >
                  <!-- Group Header -->
                  <button
                    (click)="toggleGroup(group.key)"
                    class="w-full px-6 py-4 flex items-center justify-between transition-colors rounded-t-lg"
                    [style.background]="group.bgColor"
                  >
                    <div class="flex items-center gap-3">
                      <svg
                        class="w-5 h-5 transition-transform"
                        [class.rotate-90]="!collapsedGroups().has(group.key)"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        style="color: var(--foreground)"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      <h2
                        class="text-lg font-semibold"
                        style="color: var(--foreground)"
                      >
                        {{ group.title }}
                      </h2>
                      <span
                        class="px-2.5 py-0.5 rounded-full text-xs font-medium"
                        [style.background]="
                          group.key === 'overdue'
                            ? 'var(--status-red-bg)'
                            : 'var(--muted)'
                        "
                        [style.color]="
                          group.key === 'overdue'
                            ? 'var(--status-red-text)'
                            : 'var(--muted-foreground)'
                        "
                      >
                        {{ groupTasks.length }}
                      </span>
                    </div>
                  </button>

                  <!-- Group Content -->
                  @if (!collapsedGroups().has(group.key)) {
                    <div class="px-6 pb-4 space-y-2">
                      @for (task of groupTasks; track task.id) {
                        <app-task-list-item [task]="task"></app-task-list-item>
                      } @empty {
                        <div
                          class="text-center py-8"
                          style="color: var(--muted-foreground)"
                        >
                          <p class="text-sm">No tasks in this group</p>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            }
          </div>

          <!-- Empty State -->
          @if (allTasks().length === 0) {
            <div class="text-center py-16 animate-fade-in-up">
              <div
                class="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-5"
                style="background: color-mix(in srgb, var(--success) 12%, var(--card))"
              >
                <svg
                  class="w-10 h-10 text-emerald-500"
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
              <h3
                class="text-lg font-semibold mb-2"
                style="color: var(--foreground)"
              >
                You're all caught up!
              </h3>
              <p
                class="text-sm max-w-xs mx-auto"
                style="color: var(--muted-foreground)"
              >
                No tasks
                {{
                  viewMode() === 'created'
                    ? 'created by you'
                    : 'assigned to you'
                }}
                right now.
              </p>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .skeleton {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        background: var(--muted);
        border-radius: 0.25rem;
      }
      .skeleton-text {
        height: 1rem;
      }
      .skeleton-card {
        height: 5rem;
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
    `,
  ],
})
export class MyTasksTimelineComponent implements OnInit, OnDestroy {
  private myTasksService = inject(MyTasksService);
  private authService = inject(AuthService);
  private wsService = inject(WebSocketService);
  private destroy$ = new Subject<void>();

  loading = signal(true);
  allTasks = signal<MyTask[]>([]);
  summary = signal<MyTasksSummary | null>(null);
  viewMode = signal<ViewMode>('assigned');
  collapsedGroups = signal<Set<TimelineGroup>>(
    new Set<TimelineGroup>(['later', 'no_due_date', 'completed_today']),
  );

  groups: GroupConfig[] = [
    {
      key: 'overdue',
      title: 'Overdue',
      color: 'var(--status-red-border)',
      bgColor: 'var(--status-red-bg)',
      defaultCollapsed: false,
    },
    {
      key: 'today',
      title: 'Today',
      color: 'var(--status-blue-border)',
      bgColor: 'var(--status-blue-bg)',
      defaultCollapsed: false,
    },
    {
      key: 'this_week',
      title: 'This Week',
      color: 'var(--status-green-border)',
      bgColor: 'var(--status-green-bg)',
      defaultCollapsed: false,
    },
    {
      key: 'next_week',
      title: 'Next Week',
      color: 'color-mix(in srgb, var(--primary) 40%, transparent)',
      bgColor: 'color-mix(in srgb, var(--primary) 6%, var(--card))',
      defaultCollapsed: false,
    },
    {
      key: 'later',
      title: 'Later',
      color: 'var(--border)',
      bgColor: 'var(--muted)',
      defaultCollapsed: true,
    },
    {
      key: 'no_due_date',
      title: 'No Due Date',
      color: 'var(--border)',
      bgColor: 'var(--muted)',
      defaultCollapsed: true,
    },
    {
      key: 'completed_today',
      title: 'Completed Today',
      color: 'var(--status-green-border)',
      bgColor: 'var(--status-green-bg)',
      defaultCollapsed: true,
    },
  ];

  groupedTasks = computed(() => {
    return this.groupTasksByTimeline(this.allTasks());
  });

  userName = computed(() => {
    const user = this.authService.currentUser();
    return user?.name || user?.email?.split('@')[0] || 'there';
  });

  ngOnInit() {
    this.loadTasks();
    this.loadSummary();
    this.setupWebSocket();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    const userId = this.authService.currentUser()?.id;
    if (userId) {
      this.wsService.send('unsubscribe', { channel: `user:${userId}` });
    }
  }

  async loadTasks() {
    this.loading.set(true);
    try {
      const response = await firstValueFrom(
        this.myTasksService.getMyTasks({
          sort_by: 'due_date',
          sort_order: 'asc',
          limit: 200,
        }),
      );

      if (response) {
        this.allTasks.set(response.items);
      }
    } catch {
      // Tasks will show empty state
    } finally {
      this.loading.set(false);
    }
  }

  async loadSummary() {
    try {
      const summary = await firstValueFrom(
        this.myTasksService.getMyTasksSummary(),
      );
      this.summary.set(summary || null);
    } catch {
      // Summary will show null state
    }
  }

  toggleGroup(group: TimelineGroup) {
    const collapsed = this.collapsedGroups();
    const newSet = new Set(collapsed);
    if (newSet.has(group)) {
      newSet.delete(group);
    } else {
      newSet.add(group);
    }
    this.collapsedGroups.set(newSet);
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  private groupTasksByTimeline(tasks: MyTask[]): GroupedTasks {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get end of this week (Sunday)
    const endOfWeek = new Date(today);
    const daysUntilSunday = 7 - today.getDay();
    endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);

    // Get end of next week
    const endOfNextWeek = new Date(endOfWeek);
    endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);

    const grouped: GroupedTasks = {
      overdue: [],
      today: [],
      this_week: [],
      next_week: [],
      later: [],
      no_due_date: [],
      completed_today: [],
    };

    for (const task of tasks) {
      // Completed today
      if (this.isTaskComplete(task) && task.updated_at) {
        const updatedDate = new Date(task.updated_at);
        if (
          updatedDate.getFullYear() === today.getFullYear() &&
          updatedDate.getMonth() === today.getMonth() &&
          updatedDate.getDate() === today.getDate()
        ) {
          grouped.completed_today.push(task);
          continue;
        }
      }

      // No due date
      if (!task.due_date) {
        if (!this.isTaskComplete(task)) {
          grouped.no_due_date.push(task);
        }
        continue;
      }

      const dueDate = new Date(task.due_date);
      const dueDateOnly = new Date(
        dueDate.getFullYear(),
        dueDate.getMonth(),
        dueDate.getDate(),
      );

      // Skip completed tasks (except completed today)
      if (this.isTaskComplete(task)) {
        continue;
      }

      // Overdue
      if (dueDateOnly < today) {
        grouped.overdue.push(task);
      }
      // Today
      else if (dueDateOnly.getTime() === today.getTime()) {
        grouped.today.push(task);
      }
      // This week (tomorrow through end of week)
      else if (dueDateOnly >= tomorrow && dueDateOnly <= endOfWeek) {
        grouped.this_week.push(task);
      }
      // Next week
      else if (dueDateOnly > endOfWeek && dueDateOnly <= endOfNextWeek) {
        grouped.next_week.push(task);
      }
      // Later
      else {
        grouped.later.push(task);
      }
    }

    return grouped;
  }

  private setupWebSocket() {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return;

    this.wsService.connect();
    this.wsService.send('subscribe', { channel: `user:${userId}` });

    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        switch (message.type) {
          case 'task:assigned':
          case 'task:unassigned':
          case 'task:updated':
          case 'task:moved':
          case 'task:deleted':
            this.loadTasks();
            this.loadSummary();
            break;
        }
      });
  }

  /**
   * Check if a task is completed based on column status mapping
   */
  private isTaskComplete(task: MyTask): boolean {
    if (task.is_done !== undefined) return task.is_done;
    if (!task.column_status_mapping) {
      return false;
    }
    // Check if the column's status_mapping indicates this is a "done" column
    return task.column_status_mapping.done === true;
  }
}
