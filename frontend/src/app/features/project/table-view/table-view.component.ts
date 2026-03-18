import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { UnifiedTaskCardComponent } from '../../../shared/components/task-card/task-card.component';
import { TaskListItem } from '../../../core/services/task.service';
import {
  getPriorityLabel,
  getPriorityColorHex,
  getDueDateColor,
  isOverdue,
  isToday,
} from '../../../shared/utils/task-colors';

interface ColumnInput {
  id: string;
  name: string;
  color: string;
  allowed_transitions?: string[] | null;
}

@Component({
  selector: 'app-table-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    InputTextModule,
    Select,
    DatePicker,
    EmptyStateComponent,
    UnifiedTaskCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Desktop: dense spreadsheet table -->
    @if (!isMobile()) {
      <div class="mx-2 my-2 overflow-x-auto">
        <p-table
          [value]="tasks()"
          [scrollable]="true"
          scrollHeight="calc(100vh - 200px)"
          [virtualScroll]="true"
          [virtualScrollItemSize]="36"
          dataKey="id"
          [rowHover]="true"
          styleClass="p-datatable-sm p-datatable-gridlines"
        >
          <ng-template #header>
            <tr>
              <th style="width: 70px; min-width: 70px">#</th>
              <th style="min-width: 280px">Title</th>
              <th style="width: 110px; min-width: 110px">Priority</th>
              <th style="width: 140px; min-width: 140px">Status</th>
              <th style="width: 100px; min-width: 100px">Assignee</th>
              <th style="width: 130px; min-width: 130px">Due Date</th>
              <th style="width: 60px; min-width: 60px">Sub</th>
            </tr>
          </ng-template>
          <ng-template #body let-task>
            <tr class="dense-row">
              <td class="text-xs" style="color: var(--muted-foreground)">
                {{ task.task_number || '--' }}
              </td>
              <td (click)="$event.stopPropagation()">
                @if (editingTitleId() === task.id) {
                  <input
                    pInputText
                    type="text"
                    class="w-full text-sm dense-input"
                    [ngModel]="editingTitleValue()"
                    (ngModelChange)="editingTitleValue.set($event)"
                    (blur)="saveTitleEdit(task)"
                    (keydown.enter)="saveTitleEdit(task)"
                    (keydown.escape)="cancelTitleEdit()"
                    (keydown.tab)="saveTitleEdit(task)"
                  />
                } @else {
                  <a
                    class="text-sm font-medium truncate block cursor-pointer hover:underline"
                    style="color: var(--foreground)"
                    (click)="taskClicked.emit(task.id)"
                    (dblclick)="startTitleEdit(task)"
                  >
                    {{ task.title }}
                  </a>
                }
              </td>
              <td (click)="$event.stopPropagation()">
                @if (editingPriorityId() === task.id) {
                  <p-select
                    [options]="priorityOptions"
                    [ngModel]="task.priority"
                    (ngModelChange)="onPrioritySelect(task.id, $event)"
                    optionLabel="label"
                    optionValue="value"
                    [appendTo]="'body'"
                    [autoDisplayFirst]="false"
                    styleClass="w-full text-xs"
                    (onHide)="editingPriorityId.set(null)"
                  />
                } @else {
                  <button
                    class="w-full h-7 rounded text-xs font-medium text-white border-none cursor-pointer transition-opacity hover:opacity-85"
                    [style.background-color]="getPriorityBg(task.priority)"
                    (click)="editingPriorityId.set(task.id)"
                  >
                    {{ getPriorityText(task.priority) }}
                  </button>
                }
              </td>
              <td (click)="$event.stopPropagation()">
                @if (editingStatusId() === task.id) {
                  <p-select
                    [options]="getStatusOptions(task)"
                    [ngModel]="task.status_id"
                    (ngModelChange)="onStatusSelect(task.id, $event)"
                    optionLabel="name"
                    optionValue="id"
                    [appendTo]="'body'"
                    [autoDisplayFirst]="false"
                    styleClass="w-full text-xs"
                    (onHide)="editingStatusId.set(null)"
                  />
                } @else {
                  <button
                    class="w-full h-7 rounded text-xs font-medium border-none cursor-pointer transition-opacity hover:opacity-85"
                    [style.background]="task.status_color || 'var(--secondary)'"
                    [style.color]="task.status_color ? '#fff' : 'var(--secondary-foreground)'"
                    (click)="editingStatusId.set(task.id)"
                  >
                    {{ task.status_name || task.column_name || '--' }}
                  </button>
                }
              </td>
              <td>
                <span class="text-xs truncate block" style="color: var(--muted-foreground)">
                  {{ task.assignee_name || '--' }}
                </span>
              </td>
              <td (click)="$event.stopPropagation()">
                @if (editingDueDateId() === task.id) {
                  <p-datepicker
                    [ngModel]="task.due_date ? parseDate(task.due_date) : null"
                    (ngModelChange)="onDueDateSelect(task.id, $event)"
                    [showIcon]="true"
                    [appendTo]="'body'"
                    dateFormat="M dd"
                    [showButtonBar]="true"
                    (onClose)="editingDueDateId.set(null)"
                    styleClass="w-full text-xs"
                  />
                } @else {
                  <button
                    class="cursor-pointer border-none bg-transparent text-left w-full"
                    (click)="editingDueDateId.set(task.id)"
                  >
                    @if (task.due_date) {
                      <span [class]="'text-xs ' + getDueDateClass(task.due_date)">
                        {{ formatDueDate(task.due_date) }}
                      </span>
                    } @else {
                      <span class="text-xs" style="color: var(--muted-foreground)">--</span>
                    }
                  </button>
                }
              </td>
              <td>
                <span class="text-xs" style="color: var(--muted-foreground)">
                  {{ task.child_count || '' }}
                </span>
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="7">
                <app-empty-state
                  variant="column-filtered"
                  title="No tasks yet"
                  description="Create your first task to get started."
                  size="compact"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    } @else {
      <!-- Mobile: card layout -->
      <div class="px-3 py-2 space-y-2">
        @for (task of tasks(); track task.id) {
          <app-unified-task-card
            [task]="toCardData(task)"
            variant="compact"
            (clicked)="taskClicked.emit($event)"
          />
        } @empty {
          <app-empty-state
            variant="column-filtered"
            title="No tasks yet"
            description="Create your first task to get started."
          />
        }
      </div>
    }
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
      padding: 0.4rem 0.5rem;
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      padding: 0.25rem 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr:hover {
      background: color-mix(in srgb, var(--background) 92%, var(--primary)) !important;
    }

    .dense-input {
      padding: 0.2rem 0.4rem;
      font-size: 0.875rem;
    }
  `],
})
export class TableViewComponent {
  readonly tasks = input<TaskListItem[]>([]);
  readonly columns = input<ColumnInput[]>([]);
  readonly projectId = input<string>('');

  readonly taskClicked = output<string>();
  readonly titleChanged = output<{ taskId: string; title: string }>();
  readonly priorityChanged = output<{ taskId: string; priority: string }>();
  readonly statusChanged = output<{ taskId: string; statusId: string }>();
  readonly dueDateChanged = output<{ taskId: string; dueDate: string | null }>();

  readonly isMobile = signal(typeof window !== 'undefined' && window.innerWidth < 768);

  readonly editingTitleId = signal<string | null>(null);
  readonly editingTitleValue = signal('');
  readonly editingPriorityId = signal<string | null>(null);
  readonly editingStatusId = signal<string | null>(null);
  readonly editingDueDateId = signal<string | null>(null);

  readonly priorityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' },
  ];

  startTitleEdit(task: TaskListItem): void {
    this.editingTitleId.set(task.id);
    this.editingTitleValue.set(task.title);
  }

  saveTitleEdit(task: TaskListItem): void {
    const newTitle = this.editingTitleValue().trim();
    if (!newTitle) {
      this.cancelTitleEdit();
      return;
    }
    if (newTitle !== task.title) {
      this.titleChanged.emit({ taskId: task.id, title: newTitle });
    }
    this.editingTitleId.set(null);
  }

  cancelTitleEdit(): void {
    this.editingTitleId.set(null);
    this.editingTitleValue.set('');
  }

  onPrioritySelect(taskId: string, priority: string): void {
    this.priorityChanged.emit({ taskId, priority });
    this.editingPriorityId.set(null);
  }

  getStatusOptions(task: TaskListItem): { id: string; name: string; color: string }[] {
    const allCols = this.columns();
    if (allCols.length === 0) return [];
    const current = allCols.find((c) => c.id === task.status_id);
    if (current?.allowed_transitions?.length) {
      return allCols.filter(
        (c) => c.id === task.status_id || current.allowed_transitions!.includes(c.id),
      );
    }
    return allCols.map((c) => ({ id: c.id, name: c.name, color: c.color }));
  }

  onStatusSelect(taskId: string, statusId: string): void {
    this.statusChanged.emit({ taskId, statusId });
    this.editingStatusId.set(null);
  }

  parseDate(dateStr: string): Date {
    return new Date(dateStr);
  }

  onDueDateSelect(taskId: string, date: Date | null): void {
    const dueDate = date ? date.toISOString() : null;
    this.dueDateChanged.emit({ taskId, dueDate });
    this.editingDueDateId.set(null);
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
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
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
    return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  toCardData(task: TaskListItem): {
    id: string;
    title: string;
    priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
    status?: string | null;
    status_color?: string | null;
    due_date?: string | null;
  } {
    return {
      id: task.id,
      title: task.title,
      priority: task.priority as 'urgent' | 'high' | 'medium' | 'low' | 'none',
      status: task.status_name ?? task.column_name ?? null,
      status_color: task.status_color,
      due_date: task.due_date,
    };
  }
}
