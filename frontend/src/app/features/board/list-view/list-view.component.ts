import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskListItem } from '../../../core/services/task.service';
import {
  getPriorityColor,
  getPriorityLabel,
  getDueDateColor,
  isOverdue,
  isToday,
} from '../../../shared/utils/task-colors';

type SortField = 'title' | 'priority' | 'column_name' | 'due_date' | 'created_at';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

@Component({
  selector: 'app-list-view',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden mx-4 my-4">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  [checked]="allSelected()"
                  (change)="toggleSelectAll()"
                />
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                (click)="toggleSort('title')"
              >
                <div class="flex items-center gap-1">
                  Title
                  @if (sortField() === 'title') {
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      @if (sortDir() === 'asc') {
                        <path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                      } @else {
                        <path fill-rule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      }
                    </svg>
                  }
                </div>
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                (click)="toggleSort('priority')"
              >
                <div class="flex items-center gap-1">
                  Priority
                  @if (sortField() === 'priority') {
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      @if (sortDir() === 'asc') {
                        <path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                      } @else {
                        <path fill-rule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      }
                    </svg>
                  }
                </div>
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                (click)="toggleSort('column_name')"
              >
                <div class="flex items-center gap-1">
                  Status
                  @if (sortField() === 'column_name') {
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      @if (sortDir() === 'asc') {
                        <path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                      } @else {
                        <path fill-rule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      }
                    </svg>
                  }
                </div>
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                (click)="toggleSort('due_date')"
              >
                <div class="flex items-center gap-1">
                  Due Date
                  @if (sortField() === 'due_date') {
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      @if (sortDir() === 'asc') {
                        <path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                      } @else {
                        <path fill-rule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      }
                    </svg>
                  }
                </div>
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                (click)="toggleSort('created_at')"
              >
                <div class="flex items-center gap-1">
                  Created
                  @if (sortField() === 'created_at') {
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      @if (sortDir() === 'asc') {
                        <path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                      } @else {
                        <path fill-rule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      }
                    </svg>
                  }
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            @if (loading()) {
              <tr>
                <td colspan="6" class="px-4 py-12 text-center">
                  <svg class="animate-spin h-6 w-6 text-indigo-600 mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p class="mt-2 text-sm text-gray-500">Loading tasks...</p>
                </td>
              </tr>
            } @else if (sortedTasks().length === 0) {
              <tr>
                <td colspan="6" class="px-4 py-12 text-center">
                  <p class="text-sm text-gray-500">No tasks found</p>
                </td>
              </tr>
            } @else {
              @for (task of sortedTasks(); track task.id; let odd = $odd) {
                <tr
                  class="cursor-pointer transition-colors"
                  [class.bg-gray-50]="odd"
                  [class.hover:bg-indigo-50]="true"
                  [class.bg-indigo-100]="selectedIds().has(task.id)"
                  (click)="onRowClick(task)"
                >
                  <td class="px-4 py-3">
                    <input
                      type="checkbox"
                      class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      [checked]="selectedIds().has(task.id)"
                      (click)="$event.stopPropagation()"
                      (change)="toggleSelect(task.id)"
                    />
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-sm font-medium text-gray-900">{{ task.title }}</div>
                    @if (task.description) {
                      <div class="text-xs text-gray-500 line-clamp-1 mt-0.5">{{ task.description }}</div>
                    }
                  </td>
                  <td class="px-4 py-3">
                    <span
                      [class]="'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ' + getPriorityBgClass(task.priority) + ' ' + getPriorityTextClass(task.priority)"
                    >
                      {{ getPriorityLabelText(task.priority) }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {{ task.column_name }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    @if (task.due_date) {
                      <span [class]="'text-sm ' + getDueDateColorClass(task.due_date)">
                        {{ formatDueDate(task.due_date) }}
                      </span>
                    } @else {
                      <span class="text-sm text-gray-400">--</span>
                    }
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-sm text-gray-500">
                      {{ formatDate(task.created_at) }}
                    </span>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <!-- Footer with count -->
      @if (!loading() && sortedTasks().length > 0) {
        <div class="bg-gray-50 border-t border-gray-200 px-4 py-2">
          <p class="text-xs text-gray-500">
            {{ sortedTasks().length }} task{{ sortedTasks().length === 1 ? '' : 's' }}
            @if (selectedIds().size > 0) {
              <span class="ml-2 text-indigo-600 font-medium">
                ({{ selectedIds().size }} selected)
              </span>
            }
          </p>
        </div>
      }
    </div>
  `,
  styles: [`
    .line-clamp-1 {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
})
export class ListViewComponent {
  tasks = input<TaskListItem[]>([]);
  loading = input<boolean>(false);

  taskClicked = output<string>();

  sortField = signal<SortField>('created_at');
  sortDir = signal<SortDir>('desc');
  selectedIds = signal<Set<string>>(new Set());

  sortedTasks = computed(() => {
    const items = [...this.tasks()];
    const field = this.sortField();
    const dir = this.sortDir();

    items.sort((a, b) => {
      let cmp = 0;

      switch (field) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'priority':
          cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          break;
        case 'column_name':
          cmp = a.column_name.localeCompare(b.column_name);
          break;
        case 'due_date': {
          const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          cmp = aDate - bDate;
          break;
        }
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }

      return dir === 'asc' ? cmp : -cmp;
    });

    return items;
  });

  allSelected = computed(() => {
    const tasks = this.tasks();
    const selected = this.selectedIds();
    return tasks.length > 0 && tasks.every((t) => selected.has(t.id));
  });

  toggleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
  }

  toggleSelect(taskId: string): void {
    this.selectedIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.tasks().map((t) => t.id)));
    }
  }

  onRowClick(task: TaskListItem): void {
    this.taskClicked.emit(task.id);
  }

  getPriorityBgClass(priority: string): string {
    return getPriorityColor(priority).bg;
  }

  getPriorityTextClass(priority: string): string {
    return getPriorityColor(priority).text;
  }

  getPriorityLabelText(priority: string): string {
    return getPriorityLabel(priority);
  }

  getDueDateColorClass(dueDate: string | null): string {
    return getDueDateColor(dueDate);
  }

  formatDueDate(date: string): string {
    const dueDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (isToday(date)) {
      return 'Today';
    }

    if (
      dueDate.getDate() === tomorrow.getDate() &&
      dueDate.getMonth() === tomorrow.getMonth() &&
      dueDate.getFullYear() === tomorrow.getFullYear()
    ) {
      return 'Tomorrow';
    }

    if (isOverdue(date)) {
      const diffDays = Math.ceil(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return `Overdue (${diffDays}d)`;
    }

    return dueDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
