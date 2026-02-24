import {
  Component,
  OnInit,
  signal,
  inject,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  MyTasksService,
  MyTask,
} from '../../../core/services/my-tasks.service';

@Component({
  selector: 'app-my-tasks-today',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="widget-title flex items-center gap-2">
          <i class="pi pi-calendar text-primary text-sm"></i>
          My Tasks Today
        </h3>
        <a
          routerLink="/my-tasks"
          class="text-xs text-primary hover:underline font-medium"
        >
          View all
        </a>
      </div>

      @if (loading()) {
        <div class="space-y-2">
          @for (i of [1, 2, 3]; track i) {
            <div class="skeleton skeleton-row"></div>
          }
        </div>
      } @else if (filteredTasks().length === 0) {
        <div class="flex items-center gap-3 py-2 px-1">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style="background: color-mix(in srgb, var(--success) 12%, transparent)"
          >
            <i class="pi pi-check-circle text-sm text-emerald-500"></i>
          </div>
          <div>
            <p class="text-sm font-medium" style="color: var(--foreground)">
              You're all caught up!
            </p>
            <p class="text-xs" style="color: var(--muted-foreground)">
              No tasks due today or overdue
            </p>
          </div>
        </div>
      } @else {
        <div class="space-y-1">
          @for (task of filteredTasks().slice(0, 8); track task.id) {
            <div
              class="flex items-start gap-3 p-2.5 rounded-lg transition-colors"
              style="background: transparent"
              onmouseover="this.style.background='var(--muted)'"
              onmouseout="this.style.background='transparent'"
            >
              <!-- Priority indicator -->
              <div
                class="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                [class]="getPriorityDotClass(task.priority)"
              ></div>

              <!-- Task info -->
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-medium truncate"
                  style="color: var(--foreground)"
                >
                  {{ task.title }}
                </p>
                <div
                  class="flex items-center gap-2 mt-0.5 text-xs"
                  style="color: var(--muted-foreground)"
                >
                  <span>{{ task.board_name }}</span>
                  @if (isOverdue(task)) {
                    <span class="text-red-500 font-medium">Overdue</span>
                  } @else if (isDueToday(task)) {
                    <span class="text-orange-500 font-medium">Due today</span>
                  } @else if (isDueTomorrow(task)) {
                    <span class="text-amber-500 font-medium">Due tomorrow</span>
                  }
                </div>
              </div>

              <!-- Column badge -->
              <span
                class="text-[11px] px-2 py-0.5 rounded-md flex-shrink-0"
                style="background: var(--muted); color: var(--muted-foreground)"
              >
                {{ task.column_name }}
              </span>
            </div>
          }
        </div>

        @if (filteredTasks().length > 8) {
          <p
            class="text-xs mt-3 text-center"
            style="color: var(--muted-foreground)"
          >
            +{{ filteredTasks().length - 8 }} more tasks
          </p>
        }
      }
    </div>
  `,
})
export class MyTasksTodayComponent implements OnInit {
  private myTasksService = inject(MyTasksService);

  workspaceId = input<string | undefined>();

  loading = signal(true);
  allTasks = signal<MyTask[]>([]);
  filteredTasks = computed(() =>
    this.filterTasks(this.allTasks(), this.workspaceId()),
  );

  ngOnInit(): void {
    this.loadTasks();
  }

  isOverdue(task: MyTask): boolean {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }

  isDueToday(task: MyTask): boolean {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const today = new Date();
    return dueDate.toDateString() === today.toDateString();
  }

  isDueTomorrow(task: MyTask): boolean {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dueDate.toDateString() === tomorrow.toDateString();
  }

  getPriorityDotClass(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-blue-500';
      case 'low':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  }

  private filterTasks(tasks: MyTask[], wsId?: string): MyTask[] {
    let filtered = tasks.filter(
      (t) => this.isOverdue(t) || this.isDueToday(t) || this.isDueTomorrow(t),
    );
    if (wsId) {
      filtered = filtered.filter((t) => t.workspace_id === wsId);
    }
    return filtered.sort((a, b) => {
      const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return aDate - bDate;
    });
  }

  private loadTasks(): void {
    this.loading.set(true);
    this.myTasksService
      .getMyTasks({ sort_by: 'due_date', sort_order: 'asc', limit: 50 })
      .subscribe({
        next: (response) => {
          this.allTasks.set(response.items);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }
}
