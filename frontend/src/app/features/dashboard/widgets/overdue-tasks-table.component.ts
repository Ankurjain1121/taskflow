import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TableModule } from 'primeng/table';
import { DashboardService, OverdueTask } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-overdue-tasks-table',
  standalone: true,
  imports: [CommonModule, TableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 h-full flex flex-col">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Overdue Tasks</h3>
      </div>

      @if (loading()) {
        <div class="flex-1 flex items-center justify-center">
          <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
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
            [rowHover]="true">
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="title">
                  Task <p-sortIcon field="title" />
                </th>
                <th pSortableColumn="board_name">
                  Board <p-sortIcon field="board_name" />
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
                  <span class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs block">
                    {{ task.title }}
                  </span>
                </td>
                <td>
                  <span class="text-sm text-gray-500 dark:text-gray-400">{{ task.board_name }}</span>
                </td>
                <td>
                  <span
                    class="px-2 py-1 text-xs font-medium rounded-full"
                    [class]="getPriorityClass(task.priority)">
                    {{ task.priority }}
                  </span>
                </td>
                <td>
                  <span class="text-sm font-semibold text-red-600 dark:text-red-400">
                    {{ task.days_overdue }}d
                  </span>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="4" class="text-center py-8 text-gray-400">
                  No overdue tasks!
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      } @else {
        <div class="flex-1 flex items-center justify-center text-gray-400">
          <div class="text-center">
            <i class="pi pi-check-circle text-4xl text-green-400 mb-2"></i>
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

  loading = signal(true);
  tasks = signal<OverdueTask[]>([]);

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.dashboardService.getOverdueTasks(10));
      this.tasks.set(data || []);
    } catch {
      // Table will show empty state
    } finally {
      this.loading.set(false);
    }
  }

  navigateToTask(task: OverdueTask): void {
    this.router.navigate(['/board', task.board_id], { queryParams: { task: task.id } });
  }

  getPriorityClass(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    }
  }
}
