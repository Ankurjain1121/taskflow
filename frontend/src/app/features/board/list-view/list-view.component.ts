import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TaskListItem } from '../../../core/services/task.service';
import {
  getPriorityLabel,
  getPriorityColorHex,
  getDueDateColor,
  isOverdue,
  isToday,
} from '../../../shared/utils/task-colors';

@Component({
  selector: 'app-list-view',
  standalone: true,
  imports: [CommonModule, TableModule, EmptyStateComponent],
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
            <th pSortableColumn="title">Title <p-sortIcon field="title" /></th>
            <th pSortableColumn="priority" style="width: 120px">
              Priority <p-sortIcon field="priority" />
            </th>
            <th pSortableColumn="status_name" style="width: 140px">
              Status <p-sortIcon field="status_name" />
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
          <tr
            [pSelectableRow]="task"
            class="cursor-pointer"
            (click)="onRowClick(task)"
          >
            <td (click)="$event.stopPropagation()">
              <p-tableCheckbox [value]="task" />
            </td>
            <td>
              <div class="text-sm font-medium text-[var(--foreground)]">
                {{ task.title }}
              </div>
              @if (task.description) {
                <div
                  class="text-xs text-[var(--muted-foreground)] line-clamp-1 mt-0.5"
                >
                  {{ task.description }}
                </div>
              }
            </td>
            <td>
              <div
                class="flex items-center justify-center h-8 rounded text-xs font-medium text-white cursor-pointer transition-opacity hover:opacity-85"
                [style.background-color]="getPriorityHexColor(task.priority)"
              >
                {{ getPriorityLabelText(task.priority) }}
              </div>
            </td>
            <td>
              <div
                class="flex items-center justify-center h-8 rounded text-xs font-medium cursor-pointer transition-opacity hover:opacity-85"
                [style.background]="task.status_color || 'var(--secondary)'"
                [style.color]="task.status_color ? '#fff' : 'var(--secondary-foreground)'"
              >
                {{ task.status_name || task.column_name }}
              </div>
            </td>
            <td>
              @if (task.due_date) {
                <span
                  [class]="'text-sm ' + getDueDateColorClass(task.due_date)"
                >
                  {{ formatDueDate(task.due_date) }}
                </span>
              } @else {
                <span class="text-sm text-[var(--muted-foreground)]">--</span>
              }
            </td>
            <td>
              <span class="text-sm text-[var(--muted-foreground)]">
                {{ formatDate(task.created_at) }}
              </span>
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="6">
              <app-empty-state
                variant="column-filtered"
                title="No tasks match your filters"
                description="Try adjusting your filters or clear them to see all tasks."
              />
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styles: [
    `
      .line-clamp-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
        background: var(--background);
        color: var(--muted-foreground);
        font-weight: 600;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 2px solid var(--border);
      }

      :host ::ng-deep .p-datatable .p-datatable-tbody > tr {
        transition: background-color 150ms ease;
      }

      :host ::ng-deep .p-datatable .p-datatable-tbody > tr:nth-child(even) {
        background: color-mix(in srgb, var(--background) 95%, var(--primary));
      }

      :host ::ng-deep .p-datatable .p-datatable-tbody > tr:hover {
        background: color-mix(
          in srgb,
          var(--background) 90%,
          var(--primary)
        ) !important;
      }
    `,
  ],
})
export class ListViewComponent {
  tasks = input<TaskListItem[]>([]);
  loading = input<boolean>(false);

  taskClicked = output<string>();

  selectedTasks: TaskListItem[] = [];

  getPriorityHexColor(priority: string): string {
    return getPriorityColorHex(priority).bg;
  }

  getPriorityLabelText(priority: string): string {
    return getPriorityLabel(priority);
  }

  getDueDateColorClass(dueDate: string | null): string {
    const result = getDueDateColor(dueDate);
    return [result.class, result.chipClass].filter(Boolean).join(' ');
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
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
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
