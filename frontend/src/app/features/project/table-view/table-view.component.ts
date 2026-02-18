import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskCard } from '../../../shared/types/task.types';
import { ProjectColumn } from '../../../shared/types/project.types';

type SortField = 'display_id' | 'title' | 'status' | 'priority' | 'due_date';
type SortDirection = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

@Component({
  selector: 'app-table-view',
  standalone: true,
  imports: [
    CommonModule,
  ],
  template: `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[800px] text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700 text-left">
            <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none w-24"
                (click)="toggleSort('display_id')">
              <div class="flex items-center gap-1">
                ID
                @if (sortField() === 'display_id') {
                  <i class="pi !text-[14px]" [class]="sortDirection() === 'asc' ? 'pi-arrow-up' : 'pi-arrow-down'"></i>
                }
              </div>
            </th>
            <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none"
                (click)="toggleSort('title')">
              <div class="flex items-center gap-1">
                Title
                @if (sortField() === 'title') {
                  <i class="pi !text-[14px]" [class]="sortDirection() === 'asc' ? 'pi-arrow-up' : 'pi-arrow-down'"></i>
                }
              </div>
            </th>
            <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none w-36"
                (click)="toggleSort('status')">
              <div class="flex items-center gap-1">
                Status
                @if (sortField() === 'status') {
                  <i class="pi !text-[14px]" [class]="sortDirection() === 'asc' ? 'pi-arrow-up' : 'pi-arrow-down'"></i>
                }
              </div>
            </th>
            <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none w-28"
                (click)="toggleSort('priority')">
              <div class="flex items-center gap-1">
                Priority
                @if (sortField() === 'priority') {
                  <i class="pi !text-[14px]" [class]="sortDirection() === 'asc' ? 'pi-arrow-up' : 'pi-arrow-down'"></i>
                }
              </div>
            </th>
            <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-32">
              Assignees
            </th>
            <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none w-32"
                (click)="toggleSort('due_date')">
              <div class="flex items-center gap-1">
                Due Date
                @if (sortField() === 'due_date') {
                  <i class="pi !text-[14px]" [class]="sortDirection() === 'asc' ? 'pi-arrow-up' : 'pi-arrow-down'"></i>
                }
              </div>
            </th>
            <th class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-40">
              Labels
            </th>
          </tr>
        </thead>
        <tbody>
          @for (task of sortedTasks(); track task.id) {
            <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                (click)="taskClicked.emit(task)">
              <!-- Display ID -->
              <td class="px-4 py-3">
                @if (task.display_id) {
                  <span class="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                    {{ task.display_id }}
                  </span>
                }
              </td>

              <!-- Title -->
              <td class="px-4 py-3">
                <span class="text-gray-900 dark:text-gray-100 font-medium">{{ task.title }}</span>
              </td>

              <!-- Status (column name) -->
              <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                      [style.background-color]="getColumnColor(task.column_id) + '20'"
                      [style.color]="getColumnColor(task.column_id)">
                  <span class="w-1.5 h-1.5 rounded-full" [style.background-color]="getColumnColor(task.column_id)"></span>
                  {{ getColumnName(task.column_id) }}
                </span>
              </td>

              <!-- Priority -->
              <td class="px-4 py-3">
                <span class="text-xs font-medium px-2 py-1 rounded-full"
                      [class]="priorityClass(task.priority)">
                  {{ task.priority }}
                </span>
              </td>

              <!-- Assignees -->
              <td class="px-4 py-3">
                <div class="flex -space-x-1.5">
                  @for (assignee of task.assignees.slice(0, 3); track assignee.user_id) {
                    <div class="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white font-medium ring-2 ring-white dark:ring-gray-900"
                         [title]="assignee.name">
                      {{ assignee.name.charAt(0).toUpperCase() }}
                    </div>
                  }
                  @if (task.assignees.length > 3) {
                    <div class="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-[10px] text-gray-700 dark:text-gray-300 font-medium ring-2 ring-white dark:ring-gray-900">
                      +{{ task.assignees.length - 3 }}
                    </div>
                  }
                  @if (task.assignees.length === 0) {
                    <span class="text-xs text-gray-400">--</span>
                  }
                </div>
              </td>

              <!-- Due Date -->
              <td class="px-4 py-3">
                @if (task.due_date) {
                  <span class="text-xs" [class]="isOverdue(task.due_date) ? 'text-red-500 font-medium' : 'text-gray-600 dark:text-gray-400'">
                    {{ formatDate(task.due_date) }}
                    @if (isOverdue(task.due_date)) {
                      <i class="pi pi-exclamation-triangle !text-[12px] ml-0.5 align-middle"></i>
                    }
                  </span>
                } @else {
                  <span class="text-xs text-gray-400">--</span>
                }
              </td>

              <!-- Labels -->
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  @for (label of task.labels.slice(0, 2); track label.id) {
                    <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white"
                          [style.background-color]="label.color">
                      {{ label.name }}
                    </span>
                  }
                  @if (task.labels.length > 2) {
                    <span class="text-[10px] text-gray-400">+{{ task.labels.length - 2 }}</span>
                  }
                </div>
              </td>
            </tr>
          }

          @if (sortedTasks().length === 0) {
            <tr>
              <td colspan="7" class="px-4 py-12 text-center text-gray-400">
                No tasks found.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class TableViewComponent {
  projectId = input.required<string>();
  columns = input<ProjectColumn[]>([]);
  tasks = input<TaskCard[]>([]);
  taskClicked = output<TaskCard>();

  sortField = signal<SortField | null>(null);
  sortDirection = signal<SortDirection>('asc');

  private columnMap = computed(() => {
    const map = new Map<string, ProjectColumn>();
    for (const col of this.columns()) {
      map.set(col.id, col);
    }
    return map;
  });

  sortedTasks = computed(() => {
    const tasks = [...this.tasks()];
    const field = this.sortField();
    const dir = this.sortDirection();

    if (!field) return tasks;

    tasks.sort((a, b) => {
      let cmp = 0;
      switch (field) {
        case 'display_id':
          cmp = (a.display_id || '').localeCompare(b.display_id || '');
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'status':
          cmp = this.getColumnName(a.column_id).localeCompare(this.getColumnName(b.column_id));
          break;
        case 'priority':
          cmp = (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
          break;
        case 'due_date': {
          const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          cmp = da - db;
          break;
        }
      }
      return dir === 'asc' ? cmp : -cmp;
    });

    return tasks;
  });

  toggleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  getColumnName(columnId: string): string {
    return this.columnMap().get(columnId)?.name || 'Unknown';
  }

  getColumnColor(columnId: string): string {
    return this.columnMap().get(columnId)?.color || '#6366f1';
  }

  priorityClass(priority: string): string {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  }

  isOverdue(dueDateStr: string): boolean {
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }

  formatDate(dueDateStr: string): string {
    const date = new Date(dueDateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}
