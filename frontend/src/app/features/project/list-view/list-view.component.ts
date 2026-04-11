import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  ElementRef,
  inject,
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
  formatDueDate as sharedFormatDueDate,
  type ColorByMode,
  type ColorableTask,
  resolveCardColor,
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
  templateUrl: './list-view.component.html',
  styleUrl: './list-view.component.css',
})
export class ListViewComponent {
  tasks = input<TaskListItem[]>([]);
  groups = input<TaskGroupWithStats[]>([]);
  loading = input<boolean>(false);
  columns = input<ColumnInput[]>([]);
  projectId = input<string>('');
  colorBy = input<ColorByMode>('priority');
  hasActiveFilters = input<boolean>(false);

  getRowStripe(task: TaskListItem): string | null {
    if (this.colorBy() === 'priority') return null;
    // TaskListItem has limited fields — only priority is available for color resolution
    const colorable: ColorableTask = {
      priority: task.priority,
      labels: [],
      assignees: [],
      project_color: null,
    };
    return resolveCardColor(colorable, this.colorBy());
  }

  // Parent may push a task id into inline-edit mode (e.g., after "create above/below")
  inlineEditTaskId = input<string | null>(null);

  taskClicked = output<string>();
  titleChanged = output<{ taskId: string; title: string }>();
  priorityChanged = output<{ taskId: string; priority: string }>();
  statusChanged = output<{ taskId: string; statusId: string }>();
  dueDateChanged = output<{ taskId: string; dueDate: string | null }>();
  groupToggled = output<TaskGroupWithStats>();
  createTaskClicked = output<void>();
  createAboveRequested = output<string>();
  createBelowRequested = output<string>();
  /** Emitted when user presses Escape/blurs an inline-edit input with an empty title. */
  inlineEditCancelled = output<string>();

  // Row focus tracking — used by Ctrl+Shift+Up/Down shortcuts
  focusedTaskId = signal<string | null>(null);

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

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

    // When parent sets inlineEditTaskId (e.g., after a create-above/below),
    // switch the matching row into inline title edit mode and focus the input.
    effect(() => {
      const id = this.inlineEditTaskId();
      if (!id) return;
      const task = this.tasks().find((t) => t.id === id);
      if (!task) return;
      this.editingTitleTaskId.set(id);
      this.editingTitleValue.set(task.title ?? '');
      this.focusedTaskId.set(id);
      queueMicrotask(() => this.focusInlineTitleInput(id));
    });
  }

  private focusInlineTitleInput(taskId: string): void {
    // Retry briefly in case PrimeNG hasn't rendered the row yet.
    let attempts = 0;
    const rootEl: HTMLElement = this.host.nativeElement;
    const tryFocus = () => {
      attempts++;
      const row = rootEl.querySelector(
        `tr[data-task-row-id="${taskId}"]`,
      ) as HTMLElement | null;
      const input = row?.querySelector('input[pInputText]') as
        | HTMLInputElement
        | null
        | undefined;
      if (input) {
        input.focus();
        input.select();
        return;
      }
      if (attempts < 10) setTimeout(tryFocus, 30);
    };
    tryFocus();
  }

  private loadSortState(pid: string): void {
    try {
      const stored = localStorage.getItem(`taskbolt-sort-${pid}`);
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
          `taskbolt-sort-${pid}`,
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
      // Empty title on save — treat as cancel so parent can clean up pending new tasks.
      this.cancelTitleEdit(task.id);
      return;
    }
    if (newTitle !== task.title) {
      this.titleChanged.emit({ taskId: task.id, title: newTitle });
    }
    this.editingTitleTaskId.set(null);
  }

  cancelTitleEdit(taskId?: string): void {
    const id = taskId ?? this.editingTitleTaskId();
    this.editingTitleTaskId.set(null);
    this.editingTitleValue.set('');
    if (id) {
      this.inlineEditCancelled.emit(id);
    }
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
    this.focusedTaskId.set(task.id);
    this.taskClicked.emit(task.id);
  }

  onRowFocus(task: TaskListItem): void {
    this.focusedTaskId.set(task.id);
  }

  /**
   * Ctrl+Shift+ArrowUp / ArrowDown on the wrapper:
   * create a new task above/below the currently focused row.
   * No-op if no row is focused or the user is typing in an input/textarea.
   */
  onWrapperKeydown(event: KeyboardEvent): void {
    if (!event.ctrlKey || !event.shiftKey) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target?.isContentEditable
    ) {
      return;
    }

    const focusedId = this.focusedTaskId();
    if (!focusedId) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'ArrowUp') {
      this.createAboveRequested.emit(focusedId);
    } else {
      this.createBelowRequested.emit(focusedId);
    }
  }

  formatDueDate(date: string): string {
    if (isOverdue(date)) {
      const dueDate = new Date(date);
      const today = new Date();
      const diffDays = Math.ceil(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return `Overdue (${diffDays}d)`;
    }
    return sharedFormatDueDate(date);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /**
   * Format total logged minutes as "Xh Ym" (e.g. "1h 30m").
   * Returns an em-dash ("—") when no time has been logged, so the column
   * stays visually quiet for tasks without any entries.
   *
   * Running timers are already excluded by the backend query — this only
   * receives minutes from stopped entries.
   */
  formatLoggedTime(minutes: number | null | undefined): string {
    if (minutes == null || minutes <= 0) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
}
