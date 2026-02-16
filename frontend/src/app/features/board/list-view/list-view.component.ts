import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { TaskListItem } from '../../../core/services/task.service';
import {
  getPriorityLabel,
  getDueDateColor,
  isOverdue,
  isToday,
} from '../../../shared/utils/task-colors';

@Component({
  selector: 'app-list-view',
  standalone: true,
  imports: [CommonModule, TableModule, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-4 my-4">
      <p-table
        [value]="tasks()"
        [loading]="loading()"
        sortMode="single"
        [sortField]="'created_at'"
        [sortOrder]="-1"
        [(selection)]="selectedTasks"
        [paginator]="tasks().length > 25"
        [rows]="25"
        [rowsPerPageOptions]="[10, 25, 50, 100]"
        [showCurrentPageReport]="true"
        currentPageReportTemplate="Showing {first} to {last} of {totalRecords} tasks"
        selectionMode="multiple"
        dataKey="id"
        [rowHover]="true"
        styleClass="p-datatable-sm"
      >
        <ng-template #header>
          <tr>
            <th style="width: 3rem">
              <p-tableHeaderCheckbox />
            </th>
            <th pSortableColumn="title">
              Title <p-sortIcon field="title" />
            </th>
            <th pSortableColumn="priority" style="width: 120px">
              Priority <p-sortIcon field="priority" />
            </th>
            <th pSortableColumn="column_name" style="width: 140px">
              Status <p-sortIcon field="column_name" />
            </th>
            <th pSortableColumn="due_date" style="width: 140px">
              Due Date <p-sortIcon field="due_date" />
            </th>
            <th pSortableColumn="created_at" style="width: 140px">
              Created <p-sortIcon field="created_at" />
            </th>
          </tr>
        </ng-template>
        <ng-template #body let-task>
          <tr [pSelectableRow]="task" class="cursor-pointer" (click)="onRowClick(task)">
            <td (click)="$event.stopPropagation()">
              <p-tableCheckbox [value]="task" />
            </td>
            <td>
              <div class="text-sm font-medium text-gray-900">{{ task.title }}</div>
              @if (task.description) {
                <div class="text-xs text-gray-500 line-clamp-1 mt-0.5">{{ task.description }}</div>
              }
            </td>
            <td>
              <p-tag
                [value]="getPriorityLabelText(task.priority)"
                [severity]="getPrioritySeverity(task.priority)"
                [rounded]="true"
              />
            </td>
            <td>
              <p-tag
                [value]="task.column_name"
                severity="secondary"
                [rounded]="true"
              />
            </td>
            <td>
              @if (task.due_date) {
                <span [class]="'text-sm ' + getDueDateColorClass(task.due_date)">
                  {{ formatDueDate(task.due_date) }}
                </span>
              } @else {
                <span class="text-sm text-gray-400">--</span>
              }
            </td>
            <td>
              <span class="text-sm text-gray-500">
                {{ formatDate(task.created_at) }}
              </span>
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="6" class="text-center py-12">
              <p class="text-sm text-gray-500">No tasks match your filters</p>
            </td>
          </tr>
        </ng-template>
      </p-table>
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

  selectedTasks: TaskListItem[] = [];

  getPrioritySeverity(priority: string): 'danger' | 'warn' | 'info' | 'secondary' | 'success' | 'contrast' | undefined {
    const map: Record<string, 'danger' | 'warn' | 'info' | 'secondary'> = {
      urgent: 'danger',
      high: 'warn',
      medium: 'info',
      low: 'secondary',
    };
    return map[priority] || 'secondary';
  }

  getPriorityLabelText(priority: string): string {
    return getPriorityLabel(priority);
  }

  getDueDateColorClass(dueDate: string | null): string {
    return getDueDateColor(dueDate);
  }

  onRowClick(task: TaskListItem): void {
    this.taskClicked.emit(task.id);
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
