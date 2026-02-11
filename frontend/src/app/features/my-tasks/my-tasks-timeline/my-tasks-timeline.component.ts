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
import { Subject, takeUntil } from 'rxjs';
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
    <div class="min-h-screen bg-gray-50">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Welcome Banner -->
        @if (summary()) {
          <div class="mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
            <h1 class="text-3xl font-bold mb-2">
              {{ getGreeting() }}, {{ userName() }}!
            </h1>
            <div class="flex items-center gap-6 text-sm">
              <span>
                <span class="font-semibold text-lg">{{ summary()!.total_assigned }}</span>
                total tasks
              </span>
              <span>•</span>
              <span>
                <span class="font-semibold text-lg">{{ summary()!.overdue }}</span>
                overdue
              </span>
              <span>•</span>
              <span>
                <span class="font-semibold text-lg">{{ summary()!.due_soon }}</span>
                due soon
              </span>
              <span>•</span>
              <span>
                <span class="font-semibold text-lg">{{ summary()!.completed_this_week }}</span>
                completed this week
              </span>
            </div>
          </div>
        }

        <!-- View Toggle & Quick Add -->
        <div class="mb-4 flex items-center justify-between">
          <div class="inline-flex rounded-lg border border-gray-300 bg-white p-1">
            <button
              (click)="viewMode.set('assigned')"
              class="px-4 py-2 text-sm font-medium rounded-md transition-colors"
              [class]="viewMode() === 'assigned' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'"
            >
              My Tasks
            </button>
            <button
              (click)="viewMode.set('created'); loadTasks()"
              class="px-4 py-2 text-sm font-medium rounded-md transition-colors"
              [class]="viewMode() === 'created' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'"
            >
              Tasks I Created
            </button>
          </div>

          <div class="flex items-center gap-2">
            <a
              routerLink="/eisenhower"
              class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
              </svg>
              Matrix View
            </a>
          </div>
        </div>

        <!-- Loading State -->
        @if (loading()) {
          <div class="space-y-4">
            @for (i of [1,2,3]; track i) {
              <div class="bg-white rounded-lg border border-gray-200 p-4">
                <div class="skeleton skeleton-text w-32 mb-3"></div>
                <div class="space-y-2">
                  @for (j of [1,2,3]; track j) {
                    <div class="skeleton skeleton-card h-16"></div>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <!-- Timeline Groups -->
          <div class="space-y-4">
            @for (group of groups; track group.key) {
              @let groupTasks = groupedTasks()[group.key];
              @if (groupTasks.length > 0 || group.key === 'overdue') {
                <div
                  class="bg-white rounded-lg border-2 transition-all"
                  [style.border-color]="group.color"
                >
                  <!-- Group Header -->
                  <button
                    (click)="toggleGroup(group.key)"
                    class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    [style.background]="group.bgColor"
                  >
                    <div class="flex items-center gap-3">
                      <svg
                        class="w-5 h-5 transition-transform"
                        [class.rotate-90]="!collapsedGroups().has(group.key)"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                      </svg>
                      <h2 class="text-lg font-semibold text-gray-900">
                        {{ group.title }}
                      </h2>
                      <span
                        class="px-2.5 py-0.5 rounded-full text-xs font-medium"
                        [class]="group.key === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'"
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
                        <div class="text-center py-8 text-gray-400">
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
            <div class="text-center py-16">
              <div class="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 via-teal-50 to-indigo-100 flex items-center justify-center mb-5">
                <svg class="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">You're all caught up!</h3>
              <p class="text-sm text-gray-500 max-w-xs mx-auto">
                No tasks {{ viewMode() === 'created' ? 'created by you' : 'assigned to you' }} right now.
              </p>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .skeleton {
      @apply animate-pulse bg-gray-200 rounded;
    }
    .skeleton-text {
      @apply h-4;
    }
    .skeleton-card {
      @apply h-20;
    }
  `],
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
    new Set<TimelineGroup>(['later', 'no_due_date', 'completed_today'])
  );

  groups: GroupConfig[] = [
    {
      key: 'overdue',
      title: 'Overdue',
      color: '#dc2626',
      bgColor: '#fef2f2',
      defaultCollapsed: false,
    },
    {
      key: 'today',
      title: 'Today',
      color: '#2563eb',
      bgColor: '#eff6ff',
      defaultCollapsed: false,
    },
    {
      key: 'this_week',
      title: 'This Week',
      color: '#16a34a',
      bgColor: '#f0fdf4',
      defaultCollapsed: false,
    },
    {
      key: 'next_week',
      title: 'Next Week',
      color: '#9333ea',
      bgColor: '#faf5ff',
      defaultCollapsed: false,
    },
    {
      key: 'later',
      title: 'Later',
      color: '#6b7280',
      bgColor: '#f9fafb',
      defaultCollapsed: true,
    },
    {
      key: 'no_due_date',
      title: 'No Due Date',
      color: '#6b7280',
      bgColor: '#f9fafb',
      defaultCollapsed: true,
    },
    {
      key: 'completed_today',
      title: 'Completed Today',
      color: '#059669',
      bgColor: '#ecfdf5',
      defaultCollapsed: true,
    },
  ];

  groupedTasks = computed(() => {
    return this.groupTasksByTimeline(this.allTasks());
  });

  userName = computed(() => {
    const user = this.authService.currentUser();
    return user?.display_name || user?.email?.split('@')[0] || 'there';
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
      const response = await this.myTasksService
        .getMyTasks({
          sort_by: 'due_date',
          sort_order: 'asc',
          limit: 1000, // Load all tasks for grouping
        })
        .toPromise();

      if (response) {
        this.allTasks.set(response.items);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async loadSummary() {
    try {
      const summary = await this.myTasksService.getMyTasksSummary().toPromise();
      this.summary.set(summary || null);
    } catch (error) {
      console.error('Failed to load summary:', error);
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
        dueDate.getDate()
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

    this.wsService.messages$.pipe(takeUntil(this.destroy$)).subscribe((message) => {
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
    if (!task.column_status_mapping) {
      return false;
    }
    // Check if the column's status_mapping indicates this is a "done" column
    return task.column_status_mapping.done === true;
  }
}
