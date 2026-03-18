import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
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
import { TaskGroupWithStats } from '../../../core/services/task-group.service';
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
    <div class="mx-4 my-4 space-y-3 overflow-x-auto">
      <!-- Shared task row cells template -->
      <ng-template #taskRowCells let-task>
        <td (click)="$event.stopPropagation()">
          @if (editingTitleTaskId() === task.id) {
            <input
              pInputText
              type="text"
              class="w-full text-sm"
              aria-label="Edit task title"
              [ngModel]="editingTitleValue()"
              (ngModelChange)="editingTitleValue.set($event)"
              (blur)="saveTitleEdit(task)"
              (keydown.enter)="saveTitleEdit(task)"
              (keydown.escape)="cancelTitleEdit()"
              #titleInput
            />
          } @else {
            <a
              class="text-sm font-medium text-[var(--foreground)] hover:text-[var(--primary)] hover:underline cursor-pointer rounded px-1 py-0.5 -mx-1"
              (click)="onRowClick(task)"
              (dblclick)="startTitleEdit(task, $event)"
            >
              {{ task.title }}
            </a>
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
            <button
              class="flex items-center justify-center w-full h-8 rounded text-xs font-medium text-white cursor-pointer transition-opacity hover:opacity-85 border-none"
              [style.background-color]="getPriorityHexColor(task.priority)"
              (click)="editingPriorityTaskId.set(task.id)"
              [attr.aria-label]="'Priority: ' + getPriorityLabelText(task.priority) + '. Click to edit'"
            >
              {{ getPriorityLabelText(task.priority) }}
            </button>
          }
        </td>
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
            <button
              class="flex items-center justify-center w-full h-8 rounded text-xs font-medium cursor-pointer transition-opacity hover:opacity-85 border-none"
              [style.background]="
                task.status_color || 'var(--secondary)'
              "
              [style.color]="
                task.status_color
                  ? '#fff'
                  : 'var(--secondary-foreground)'
              "
              (click)="editingStatusTaskId.set(task.id)"
              [attr.aria-label]="'Status: ' + (task.status_name || task.column_name) + '. Click to edit'"
            >
              {{ task.status_name || task.column_name }}
            </button>
          }
        </td>
        <td (click)="$event.stopPropagation()">
          @if (editingDueDateTaskId() === task.id) {
            <p-datepicker
              [ngModel]="
                task.due_date ? parseDate(task.due_date) : null
              "
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
            <button
              class="cursor-pointer hover:bg-[var(--muted)] rounded px-1 py-0.5 -mx-1 border-none bg-transparent text-left"
              (click)="editingDueDateTaskId.set(task.id)"
              [attr.aria-label]="'Due date: ' + (task.due_date ? formatDueDate(task.due_date) : 'Not set') + '. Click to edit'"
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
            </button>
          }
        </td>
        <td>
          <span class="text-sm text-[var(--muted-foreground)]">
            {{ formatDate(task.created_at) }}
          </span>
        </td>
      </ng-template>

      @if (hasGroups()) {
        <!-- Grouped view — single table with native row grouping -->
        <p-table
          [value]="displayTasks()"
          [loading]="loading()"
          [customSort]="true"
          (sortFunction)="customSortFn($event)"
          sortMode="single"
          [sortField]="savedSortField()"
          [sortOrder]="savedSortOrder()"
          (onSort)="onSortChange($event)"
          [(selection)]="selectedTasks"
          [paginator]="displayTasks().length > 25"
          [rows]="25"
          [rowsPerPageOptions]="[10, 25, 50, 100]"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords} tasks"
          selectionMode="multiple"
          dataKey="id"
          [rowHover]="true"
          styleClass="p-datatable-sm"
          [resizableColumns]="true"
          rowGroupMode="subheader"
          groupRowsBy="task_list_id"
        >
          <ng-template #header>
            <tr>
              <th style="min-width: 3rem; width: 3rem">
                <p-tableHeaderCheckbox />
              </th>
              <th pSortableColumn="title" pResizableColumn style="min-width: 200px">
                Title <p-sortIcon field="title" />
              </th>
              <th pSortableColumn="priority" pResizableColumn style="min-width: 100px; width: 120px">
                Priority <p-sortIcon field="priority" />
              </th>
              <th pSortableColumn="status_name" pResizableColumn style="min-width: 120px; width: 160px">
                Status <p-sortIcon field="status_name" />
              </th>
              <th pSortableColumn="due_date" pResizableColumn style="min-width: 120px; width: 160px">
                Due Date <p-sortIcon field="due_date" />
              </th>
              <th pSortableColumn="created_at" pResizableColumn style="min-width: 100px; width: 140px">
                Created <p-sortIcon field="created_at" />
              </th>
            </tr>
          </ng-template>
          <ng-template #groupheader let-task>
            @let group = getGroupData(task.task_list_id);
            <tr pRowGroupHeader>
              <td
                colspan="6"
                class="!p-0 !border-none"
              >
                <div
                  class="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none transition-colors hover:brightness-95"
                  [style.background-color]="(group?.group?.color ?? '#6b7280') + '15'"
                  [style.border-left]="'3px solid ' + (group?.group?.color ?? '#6b7280')"
                  (click)="onToggleGroupById(task.task_list_id)"
                >
                  <div class="flex items-center gap-2">
                    <i
                      class="pi text-xs text-[var(--muted-foreground)]"
                      [class.pi-chevron-right]="group?.group?.collapsed"
                      [class.pi-chevron-down]="!group?.group?.collapsed"
                    ></i>
                    <span
                      class="text-sm font-semibold"
                      [style.color]="group?.group?.color ?? '#6b7280'"
                    >
                      {{ group?.group?.name ?? 'Ungrouped' }}
                    </span>
                    <span
                      class="text-xs text-[var(--muted-foreground)] px-2 py-0.5 bg-[var(--secondary)] rounded-full"
                    >
                      {{ group?.completed_count ?? 0 }} /
                      {{ group?.task_count ?? 0 }}
                    </span>
                    @if (
                      group?.estimated_hours != null &&
                      group!.estimated_hours! > 0
                    ) {
                      <span
                        class="text-xs text-[var(--muted-foreground)] px-2 py-0.5 bg-[var(--secondary)] rounded-full flex items-center gap-1"
                      >
                        <i class="pi pi-clock" style="font-size: 0.7rem"></i>
                        {{ group!.estimated_hours!.toFixed(1) }}h
                      </span>
                    }
                    <span
                      class="text-xs font-medium px-2 py-0.5 rounded-full"
                      [class]="getCompletionClassFromPct(getCompletionPct(group))"
                    >
                      {{ getCompletionPct(group) }}%
                    </span>
                  </div>
                  <span class="text-xs text-[var(--muted-foreground)]">
                    {{ group?.task_count ?? 0 }} tasks
                  </span>
                </div>
              </td>
            </tr>
          </ng-template>
          <ng-template #body let-task>
            @if (isGroupCollapsed(task.task_list_id)) {
              <tr style="display: none">
                <td colspan="6"></td>
              </tr>
            } @else {
              <tr
                [pSelectableRow]="task"
                class="cursor-pointer"
                (click)="onRowClick(task)"
              >
                <td (click)="$event.stopPropagation()">
                  <p-tableCheckbox [value]="task" />
                </td>
                <ng-container
                  *ngTemplateOutlet="taskRowCells; context: { $implicit: task }"
                ></ng-container>
              </tr>
            }
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
      } @else {
        <!-- Flat view (no groups or single group) -->
        <p-table
          [value]="tasks()"
          [loading]="loading()"
          sortMode="single"
          [sortField]="savedSortField()"
          [sortOrder]="savedSortOrder()"
          (onSort)="onSortChange($event)"
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
          [resizableColumns]="true"
        >
          <ng-template #header>
            <tr>
              <th style="min-width: 3rem; width: 3rem">
                <p-tableHeaderCheckbox />
              </th>
              <th pSortableColumn="title" pResizableColumn style="min-width: 200px">
                Title <p-sortIcon field="title" />
              </th>
              <th pSortableColumn="priority" pResizableColumn style="min-width: 100px; width: 120px">
                Priority <p-sortIcon field="priority" />
              </th>
              <th pSortableColumn="status_name" pResizableColumn style="min-width: 120px; width: 160px">
                Status <p-sortIcon field="status_name" />
              </th>
              <th pSortableColumn="due_date" pResizableColumn style="min-width: 120px; width: 160px">
                Due Date <p-sortIcon field="due_date" />
              </th>
              <th pSortableColumn="created_at" pResizableColumn style="min-width: 100px; width: 140px">
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
              <ng-container
                *ngTemplateOutlet="taskRowCells; context: { $implicit: task }"
              ></ng-container>
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
      }
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

      :host
        ::ng-deep
        .p-datatable
        .p-datatable-tbody
        > tr:not(.p-rowgroup-header):nth-child(even) {
        background: color-mix(in srgb, var(--background) 95%, var(--primary));
      }

      :host
        ::ng-deep
        .p-datatable
        .p-datatable-tbody
        > tr:not(.p-rowgroup-header):hover {
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

      :host
        ::ng-deep
        .p-datatable
        .p-datatable-tbody
        > tr.p-rowgroup-header {
        background: transparent !important;
      }

      :host
        ::ng-deep
        .p-datatable
        .p-datatable-tbody
        > tr.p-rowgroup-header
        > td {
        padding: 0 !important;
        border: none !important;
      }
    `,
  ],
})
export class ListViewComponent {
  tasks = input<TaskListItem[]>([]);
  groups = input<TaskGroupWithStats[]>([]);
  loading = input<boolean>(false);
  columns = input<ColumnInput[]>([]);
  projectId = input<string>('');

  taskClicked = output<string>();
  titleChanged = output<{ taskId: string; title: string }>();
  priorityChanged = output<{ taskId: string; priority: string }>();
  statusChanged = output<{ taskId: string; statusId: string }>();
  dueDateChanged = output<{ taskId: string; dueDate: string | null }>();
  groupToggled = output<TaskGroupWithStats>();

  selectedTasks: TaskListItem[] = [];

  // Sort persistence
  savedSortField = signal<string>('created_at');
  savedSortOrder = signal<number>(-1);

  constructor() {
    // Load saved sort state reactively when projectId becomes available
    effect(() => {
      const pid = this.projectId();
      if (pid) {
        this.loadSortState(pid);
      }
    });
  }

  private loadSortState(pid: string): void {
    try {
      const stored = localStorage.getItem(`taskflow-sort-${pid}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.field) this.savedSortField.set(parsed.field);
        if (parsed.order) this.savedSortOrder.set(parsed.order);
      }
    } catch {
      // Ignore parse errors
    }
  }

  onSortChange(event: { field: string; order: number }): void {
    this.savedSortField.set(event.field);
    this.savedSortOrder.set(event.order);
    const pid = this.projectId();
    if (pid) {
      try {
        localStorage.setItem(
          `taskflow-sort-${pid}`,
          JSON.stringify({ field: event.field, order: event.order }),
        );
      } catch {
        // Ignore storage errors
      }
    }
  }

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

  // === Computed signals ===

  hasGroups = computed(() => this.groups().length > 1);

  groupMap = computed(() => {
    const map = new Map<string, TaskGroupWithStats>();
    for (const g of this.groups()) {
      map.set(g.group.id, g);
    }
    return map;
  });

  groupPositionMap = computed(() => {
    const map = new Map<string | null, number>();
    const groups = this.groups();
    for (let i = 0; i < groups.length; i++) {
      map.set(groups[i].group.id, i);
    }
    map.set(null, groups.length); // ungrouped goes last
    return map;
  });

  sortedTasks = computed(() => {
    const tasks = this.tasks() ?? [];
    const posMap = this.groupPositionMap();
    if (!Array.isArray(tasks)) return [];
    return [...tasks].sort((a, b) => {
      const ga = posMap.get(a.task_list_id) ?? Number.MAX_SAFE_INTEGER;
      const gb = posMap.get(b.task_list_id) ?? Number.MAX_SAFE_INTEGER;
      if (ga !== gb) return ga - gb;
      return a.position.localeCompare(b.position);
    });
  });

  displayTasks = computed(() => {
    const tasks = this.sortedTasks();
    const collapsedIds = new Set(
      this.groups()
        .filter((g) => g.group.collapsed)
        .map((g) => g.group.id),
    );
    if (collapsedIds.size === 0) return tasks;

    // Keep one sentinel task per collapsed group so PrimeNG renders its group header
    const seenCollapsed = new Set<string>();
    return tasks.filter((task) => {
      const gid = task.task_list_id;
      if (gid === null || !collapsedIds.has(gid)) return true;
      if (seenCollapsed.has(gid)) return false;
      seenCollapsed.add(gid);
      return true;
    });
  });

  // === Group helpers ===

  getGroupData(id: string | null): TaskGroupWithStats | undefined {
    if (id === null) return undefined;
    return this.groupMap().get(id);
  }

  getCompletionPct(group: TaskGroupWithStats | undefined): number {
    if (!group || group.task_count === 0) return 0;
    return Math.round((group.completed_count / group.task_count) * 100);
  }

  getCompletionClassFromPct(pct: number): string {
    if (pct === 100)
      return 'bg-[var(--status-green-bg)] text-[var(--status-green-text)]';
    if (pct > 0)
      return 'bg-[var(--status-blue-bg)] text-[var(--status-blue-text)]';
    return 'bg-[var(--secondary)] text-[var(--muted-foreground)]';
  }

  isGroupCollapsed(taskListId: string | null): boolean {
    if (taskListId === null) return false;
    const group = this.groupMap().get(taskListId);
    return group?.group.collapsed ?? false;
  }

  onToggleGroupById(taskListId: string | null): void {
    if (taskListId === null) return;
    const group = this.groupMap().get(taskListId);
    if (group) {
      this.groupToggled.emit(group);
    }
  }

  customSortFn(event: {
    data: TaskListItem[];
    field: string;
    order: number;
  }): void {
    const posMap = this.groupPositionMap();
    event.data.sort((a, b) => {
      // Primary: preserve group ordering
      const ga = posMap.get(a.task_list_id) ?? Number.MAX_SAFE_INTEGER;
      const gb = posMap.get(b.task_list_id) ?? Number.MAX_SAFE_INTEGER;
      if (ga !== gb) return ga - gb;

      // Secondary: sort by user-selected column within each group
      const va = (a as unknown as Record<string, unknown>)[event.field];
      const vb = (b as unknown as Record<string, unknown>)[event.field];
      let result = 0;
      if (va == null && vb != null) result = -1;
      else if (va != null && vb == null) result = 1;
      else if (va != null && vb != null) {
        if (typeof va === 'string' && typeof vb === 'string') {
          result = va.localeCompare(vb);
        } else {
          result = va < vb ? -1 : va > vb ? 1 : 0;
        }
      }
      return result * event.order;
    });
  }

  // === Title editing ===

  startTitleEdit(task: TaskListItem, event?: MouseEvent): void {
    this.editingTitleTaskId.set(task.id);
    this.editingTitleValue.set(task.title);
    setTimeout(() => {
      const container = (event?.target as HTMLElement)?.closest('td');
      const el = container
        ? (container.querySelector('input[pInputText]') as HTMLInputElement | null)
        : (document.querySelector('input[pInputText]') as HTMLInputElement | null);
      el?.focus();
      el?.select();
    });
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
      return allCols.filter(
        (c) =>
          c.id === task.status_id ||
          currentStatus.allowed_transitions!.includes(c.id),
      );
    }

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
