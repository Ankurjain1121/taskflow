import {
  Component,
  input,
  output,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { MultiSelect } from 'primeng/multiselect';
import { Tooltip } from 'primeng/tooltip';
import { Popover } from 'primeng/popover';
import { Checkbox } from 'primeng/checkbox';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import {
  TaskService,
  TaskListParams,
  TaskListResponse,
  TaskListResponseItem,
  UpdateTaskRequest,
} from '../../../core/services/task.service';
import { Column, ProjectMember } from '../../../core/services/project.service';
import {
  getPriorityLabel,
  getPriorityColorHex,
  getDueDateColor,
  isOverdue,
  isToday,
} from '../../../shared/utils/task-colors';
import { WebSocketService } from '../../../core/services/websocket.service';

interface ColumnConfig {
  field: string;
  header: string;
  visible: boolean;
  sortable: boolean;
  width: string;
}

const STORAGE_KEY = 'taskflow_list_columns';

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { field: 'task_number', header: 'Task #', visible: true, sortable: true, width: '80px' },
  { field: 'title', header: 'Title', visible: true, sortable: true, width: '' },
  { field: 'priority', header: 'Priority', visible: true, sortable: true, width: '120px' },
  { field: 'column_name', header: 'Status', visible: true, sortable: true, width: '140px' },
  { field: 'assignees', header: 'Assignees', visible: true, sortable: false, width: '180px' },
  { field: 'due_date', header: 'Due Date', visible: true, sortable: true, width: '140px' },
  { field: 'labels', header: 'Labels', visible: true, sortable: false, width: '160px' },
  { field: 'subtasks', header: 'Subtasks', visible: true, sortable: false, width: '120px' },
  { field: 'comment_count', header: 'Comments', visible: false, sortable: true, width: '100px' },
  { field: 'milestone_name', header: 'Milestone', visible: false, sortable: true, width: '140px' },
  { field: 'created_at', header: 'Created', visible: false, sortable: true, width: '140px' },
  { field: 'updated_at', header: 'Updated', visible: false, sortable: true, width: '140px' },
];

