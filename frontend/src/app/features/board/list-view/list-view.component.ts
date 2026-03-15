import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TaskListItem } from '../../../core/services/task.service';
import {
  getPriorityLabel,
  getPriorityColorHex,
  getDueDateColor,
  isOverdue,
  isToday,
} from '../../../shared/utils/task-colors';

interface StatusOption {
  id: string;
  name: string;
  color: string;
}

interface ColumnInput {
  id: string;
  name: string;
  color: string;
  allowed_transitions?: string[] | null;
}

@Component({
  selector: 'app-list-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    InputTextModule,
    Select,
    DatePicker,
    EmptyStateComponent,
  ],
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
            <th pSortableColumn="status_name" style="width: 160px">
              Status <p-sortIcon field="status_name" />
            </th>
            <th pSortableColumn="due_date" style="width: 160px">
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

            <!-- Title (inline editable) -->
            <td (click)="$event.stopPropagation()">
              @if (editingTitleTaskId() === task.id) {
                <input
                  pInputText
                  type="text"
                  class="w-full text-sm"
                  [ngModel]="editingTitleValue()"
                  (ngModelChange)="editingTitleValue.set($event)"
                  (blur)="saveTitleEdit(task)"
                  (keydown.enter)="saveTitleEdit(task)"
                  (keydown.escape)="cancelTitleEdit()"
                  #titleInput
                />
              } @else {
                <div
                  class="text-sm font-medium text-[var(--foreground)] cursor-text hover:bg-[var(--muted)] rounded px-1 py-0.5 -mx-1"
                  (click)="startTitleEdit(task)"
                >
                  {{ task.title }}
                </div>
                @if (task.description) {
                  <div
                    class="text-xs text-[var(--muted-foreground)] line-clamp-1 mt-0.5 cursor-pointer"
                    (click)="onRowClick(task)"
                  >
                    {{ task.description }}
                  </div>
                }
              }
            </td>

            <!-- Priority (inline editable) -->
            <td (click)="$event.stopPropagation()">
              @if (editingPriorityTaskId() === task.id) {
                <p-select
                  [options]="priorityOptions"
                  [ngModel]="task.priority"
                  (ngModelChange)="onPrioritySelect(task.id, $event)"
                  optionLabel="label"
                  optionValue="value"
                  [appendTo]="'body'"
                  [autoDisplayFirst]="false"
                  styleClass="w-full text-xs"
                  (onHide)="editingPriorityTaskId.set(null)"
                />
              } @else {
                <div
                  class="flex items-center justify-center h-8 rounded text-xs font-medium text-white cursor-pointer transition-opacity hover:opacity-85"
                  [style.background-color]="getPriorityHexColor(task.priority)"
                  (click)="editingPriorityTaskId.set(task.id)"
                >
                  {{ getPriorityLabelText(task.priority) }}
                </div>
              }
            </td>

            <!-- Status (inline editable) -->
            <td (click)="$event.stopPropagation()">
              @if (editingStatusTaskId() === task.id) {
                <p-select
                  [options]="getStatusOptionsForTask(task)"
                  [ngModel]="task.status_id"
                  (ngModelChange)="onStatusSelect(task.id, $event)"
                  optionLabel="name"
                  optionValue="id"
                  [appendTo]="'body'"
                  [autoDisplayFirst]="false"
                  styleClass="w-full text-xs"
                  (onHide)="editingStatusTaskId.set(null)"
                />
              } @else {
                <div
                  class="flex items-center justify-center h-8 rounded text-xs font-medium cursor-pointer transition-opacity hover:opacity-85"
                  [style.background]="
                    task.status_color || 'var(--secondary)'
                  "
                  [style.color]="
                    task.status_color
                      ? '#fff'
                      : 'var(--secondary-foreground)'
                  "
                  (click)="editingStatusTaskId.set(task.id)"
                >
                  {{ task.status_name || task.column_name }}
                </div>
              }
            </td>

            <!-- Due Date (inline editable) -->
            <td (click)="$event.stopPropagation()">
              @if (editingDueDateTaskId() === task.id) {
                <p-datepicker
                  [ngModel]="task.due_date ? parseDate(task.due_date) : null"
                  (ngModelChange)="onDueDateSelect(task.id, $event)"
                  [showIcon]="true"
                  [appendTo]="'body'"
                  dateFormat="M dd"
                  [showButtonBar]="true"
                  (onClose)="editingDueDateTaskId.set(null)"
                  [inline]="false"
                  styleClass="w-full text-sm"
                />
              } @else {
                <div
                  class="cursor-pointer hover:bg-[var(--muted)] rounded px-1 py-0.5 -mx-1"
                  (click)="editingDueDateTaskId.set(task.id)"
                >
                  @if (task.due_date) {
                    <span
                      [class]="
                        'text-sm ' + getDueDateColorClass(task.due_date)
                      "
                    >
                      {{ formatDueDate(task.due_date) }}
                    </span>
                  } @else {
                    <span class="text-sm text-[var(--muted-foreground)]"
                      >--</span
                    >
                  }
                </div>
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

      :host ::ng-deep .p-select {
        min-width: 100%;
      }

      :host ::ng-deep .p-datepicker {
        min-width: 100%;
      }
    `,
  ],
})
export class ListViewComponent {
  tasks = input<TaskListItem[]>([]);
  loading = input<boolean>(false);
  columns = input<ColumnInput[]>([]);

  taskClicked = output<string>();
  titleChanged = output<{ taskId: string; title: string }>();
  priorityChanged = output<{ taskId: string; priority: string }>();
  statusChanged = output<{ taskId: string; statusId: string }>();
  dueDateChanged = output<{ taskId: string; dueDate: string | null }>();

  selectedTasks: TaskListItem[] = [];

  // Editing state
  editingTitleTaskId = signal<string | null>(null);
  editingTitleValue = signal('');
  editingPriorityTaskId = signal<string | null>(null);
  editingStatusTaskId = signal<string | null>(null);
  editingDueDateTaskId = signal<string | null>(null);

  readonly priorityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' },
  ];

  // === Title editing ===

  startTitleEdit(task: TaskListItem): void {
    this.editingTitleTaskId.set(task.id);
    this.editingTitleValue.set(task.title);
    // Focus input after render
    setTimeout(() => {
      const input = document.querySelector(
        'input[pInputText]',
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  saveTitleEdit(task: TaskListItem): void {
    const newTitle = this.editingTitleValue().trim();
    if (!newTitle) {
      // Empty title blocked - revert
      this.cancelTitleEdit();
      return;
    }
    if (newTitle !== task.title) {
      this.titleChanged.emit({ taskId: task.id, title: newTitle });
    }
    this.editingTitleTaskId.set(null);
  }

  cancelTitleEdit(): void {
    this.editingTitleTaskId.set(null);
    this.editingTitleValue.set('');
  }

  // === Priority editing ===

  onPrioritySelect(taskId: string, priority: string): void {
    this.priorityChanged.emit({ taskId, priority });
    this.editingPriorityTaskId.set(null);
  }

  // === Status editing ===

  getStatusOptionsForTask(task: TaskListItem): StatusOption[] {
    const allCols = this.columns();
    if (allCols.length === 0) {
      return [];
    }

    const currentStatus = allCols.find((c) => c.id === task.status_id);
    if (
      currentStatus?.allowed_transitions &&
      currentStatus.allowed_transitions.length > 0
    ) {
      // Filter to only allowed transitions + current status
      return allCols.filter(
        (c) =>
          c.id === task.status_id ||
          currentStatus.allowed_transitions!.includes(c.id),
      );
    }

    // No restrictions - show all statuses
    return allCols.map((c) => ({ id: c.id, name: c.name, color: c.color }));
  }

  onStatusSelect(taskId: string, statusId: string): void {
    this.statusChanged.emit({ taskId, statusId });
    this.editingStatusTaskId.set(null);
  }

  // === Due date editing ===

  parseDate(dateStr: string): Date {
    return new Date(dateStr);
  }

  onDueDateSelect(taskId: string, date: Date | null): void {
    const dueDate = date ? date.toISOString() : null;
    this.dueDateChanged.emit({ taskId, dueDate });
    this.editingDueDateTaskId.set(null);
  }

  // === Existing helpers ===

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
