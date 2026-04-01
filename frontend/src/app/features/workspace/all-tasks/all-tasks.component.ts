import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { Select } from 'primeng/select';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { UnifiedTaskCardComponent } from '../../../shared/components/task-card/task-card.component';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';
import {
  getPriorityLabel,
  getPriorityColorHex,
  getDueDateColor,
  isOverdue,
  isToday,
} from '../../../shared/utils/task-colors';

interface AllTask {
  id: string;
  title: string;
  priority: string;
  status_name: string | null;
  status_color: string | null;
  due_date: string | null;
  project_id: string;
  project_name: string;
  assignee_name: string | null;
  task_number: number | null;
  child_count: number;
  created_at: string;
}

interface AllTasksResponse {
  items: AllTask[];
  next_cursor: string | null;
}

@Component({
  selector: 'app-all-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    Select,
    EmptyStateComponent,
    UnifiedTaskCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-bold" style="color: var(--foreground)">All Tasks</h1>
        <div class="flex items-center gap-2">
          <p-select
            [options]="statusFilterOptions"
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event); loadTasks()"
            optionLabel="label"
            optionValue="value"
            placeholder="Status"
            [showClear]="true"
            styleClass="text-xs"
            aria-label="Filter by status"
          />
          <p-select
            [options]="priorityFilterOptions"
            [ngModel]="priorityFilter()"
            (ngModelChange)="priorityFilter.set($event); loadTasks()"
            optionLabel="label"
            optionValue="value"
            placeholder="Priority"
            [showClear]="true"
            styleClass="text-xs"
            aria-label="Filter by priority"
          />
          <p-select
            [options]="projectFilterOptions()"
            [ngModel]="projectFilter()"
            (ngModelChange)="projectFilter.set($event); loadTasks()"
            optionLabel="label"
            optionValue="value"
            placeholder="Project"
            [showClear]="true"
            styleClass="text-xs"
            aria-label="Filter by project"
          />
        </div>
      </div>

      @if (loading() && tasks().length === 0) {
        <div class="flex items-center justify-center py-16">
          <i class="pi pi-spin pi-spinner text-2xl" style="color: var(--muted-foreground)"></i>
        </div>
      } @else if (tasks().length === 0) {
        <app-empty-state
          variant="generic"
          title="No tasks found"
          description="Adjust your filters or create tasks in your projects."
        />
      } @else {
        <!-- Desktop table -->
        @if (!isMobile()) {
          <p-table
            [value]="tasks()"
            dataKey="id"
            [rowHover]="true"
            styleClass="p-datatable-sm"
          >
            <ng-template #header>
              <tr>
                <th style="width: 70px">#</th>
                <th style="min-width: 250px">Title</th>
                <th style="width: 130px">Project</th>
                <th style="width: 100px">Priority</th>
                <th style="width: 130px">Status</th>
                <th style="width: 100px">Assignee</th>
                <th style="width: 120px">Due Date</th>
              </tr>
            </ng-template>
            <ng-template #body let-task>
              <tr class="cursor-pointer" (click)="openTask(task)">
                <td class="text-xs" style="color: var(--muted-foreground)">
                  {{ task.task_number || '--' }}
                </td>
                <td>
                  <span class="text-sm font-medium" style="color: var(--foreground)">
                    {{ task.title }}
                  </span>
                </td>
                <td>
                  <span class="text-xs px-2 py-0.5 rounded-full"
                    style="background: var(--secondary); color: var(--secondary-foreground)">
                    {{ task.project_name }}
                  </span>
                </td>
                <td>
                  <span
                    class="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium text-white"
                    [style.background-color]="getPriorityBg(task.priority)"
                  >
                    {{ getPriorityText(task.priority) }}
                  </span>
                </td>
                <td>
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    [style.background]="task.status_color || 'var(--secondary)'"
                    [style.color]="task.status_color ? '#fff' : 'var(--secondary-foreground)'"
                  >
                    {{ task.status_name || '--' }}
                  </span>
                </td>
                <td class="text-xs" style="color: var(--muted-foreground)">
                  {{ task.assignee_name || '--' }}
                </td>
                <td>
                  @if (task.due_date) {
                    <span [class]="'text-xs ' + getDueDateClass(task.due_date)">
                      {{ formatDueDate(task.due_date) }}
                    </span>
                  } @else {
                    <span class="text-xs" style="color: var(--muted-foreground)">--</span>
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>
        } @else {
          <!-- Mobile cards -->
          <div class="space-y-2">
            @for (task of tasks(); track task.id) {
              <app-unified-task-card
                [task]="toCardData(task)"
                variant="compact"
                (clicked)="openTaskById($event)"
              />
            }
          </div>
        }

        <!-- Load more -->
        @if (nextCursor()) {
          <div class="flex justify-center mt-4">
            <button
              class="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
              style="border-color: var(--border); color: var(--foreground); background: var(--card)"
              [disabled]="loading()"
              (click)="loadMore()"
            >
              @if (loading()) {
                <i class="pi pi-spin pi-spinner mr-2"></i>
              }
              Load more
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      background: var(--background);
      color: var(--muted-foreground);
      font-weight: 600;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid var(--border);
    }
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr:hover {
      background: color-mix(in srgb, var(--background) 92%, var(--primary)) !important;
    }
  `],
})
export class AllTasksComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly wsContext = inject(WorkspaceContextService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tasks = signal<AllTask[]>([]);
  readonly loading = signal(false);
  readonly nextCursor = signal<string | null>(null);

  readonly statusFilter = signal<string | null>(null);
  readonly priorityFilter = signal<string | null>(null);
  readonly projectFilter = signal<string | null>(null);

  readonly isMobile = signal(typeof window !== 'undefined' && window.innerWidth < 768);

  readonly statusFilterOptions = [
    { label: 'To Do', value: 'todo' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Done', value: 'done' },
  ];

  readonly priorityFilterOptions = [
    { label: 'Urgent', value: 'urgent' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
  ];

  readonly projectFilterOptions = computed(() =>
    this.wsContext.activeProjects().map((p) => ({
      label: p.name,
      value: p.id,
    })),
  );

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.nextCursor.set(null);
    this.tasks.set([]);
    this.fetchTasks(null);
  }

  loadMore(): void {
    this.fetchTasks(this.nextCursor());
  }

  openTask(task: AllTask): void {
    const wsId = this.wsContext.activeWorkspaceId();
    if (wsId) {
      this.router.navigate(
        ['/workspace', wsId, 'project', task.project_id],
        { queryParams: { task: task.id } },
      );
    }
  }

  openTaskById(taskId: string): void {
    const task = this.tasks().find((t) => t.id === taskId);
    if (task) this.openTask(task);
  }

  getPriorityBg(priority: string): string {
    return getPriorityColorHex(priority).bg;
  }

  getPriorityText(priority: string): string {
    return getPriorityLabel(priority);
  }

  getDueDateClass(dueDate: string | null): string {
    const result = getDueDateColor(dueDate);
    return [result.class, result.chipClass].filter(Boolean).join(' ');
  }

  formatDueDate(date: string): string {
    if (isToday(date)) return 'Today';
    const dueDate = new Date(date);
    if (isOverdue(date)) {
      const today = new Date();
      const diffDays = Math.ceil(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return `Overdue (${diffDays}d)`;
    }
    return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  toCardData(task: AllTask): {
    id: string;
    title: string;
    priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
    status?: string | null;
    status_color?: string | null;
    due_date?: string | null;
    project_name?: string | null;
  } {
    return {
      id: task.id,
      title: task.title,
      priority: task.priority as 'urgent' | 'high' | 'medium' | 'low' | 'none',
      status: task.status_name,
      status_color: task.status_color,
      due_date: task.due_date,
      project_name: task.project_name,
    };
  }

  private fetchTasks(cursor: string | null): void {
    const wsId = this.wsContext.activeWorkspaceId();
    if (!wsId) return;

    this.loading.set(true);
    let params = new HttpParams().set('limit', '50');
    if (cursor) params = params.set('cursor', cursor);
    if (this.statusFilter()) params = params.set('status', this.statusFilter()!);
    if (this.priorityFilter()) params = params.set('priority', this.priorityFilter()!);
    if (this.projectFilter()) params = params.set('project_id', this.projectFilter()!);

    this.http
      .get<AllTasksResponse>(`/api/workspace/${wsId}/tasks`, { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.tasks.update((prev) => (cursor ? [...prev, ...res.items] : res.items));
          this.nextCursor.set(res.next_cursor);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }
}
