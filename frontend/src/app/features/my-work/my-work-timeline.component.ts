import {
  Component,
  signal,
  computed,
  inject,
  input,
  effect,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { MyTasksService, MyTask, MyTasksSummary } from '../../core/services/my-tasks.service';
import { TaskService } from '../../core/services/task.service';
import { AuthService } from '../../core/services/auth.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { UnifiedTaskCardComponent } from '../../shared/components/task-card/task-card.component';
import { TaskCardData } from '../../shared/components/task-card/task-card-data';

type TimelineGroup = 'overdue' | 'today' | 'this_week' | 'next_week' | 'later' | 'no_due_date';

interface GroupConfig {
  key: TimelineGroup;
  title: string;
  color: string;
  bgColor: string;
}

@Component({
  selector: 'app-my-work-timeline',
  standalone: true,
  imports: [RouterModule, UnifiedTaskCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="space-y-4">
        @for (i of [1, 2, 3]; track i) {
          <div class="rounded-lg p-4" style="background: var(--card); border: 1px solid var(--border)">
            <div class="animate-pulse h-4 w-32 rounded mb-3" style="background: var(--muted)"></div>
            <div class="space-y-2">
              @for (j of [1, 2]; track j) {
                <div class="animate-pulse h-16 rounded" style="background: var(--muted)"></div>
              }
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="space-y-4">
        @for (group of groups; track group.key; let gi = $index) {
          @if (groupedTasks()[group.key].length > 0) {
            <div
              class="rounded-lg border transition-all animate-fade-in-up"
              [style.border-color]="group.color"
              [style.background]="'var(--card)'"
              [style.animation-delay]="gi * 0.06 + 's'"
            >
              <button
                (click)="toggleGroup(group.key)"
                class="w-full px-5 py-3.5 flex items-center justify-between rounded-t-lg"
                [style.background]="group.bgColor"
              >
                <div class="flex items-center gap-3">
                  <svg
                    class="w-4 h-4 transition-transform"
                    [class.rotate-90]="!collapsed().has(group.key)"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    style="color: var(--foreground)"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  <h2 class="text-xs font-semibold uppercase tracking-wider" style="color: var(--foreground)">{{ group.title }}</h2>
                  <span
                    class="px-2 py-0.5 rounded-full text-xs font-medium"
                    [style.background]="group.key === 'overdue' ? 'var(--status-red-bg)' : 'var(--muted)'"
                    [style.color]="group.key === 'overdue' ? 'var(--status-red-text)' : 'var(--muted-foreground)'"
                  >{{ groupedTasks()[group.key].length }}</span>
                </div>
              </button>
              @if (!collapsed().has(group.key)) {
                <div class="px-5 pb-4 space-y-2 pt-2">
                  @for (card of toCards(groupedTasks()[group.key]); track card.id) {
                    <app-unified-task-card [task]="card" [variant]="'timeline'" [showCheckbox]="true" (clicked)="onTaskClick($event)" (completed)="onCompleteTask($event)" />
                  }
                </div>
              }
            </div>
          }
        }
      </div>

      @if (allTasks().length === 0) {
        <div class="text-center py-16 animate-fade-in-up">
          <div
            class="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style="background: color-mix(in srgb, var(--success) 12%, var(--card))"
          >
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" style="color: var(--success)">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold font-display mb-1" style="color: var(--foreground)">All caught up!</h3>
          <p class="text-sm" style="color: var(--muted-foreground)">No tasks assigned to you right now.</p>
        </div>
      }
    }
  `,
})
export class MyWorkTimelineComponent implements OnInit, OnDestroy {
  readonly refreshTrigger = input(0);

  private myTasksService = inject(MyTasksService);
  private taskService = inject(TaskService);
  private authService = inject(AuthService);
  private wsService = inject(WebSocketService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly allTasks = signal<MyTask[]>([]);
  readonly collapsed = signal<Set<TimelineGroup>>(new Set<TimelineGroup>(['later', 'no_due_date']));

  readonly groups: GroupConfig[] = [
    { key: 'overdue', title: 'Overdue', color: 'var(--status-red-border)', bgColor: 'var(--status-red-bg)' },
    { key: 'today', title: 'Today', color: 'var(--status-blue-border)', bgColor: 'var(--status-blue-bg)' },
    { key: 'this_week', title: 'This Week', color: 'var(--status-green-border)', bgColor: 'var(--status-green-bg)' },
    { key: 'next_week', title: 'Next Week', color: 'color-mix(in srgb, var(--primary) 40%, transparent)', bgColor: 'color-mix(in srgb, var(--primary) 6%, var(--card))' },
    { key: 'later', title: 'Later', color: 'var(--border)', bgColor: 'var(--muted)' },
    { key: 'no_due_date', title: 'No Due Date', color: 'var(--border)', bgColor: 'var(--muted)' },
  ];

  readonly groupedTasks = computed(() => this.groupByTimeline(this.allTasks()));

  constructor() {
    effect(() => {
      const trigger = this.refreshTrigger();
      if (trigger > 0) {
        this.loadTasks();
      }
    });
  }

  ngOnInit() {
    this.loadTasks();
    this.setupWebSocket();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleGroup(key: TimelineGroup) {
    const current = this.collapsed();
    const next = new Set(current);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.collapsed.set(next);
  }

  onTaskClick(taskId: string): void {
    this.router.navigate(['/task', taskId]);
  }

  onCompleteTask(taskId: string): void {
    this.taskService.completeTask(taskId).subscribe({
      next: () => {
        setTimeout(() => {
          this.allTasks.update(tasks => tasks.filter(t => t.id !== taskId));
        }, 600);
      },
    });
  }

  toCards(tasks: MyTask[]): TaskCardData[] {
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority || 'none',
      due_date: t.due_date,
      status: t.status_name,
      project_name: t.board_name,
      assignee: t.assignees?.[0]
        ? { id: t.assignees[0].id, name: t.assignees[0].display_name }
        : null,
    }));
  }

  private async loadTasks() {
    this.loading.set(true);
    try {
      const response = await firstValueFrom(
        this.myTasksService.getMyTasks({ sort_by: 'due_date', sort_order: 'asc', limit: 200 }),
      );
      if (response) {
        this.allTasks.set(response.items);
      }
    } catch (err) {
      console.error('Failed to load my tasks:', err);
    } finally {
      this.loading.set(false);
    }
  }

  private setupWebSocket() {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return;
    this.wsService.connect();
    this.wsService.send('subscribe', { channel: `user:${userId}` });
    this.wsService.messages$.pipe(takeUntil(this.destroy$)).subscribe((msg) => {
      if (['task:assigned', 'task:unassigned', 'task:updated', 'task:moved', 'task:deleted'].includes(msg.type)) {
        this.loadTasks();
      }
    });
  }

  private groupByTimeline(tasks: MyTask[]): Record<TimelineGroup, MyTask[]> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()));
    const endOfNextWeek = new Date(endOfWeek);
    endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);

    const groups: Record<TimelineGroup, MyTask[]> = {
      overdue: [], today: [], this_week: [], next_week: [], later: [], no_due_date: [],
    };

    for (const task of tasks) {
      if (task.is_done) continue;
      if (!task.due_date) { groups.no_due_date.push(task); continue; }
      const due = new Date(task.due_date);
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      if (dueDay < today) groups.overdue.push(task);
      else if (dueDay.getTime() === today.getTime()) groups.today.push(task);
      else if (dueDay >= tomorrow && dueDay <= endOfWeek) groups.this_week.push(task);
      else if (dueDay > endOfWeek && dueDay <= endOfNextWeek) groups.next_week.push(task);
      else groups.later.push(task);
    }
    return groups;
  }
}