const PRIORITY_OPTIONS = [
  { label: 'Urgent', value: 'urgent' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
  { label: 'None', value: 'none' },
];

@Component({
  selector: 'app-list-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    Select,
    DatePicker,
    InputTextModule,
    ButtonModule,
    ProgressBar,
    MultiSelect,
    Tooltip,
    Popover,
    Checkbox,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-view-container px-4 py-3">
      <!-- Toolbar: Search + Column Config -->
      <div class="flex items-center gap-3 mb-3">
        <div class="flex-1 max-w-md relative">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] text-sm"></i>
          <input
            pInputText
            type="text"
            [ngModel]="searchTerm()"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Search tasks..."
            class="w-full pl-9"
          />
        </div>
        <div class="ml-auto flex items-center gap-2">
          <span class="text-xs text-[var(--muted-foreground)]">
            {{ totalRecords() }} task{{ totalRecords() !== 1 ? 's' : '' }}
          </span>
          <button
            pButton
            icon="pi pi-cog"
            [outlined]="true"
            severity="secondary"
            size="small"
            pTooltip="Configure columns"
            tooltipPosition="bottom"
            (click)="columnConfigPanel.toggle($event)"
          ></button>
          <p-popover #columnConfigPanel>
            <div class="p-3 min-w-[200px]">
              <div class="text-sm font-semibold mb-2 text-[var(--foreground)]">Visible Columns</div>
              @for (col of columnConfigs(); track col.field) {
                <div class="flex items-center gap-2 py-1">
                  <p-checkbox
                    [binary]="true"
                    [ngModel]="col.visible"
                    (ngModelChange)="toggleColumnVisibility(col.field, $event)"
                    [inputId]="'col-' + col.field"
                  />
                  <label [for]="'col-' + col.field" class="text-sm cursor-pointer text-[var(--foreground)]">
                    {{ col.header }}
                  </label>
                </div>
              }
            </div>
          </p-popover>
        </div>
      </div>

      <!-- Table -->
      <p-table
        [value]="tasks()"
        [lazy]="true"
        (onLazyLoad)="onLazyLoad($event)"
        [loading]="loading()"
        [paginator]="true"
        [rows]="pageSize()"
        [totalRecords]="totalRecords()"
        [rowsPerPageOptions]="[25, 50, 100]"
        [showCurrentPageReport]="true"
        currentPageReportTemplate="Showing {first} to {last} of {totalRecords} tasks"
        [sortField]="sortField()"
        [sortOrder]="sortOrder()"
        dataKey="id"
        [rowHover]="true"
        [resizableColumns]="true"
        columnResizeMode="expand"
        styleClass="p-datatable-sm p-datatable-gridlines"
        [first]="first()"
      >
        <ng-template #header>
          <tr>
            @for (col of visibleColumns(); track col.field) {
              @if (col.sortable) {
                <th
                  [pSortableColumn]="col.field"
                  pResizableColumn
                  [style.width]="col.width"
                  [style.min-width]="col.width || '150px'"
                >
                  {{ col.header }}
                  <p-sortIcon [field]="col.field" />
                </th>
              } @else {
                <th
                  pResizableColumn
                  [style.width]="col.width"
                  [style.min-width]="col.width || '150px'"
                >
                  {{ col.header }}
                </th>
              }
            }
          </tr>
        </ng-template>

        <ng-template #body let-task>
          <tr class="cursor-pointer" (click)="onRowClick(task)">
            @for (col of visibleColumns(); track col.field) {
              <td (click)="onCellClick($event, task, col.field)">
                <!-- Task Number -->
                @if (col.field === 'task_number') {
                  <span class="text-xs text-[var(--muted-foreground)] font-mono">
                    @if (task.task_number) {
                      #{{ task.task_number }}
                    } @else {
                      --
                    }
                  </span>
                }

                <!-- Title -->
                @if (col.field === 'title') {
                  @if (editingCell()?.taskId === task.id && editingCell()?.field === 'title') {
                    <input
                      pInputText
                      class="w-full text-sm"
                      [ngModel]="editValue()"
                      (ngModelChange)="editValue.set($event)"
                      (blur)="saveEdit(task)"
                      (keydown.enter)="saveEdit(task)"
                      (keydown.escape)="cancelEdit()"
                      (click)="$event.stopPropagation()"
                      #editInput
                    />
                  } @else {
                    <div class="text-sm font-medium text-[var(--foreground)] truncate">
                      {{ task.title }}
                    </div>
                  }
                }

                <!-- Priority -->
                @if (col.field === 'priority') {
                  @if (editingCell()?.taskId === task.id && editingCell()?.field === 'priority') {
                    <p-select
                      [options]="priorityOptions"
                      [ngModel]="editValue()"
                      (ngModelChange)="onPriorityChange(task, $event)"
                      optionLabel="label"
                      optionValue="value"
                      [style]="{ width: '100%' }"
                      appendTo="body"
                      (click)="$event.stopPropagation()"
                      [autoDisplayFirst]="false"
                    />
                  } @else {
                    <div
                      class="flex items-center justify-center h-7 rounded text-xs font-medium text-white"
                      [style.background-color]="getPriorityHexColor(task.priority)"
                    >
                      {{ getPriorityLabelText(task.priority) }}
                    </div>
                  }
                }

                <!-- Status / Column -->
                @if (col.field === 'column_name') {
                  @if (editingCell()?.taskId === task.id && editingCell()?.field === 'column_name') {
                    <p-select
                      [options]="columnOptions()"
                      [ngModel]="editValue()"
                      (ngModelChange)="onStatusChange(task, $event)"
                      optionLabel="name"
                      optionValue="id"
                      [style]="{ width: '100%' }"
                      appendTo="body"
                      (click)="$event.stopPropagation()"
                      [autoDisplayFirst]="false"
                    />
                  } @else {
                    <div
                      class="flex items-center justify-center h-7 rounded text-xs font-medium"
                      style="background: var(--secondary); color: var(--secondary-foreground)"
                    >
                      {{ task.column_name }}
                    </div>
                  }
                }

                <!-- Assignees -->
                @if (col.field === 'assignees') {
                  <div class="flex items-center gap-1 flex-wrap">
                    @for (assignee of task.assignees; track assignee.user_id) {
                      <div
                        class="w-6 h-6 rounded-full bg-[var(--primary)] flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        [pTooltip]="assignee.display_name"
                        tooltipPosition="top"
                      >
                        {{ getInitials(assignee.display_name) }}
                      </div>
                    }
                    @if (task.assignees.length === 0) {
                      <span class="text-xs text-[var(--muted-foreground)]">--</span>
                    }
                  </div>
                }

                <!-- Due Date -->
                @if (col.field === 'due_date') {
                  @if (editingCell()?.taskId === task.id && editingCell()?.field === 'due_date') {
                    <p-datePicker
                      [ngModel]="editDateValue()"
                      (ngModelChange)="onDueDateChange(task, $event)"
                      dateFormat="yy-mm-dd"
                      [showIcon]="true"
                      [showClear]="true"
                      appendTo="body"
                      (click)="$event.stopPropagation()"
                      inputStyleClass="text-sm"
                    />
                  } @else {
                    @if (task.due_date) {
                      <span [class]="'text-sm ' + getDueDateColorClass(task.due_date)">
                        {{ formatDueDate(task.due_date) }}
                      </span>
                    } @else {
                      <span class="text-sm text-[var(--muted-foreground)]">--</span>
                    }
                  }
                }

                <!-- Labels -->
                @if (col.field === 'labels') {
                  <div class="flex items-center gap-1 flex-wrap">
                    @for (label of task.labels; track label) {
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--secondary)] text-[var(--secondary-foreground)]">
                        {{ label }}
                      </span>
                    }
                    @if (task.labels.length === 0) {
                      <span class="text-xs text-[var(--muted-foreground)]">--</span>
                    }
                  </div>
                }

                <!-- Subtasks -->
                @if (col.field === 'subtasks') {
                  @if (task.subtask_total > 0) {
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                        {{ task.subtask_completed }}/{{ task.subtask_total }}
                      </span>
                      <p-progressBar
                        [value]="getSubtaskPercent(task)"
                        [showValue]="false"
                        [style]="{ height: '6px', width: '60px' }"
                      />
                    </div>
                  } @else {
                    <span class="text-xs text-[var(--muted-foreground)]">--</span>
                  }
                }

                <!-- Comments -->
                @if (col.field === 'comment_count') {
                  @if (task.comment_count > 0) {
                    <div class="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                      <i class="pi pi-comment text-xs"></i>
                      {{ task.comment_count }}
                    </div>
                  } @else {
                    <span class="text-xs text-[var(--muted-foreground)]">--</span>
                  }
                }

                <!-- Milestone -->
                @if (col.field === 'milestone_name') {
                  @if (task.milestone_name) {
                    <span class="text-xs text-[var(--muted-foreground)]">
                      <i class="pi pi-flag text-xs mr-1"></i>{{ task.milestone_name }}
                    </span>
                  } @else {
                    <span class="text-xs text-[var(--muted-foreground)]">--</span>
                  }
                }

                <!-- Created / Updated -->
                @if (col.field === 'created_at' || col.field === 'updated_at') {
                  <span class="text-xs text-[var(--muted-foreground)]">
                    {{ formatDate(col.field === 'created_at' ? task.created_at : task.updated_at) }}
                  </span>
                }
              </td>
            }
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td [attr.colspan]="visibleColumns().length">
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
      :host {
        display: block;
      }

      :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
        background: var(--background);
        color: var(--muted-foreground);
        font-weight: 600;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 2px solid var(--border);
        padding: 0.75rem 0.5rem;
      }

      :host ::ng-deep .p-datatable .p-datatable-tbody > tr {
        transition: background-color 150ms ease;
      }

      :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
        padding: 0.5rem;
        border-bottom: 1px solid var(--border);
      }

      :host ::ng-deep .p-datatable .p-datatable-tbody > tr:hover {
        background: color-mix(
          in srgb,
          var(--background) 92%,
          var(--primary)
        ) !important;
      }

      :host ::ng-deep .p-datatable .p-paginator {
        border: none;
        padding: 0.75rem 0;
      }
    `,
  ],
})
export class ListViewComponent implements OnInit, OnDestroy {
  private taskService = inject(TaskService);
  private wsService = inject(WebSocketService);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private saveSubject = new Subject<{ taskId: string; updates: UpdateTaskRequest }>();

  projectId = input.required<string>();
  columns = input<Column[]>([]);
  members = input<ProjectMember[]>([]);

  taskClicked = output<string>();

  tasks = signal<TaskListResponseItem[]>([]);
  loading = signal(false);
  totalRecords = signal(0);
  pageSize = signal(25);
  first = signal(0);
  sortField = signal('created_at');
  sortOrder = signal<1 | -1>(-1);
  searchTerm = signal('');

  editingCell = signal<{ taskId: string; field: string } | null>(null);
  editValue = signal<string>('');
  editDateValue = signal<Date | null>(null);

  columnConfigs = signal<ColumnConfig[]>(this.loadColumnConfigs());

  visibleColumns = computed(() =>
    this.columnConfigs().filter((c) => c.visible),
  );

  columnOptions = computed(() =>
    this.columns().map((c) => ({ id: c.id, name: c.name })),
  );

  priorityOptions = PRIORITY_OPTIONS;

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(() => this.loadData());

    this.saveSubject
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(({ taskId, updates }) => {
        this.taskService
          .updateTask(taskId, updates)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => this.loadData(),
            error: () => {},
          });
      });

    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg: unknown) => {
        const message = msg as Record<string, unknown>;
        const type = message['type'] as string;
        if (
          type === 'TaskCreated' ||
          type === 'TaskUpdated' ||
          type === 'TaskDeleted'
        ) {
          this.loadData();
        }
      });

    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    const projectId = this.projectId();
    if (!projectId) return;

    this.loading.set(true);

    const page = Math.floor(this.first() / this.pageSize()) + 1;
    const params: TaskListParams = {
      sort_by: this.sortField(),
      sort_order: this.sortOrder() === 1 ? 'asc' : 'desc',
      page,
      page_size: this.pageSize(),
    };

    const search = this.searchTerm().trim();
    if (search) {
      params.search = search;
    }

    this.taskService
      .getTaskList(projectId, params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: TaskListResponse) => {
          this.tasks.set(response.tasks);
          this.totalRecords.set(response.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.first.set(event.first ?? 0);
    this.pageSize.set(event.rows ?? 25);

    if (event.sortField && typeof event.sortField === 'string') {
      this.sortField.set(event.sortField);
    }
    if (event.sortOrder) {
      this.sortOrder.set(event.sortOrder as 1 | -1);
    }

    this.loadData();
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.first.set(0);
    this.searchSubject.next(term);
  }

  onRowClick(task: TaskListResponseItem): void {
    if (this.editingCell()) return;
    this.taskClicked.emit(task.id);
  }

  onCellClick(event: Event, task: TaskListResponseItem, field: string): void {
    const editableFields = ['title', 'priority', 'column_name', 'due_date'];
    if (!editableFields.includes(field)) return;

    event.stopPropagation();

    if (field === 'due_date') {
      this.editDateValue.set(task.due_date ? new Date(task.due_date) : null);
    } else if (field === 'priority') {
      this.editValue.set(task.priority);
    } else if (field === 'column_name') {
      this.editValue.set(task.column_id);
    } else {
      this.editValue.set((task as unknown as Record<string, unknown>)[field] as string ?? '');
    }

    this.editingCell.set({ taskId: task.id, field });
  }

  saveEdit(task: TaskListResponseItem): void {
    const cell = this.editingCell();
    if (!cell) return;

    const value = this.editValue().trim();
    if (cell.field === 'title' && value && value !== task.title) {
      this.saveSubject.next({ taskId: task.id, updates: { title: value } });
    }
    this.editingCell.set(null);
  }

  cancelEdit(): void {
    this.editingCell.set(null);
  }

  onPriorityChange(task: TaskListResponseItem, value: string): void {
    this.editingCell.set(null);
    if (value !== task.priority) {
      this.saveSubject.next({
        taskId: task.id,
        updates: { priority: value as UpdateTaskRequest['priority'] },
      });
    }
  }

  onStatusChange(task: TaskListResponseItem, columnId: string): void {
    this.editingCell.set(null);
    if (columnId !== task.column_id) {
      this.taskService
        .moveTask(task.id, { column_id: columnId, position: 'zzz' })
        .pipe(takeUntil(this.destroy$))
        .subscribe({ next: () => this.loadData() });
    }
  }

  onDueDateChange(task: TaskListResponseItem, date: Date | null): void {
    this.editingCell.set(null);
    const newDate = date ? date.toISOString().split('T')[0] : null;
    if (newDate !== task.due_date) {
      const updates: UpdateTaskRequest = date
        ? { due_date: newDate }
        : { clear_due_date: true };
      this.saveSubject.next({ taskId: task.id, updates });
    }
  }

  toggleColumnVisibility(field: string, visible: boolean): void {
    this.columnConfigs.update((cols) => {
      const updated = cols.map((c) =>
        c.field === field ? { ...c, visible } : c,
      );
      this.saveColumnConfigs(updated);
      return updated;
    });
  }

  // --- Formatters ---

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

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getSubtaskPercent(task: TaskListResponseItem): number {
    if (!task.subtask_total) return 0;
    return Math.round((task.subtask_completed / task.subtask_total) * 100);
  }

  formatDueDate(date: string): string {
    const dueDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (isToday(date)) return 'Today';

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

  // --- Column config persistence ---

  private loadColumnConfigs(): ColumnConfig[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ColumnConfig[];
        return DEFAULT_COLUMNS.map((def) => {
          const saved = parsed.find((p) => p.field === def.field);
          return saved ? { ...def, visible: saved.visible } : def;
        });
      }
    } catch { /* ignore */ }
    return DEFAULT_COLUMNS.map((c) => ({ ...c }));
  }

  private saveColumnConfigs(configs: ColumnConfig[]): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(configs.map((c) => ({ field: c.field, visible: c.visible }))),
    );
  }
}
