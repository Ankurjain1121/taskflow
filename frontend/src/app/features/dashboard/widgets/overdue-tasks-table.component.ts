import {
  Component,
  signal,
  inject,
  Injector,
  input,
  effect,
  untracked,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TableModule } from 'primeng/table';
import {
  DashboardService,
  OverdueTask,
} from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-overdue-tasks-table',
  standalone: true,
  imports: [CommonModule, TableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card h-full flex flex-col overflow-hidden">
      <div class="px-5 py-3.5" style="border-bottom: 1px solid var(--border)">
        <h3 class="widget-title">Overdue Tasks</h3>
      </div>

      @if (loading()) {
        <div class="flex-1 p-5 space-y-2">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <div class="skeleton skeleton-row"></div>
          }
        </div>
      } @else if (tasks().length > 0) {
        <div class="flex-1 overflow-auto">
          <p-table
            [value]="tasks()"
            [paginator]="tasks().length > 5"
            [rows]="5"
            sortField="days_overdue"
            [sortOrder]="-1"
            styleClass="p-datatable-sm"
            [rowHover]="true"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="title">
                  Task <p-sortIcon field="title" />
                </th>
                <th pSortableColumn="project_name">
                  Project <p-sortIcon field="project_name" />
                </th>
                <th pSortableColumn="priority">
                  Priority <p-sortIcon field="priority" />
                </th>
                <th pSortableColumn="days_overdue">
                  Days Overdue <p-sortIcon field="days_overdue" />
                </th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-task>
              <tr class="cursor-pointer" (click)="navigateToTask(task)">
                <td>
                  <span
                    class="text-sm font-medium truncate max-w-xs block"
                    style="color: var(--foreground)"
                  >
                    {{ task.title }}
                  </span>
                </td>
                <td>
                  <span
                    class="text-sm"
                    style="color: var(--muted-foreground)"
                    >{{ task.project_name }}</span
                  >
                </td>
                <td>
                  <span
                    class="px-2 py-0.5 text-[11px] font-medium rounded-md"
                    [class]="getPriorityClass(task.priority)"
                  >
                    {{ task.priority }}
                  </span>
                </td>
                <td>
                  <span
                    class="text-sm font-semibold text-red-600 dark:text-red-400 font-display"
                  >
                    {{ task.days_overdue }}d
                  </span>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td
                  colspan="4"
                  class="text-center py-8"
                  style="color: var(--muted-foreground)"
                >
                  No overdue tasks!
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      } @else {
        <div
          class="flex-1 flex items-center justify-center"
          style="color: var(--muted-foreground)"
        >
          <div class="text-center">
            <i class="pi pi-check-circle text-3xl text-green-400 mb-2"></i>
            <p class="text-sm">No overdue tasks!</p>
          </div>
        </div>
      }
    </div>
  `,
})
export class OverdueTasksTableComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private router = inject(Router);
  private injector = inject(Injector);

  workspaceId = input<string | undefined>();

  loading = signal(true);
  tasks = signal<OverdueTask[]>([]);

  ngOnInit(): void {
    effect(
      () => {
        this.workspaceId();
        untracked(() => this.loadData());
      },
      { injector: this.injector },
    );
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(
        this.dashboardService.getOverdueTasks(10, this.workspaceId()),
      );
      this.tasks.set(data || []);
    } catch {
      // Table will show empty state
    } finally {
      this.loading.set(false);
    }
  }

  navigateToTask(task: OverdueTask): void {
    this.router.navigate(['/task', task.id]);
  }

  getPriorityClass(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'low':
        return 'bg-[var(--muted)] text-[var(--foreground)]';
      default:
        return 'bg-[var(--muted)] text-[var(--muted-foreground)]';
    }
  }
}
