import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { generateKeyBetween } from 'fractional-indexing';

import {
  BoardService,
  Board,
  Column,
  BoardMember,
  BoardFullResponse,
} from '../../../core/services/board.service';
import {
  TaskService,
  Task,
  Assignee,
  TaskListItem,
  Label,
  BulkUpdateRequest,
} from '../../../core/services/task.service';
import {
  TaskGroupService,
  TaskGroupWithStats,
} from '../../../core/services/task-group.service';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';
import {
  CreateTaskDialogComponent,
  CreateTaskDialogResult,
} from './create-task-dialog.component';
import {
  CreateColumnDialogComponent,
  CreateColumnDialogResult,
} from './create-column-dialog.component';
import {
  CreateTaskGroupDialogComponent,
  CreateTaskGroupDialogResult,
} from '../create-task-group-dialog/create-task-group-dialog.component';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  MilestoneService,
  Milestone,
} from '../../../core/services/milestone.service';

import {
  KanbanColumnComponent,
  TaskMoveEvent,
} from '../kanban-column/kanban-column.component';
import {
  BoardToolbarComponent,
  TaskFilters,
  ViewMode,
} from '../board-toolbar/board-toolbar.component';
import { TaskDetailComponent } from '../task-detail/task-detail.component';
import { ListViewComponent } from '../list-view/list-view.component';
import { CalendarViewComponent } from '../calendar-view/calendar-view.component';
import {
  GanttViewComponent,
  GanttTask,
  GanttDependency,
} from '../gantt-view/gantt-view.component';
import { ReportsViewComponent } from '../reports-view/reports-view.component';
import { TimeReportComponent } from '../time-report/time-report.component';
import {
  BulkActionsBarComponent,
  BulkAction,
} from '../bulk-actions/bulk-actions-bar.component';
import { TaskGroupHeaderComponent } from '../task-group-header/task-group-header.component';
import { ShortcutHelpComponent } from '../../../shared/components/shortcut-help/shortcut-help.component';
import { DependencyService } from '../../../core/services/dependency.service';

@Component({
  selector: 'app-board-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CdkDropListGroup,
    CreateTaskDialogComponent,
    CreateColumnDialogComponent,
    CreateTaskGroupDialogComponent,
    KanbanColumnComponent,
    BoardToolbarComponent,
    TaskDetailComponent,
    ListViewComponent,
    CalendarViewComponent,
    GanttViewComponent,
    ReportsViewComponent,
    TimeReportComponent,
    BulkActionsBarComponent,
    TaskGroupHeaderComponent,
    ShortcutHelpComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-screen flex flex-col bg-gray-50">
      <!-- Header -->
      <div class="bg-white border-b border-gray-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              {{ board()?.name || 'Loading...' }}
            </h1>
            @if (board()?.description) {
              <p class="text-sm text-gray-500 mt-1">
                {{ board()?.description }}
              </p>
            }
          </div>
          <div class="flex items-center gap-3">
            <!-- Settings Button -->
            <a
              [routerLink]="[
                '/workspace',
                workspaceId,
                'board',
                boardId,
                'settings',
              ]"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Settings
            </a>

            <!-- Add Group Button -->
            <button
              (click)="onCreateGroup()"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Add Group
            </button>

            <!-- New Task Button -->
            <button
              (click)="onCreateTask()"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Task
            </button>
          </div>
        </div>
      </div>

      <!-- Toolbar -->
      <app-board-toolbar
        [assignees]="allAssignees()"
        [viewMode]="viewMode()"
        (filtersChanged)="onFiltersChanged($event)"
        (viewModeChanged)="onViewModeChanged($event)"
      ></app-board-toolbar>

      <!-- Task Group Headers -->
      @if (boardGroups().length > 1) {
        <div class="px-4 py-2 bg-white border-b border-gray-200 space-y-1">
          @for (group of boardGroups(); track group.group.id) {
            <app-task-group-header
              [groupData]="group"
              (nameChange)="onGroupNameChange(group.group.id, $event)"
              (colorChange)="onGroupColorChange(group.group.id, $event)"
              (toggleCollapse)="onGroupToggleCollapse(group)"
              (delete)="onGroupDelete(group.group.id)"
            />
          }
        </div>
      }

      <!-- Board Content -->
      @if (loading()) {
        <div class="flex-1 overflow-x-auto p-4">
          <div class="flex gap-4 h-full">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="flex-shrink-0 w-72">
                <div class="bg-white rounded-lg border border-gray-200 p-3">
                  <div
                    class="skeleton skeleton-text w-24 mb-4"
                    style="height: 14px;"
                  ></div>
                  <div class="space-y-3">
                    @for (j of [1, 2, 3]; track j) {
                      <div
                        class="bg-gray-50 rounded-lg p-3 border border-gray-100"
                      >
                        <div class="skeleton skeleton-text w-full mb-2"></div>
                        <div class="skeleton skeleton-text w-3/4 mb-3"></div>
                        <div class="flex items-center gap-2">
                          <div class="skeleton w-16 h-5 rounded-full"></div>
                          <div class="flex-1"></div>
                          <div class="skeleton skeleton-circle w-6 h-6"></div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      } @else if (viewMode() === 'list') {
        <!-- List View -->
        <div class="flex-1 overflow-y-auto">
          <app-list-view
            [tasks]="flatTasks()"
            [loading]="listLoading()"
            (taskClicked)="onListTaskClicked($event)"
          ></app-list-view>
        </div>
      } @else if (viewMode() === 'calendar') {
        <!-- Calendar View -->
        <div class="flex-1 overflow-hidden">
          <app-calendar-view
            [boardId]="boardId"
            (taskClicked)="onListTaskClicked($event)"
          ></app-calendar-view>
        </div>
      } @else if (viewMode() === 'gantt') {
        <!-- Gantt Chart View -->
        <div class="flex-1 overflow-hidden">
          <app-gantt-view
            [tasks]="ganttTasks()"
            [dependencies]="boardDependencies()"
            (taskClicked)="onListTaskClicked($event)"
          ></app-gantt-view>
        </div>
      } @else if (viewMode() === 'reports') {
        <!-- Reports View -->
        <div class="flex-1 overflow-y-auto">
          <app-reports-view [boardId]="boardId"></app-reports-view>
        </div>
      } @else if (viewMode() === 'time-report') {
        <!-- Time Report View -->
        <div class="flex-1 overflow-y-auto">
          <app-time-report [boardId]="boardId"></app-time-report>
        </div>
      } @else {
        <!-- Kanban Board -->
        <div class="flex-1 overflow-x-auto p-4" cdkDropListGroup>
          <div class="flex gap-4 h-full">
            @for (column of columns(); track column.id) {
              <app-kanban-column
                [column]="column"
                [tasks]="getFilteredTasksForColumn(column.id)"
                [connectedLists]="connectedColumnIds()"
                [celebratingTaskId]="celebratingTaskId()"
                [focusedTaskId]="focusedTaskId()"
                (taskMoved)="onTaskMoved($event)"
                (taskClicked)="onTaskClicked($event)"
                (addTaskClicked)="onAddTaskToColumn($event)"
              ></app-kanban-column>
            }

            <!-- Add Column Button -->
            <div class="flex-shrink-0">
              <button
                (click)="onAddColumn()"
                class="w-72 h-12 flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-600 transition-colors"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Column
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Task Detail Panel -->
      @if (selectedTaskId()) {
        <app-task-detail
          [taskId]="selectedTaskId()!"
          [workspaceId]="workspaceId"
          [boardId]="boardId"
          (closed)="closeTaskDetail()"
          (taskUpdated)="onTaskUpdated($event)"
        ></app-task-detail>
      }

      <!-- Bulk Actions Bar -->
      @if (selectedTaskIds().length > 0) {
        <app-bulk-actions-bar
          [selectedCount]="selectedTaskIds().length"
          [columns]="columns()"
          [milestones]="boardMilestones()"
          [groups]="boardGroups()"
          (bulkAction)="onBulkAction($event)"
          (cancelSelection)="clearSelection()"
        ></app-bulk-actions-bar>
      }

      <!-- Keyboard Shortcuts Help -->
      <app-shortcut-help></app-shortcut-help>

      <!-- Inline Create Task Dialog -->
      <app-create-task-dialog
        [(visible)]="showCreateTaskDialog"
        [columnId]="createTaskDialogColumnId"
        [columnName]="createTaskDialogColumnName"
        [members]="createTaskDialogMembers"
        [labels]="createTaskDialogLabels"
        [milestones]="createTaskDialogMilestones"
        [groups]="createTaskDialogGroups"
        (created)="onCreateTaskResult($event)"
      />

      <!-- Inline Create Column Dialog -->
      <app-create-column-dialog
        [(visible)]="showCreateColumnDialog"
        (created)="onCreateColumnResult($event)"
      />

      <!-- Inline Create Group Dialog -->
      <app-create-task-group-dialog
        [(visible)]="showCreateGroupDialog"
        (created)="onCreateGroupResult($event)"
      />

      <!-- Snackbar for errors -->
      @if (errorMessage()) {
        <div
          class="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3"
        >
          <span>{{ errorMessage() }}</span>
          <button (click)="clearError()" class="hover:text-red-200">
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class BoardViewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private boardService = inject(BoardService);
  private taskService = inject(TaskService);
  private taskGroupService = inject(TaskGroupService);
  private wsService = inject(WebSocketService);
  private authService = inject(AuthService);
  private dependencyService = inject(DependencyService);
  private milestoneService = inject(MilestoneService);
  private shortcutsService = inject(KeyboardShortcutsService);
  private destroy$ = new Subject<void>();

  workspaceId = '';
  boardId = '';

  loading = signal(true);
  board = signal<Board | null>(null);
  columns = signal<Column[]>([]);
  boardState = signal<Record<string, Task[]>>({});
  viewMode = signal<ViewMode>('kanban');
  flatTasks = signal<TaskListItem[]>([]);
  ganttTasks = signal<GanttTask[]>([]);
  boardDependencies = signal<GanttDependency[]>([]);
  listLoading = signal(false);
  filters = signal<TaskFilters>({
    search: '',
    priorities: [],
    assigneeIds: [],
    dueDateStart: null,
    dueDateEnd: null,
    labelIds: [],
  });
  celebratingTaskId = signal<string | null>(null);
  focusedTaskId = signal<string | null>(null);
  selectedTaskId = signal<string | null>(null);
  selectedTaskIds = signal<string[]>([]);
  selectionMode = signal(false);
  errorMessage = signal<string | null>(null);
  boardMembers = signal<BoardMember[]>([]);
  boardMilestones = signal<Milestone[]>([]);
  boardGroups = signal<TaskGroupWithStats[]>([]);

  // Dialog visibility state
  showCreateTaskDialog = false;
  createTaskDialogColumnId = '';
  createTaskDialogColumnName = '';
  createTaskDialogMembers: { id: string; name: string; avatar_url?: string }[] =
    [];
  createTaskDialogLabels: { id: string; name: string; color: string }[] = [];
  createTaskDialogMilestones: { id: string; name: string; color: string }[] =
    [];
  createTaskDialogGroups: { id: string; name: string; color: string }[] = [];

  showCreateColumnDialog = false;
  showCreateGroupDialog = false;

  // Computed: IDs of collapsed groups (tasks in collapsed groups are hidden)
  collapsedGroupIds = computed(() => {
    return new Set(
      this.boardGroups()
        .filter((g) => g.group.collapsed)
        .map((g) => g.group.id),
    );
  });

  // Computed: filtered board state (applies text/priority/assignee filters + group collapse)
  filteredBoardState = computed(() => {
    const state = this.boardState();
    const f = this.filters();
    const collapsed = this.collapsedGroupIds();

    const result: Record<string, Task[]> = {};

    for (const [columnId, tasks] of Object.entries(state)) {
      result[columnId] = this.filterTasks(tasks, f).filter(
        (t) => !t.group_id || !collapsed.has(t.group_id),
      );
    }

    return result;
  });

  // Computed: all unique assignees across tasks
  allAssignees = computed(() => {
    const assigneeMap = new Map<string, Assignee>();
    const state = this.boardState();

    for (const tasks of Object.values(state)) {
      if (!Array.isArray(tasks)) continue;
      for (const task of tasks) {
        if (Array.isArray(task.assignees)) {
          for (const assignee of task.assignees) {
            assigneeMap.set(assignee.id, assignee);
          }
        }
      }
    }

    return Array.from(assigneeMap.values());
  });

  // Computed: all unique labels across tasks
  allLabels = computed(() => {
    const labelMap = new Map<string, Label>();
    const state = this.boardState();

    for (const tasks of Object.values(state)) {
      if (!Array.isArray(tasks)) continue;
      for (const task of tasks) {
        if (Array.isArray(task.labels)) {
          for (const label of task.labels) {
            labelMap.set(label.id, label);
          }
        }
      }
    }

    return Array.from(labelMap.values());
  });

  // Computed: connected column IDs for drag-drop
  connectedColumnIds = computed(() => {
    return this.columns().map((col) => 'column-' + col.id);
  });

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.workspaceId = params['workspaceId'];
      this.boardId = params['boardId'];
      this.loadBoard();
    });

    // Connect to WebSocket for real-time updates
    this.wsService.connect();
    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        this.handleWebSocketMessage(message);
      });

    // Register keyboard shortcuts
    this.registerShortcuts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.shortcutsService.unregisterByCategory('Board');
    // Unsubscribe from board channel
    this.wsService.send('unsubscribe', { channel: `board:${this.boardId}` });
  }

  getFilteredTasksForColumn(columnId: string): Task[] {
    return this.filteredBoardState()[columnId] || [];
  }

  onFiltersChanged(filters: TaskFilters): void {
    this.filters.set(filters);
  }

  onViewModeChanged(mode: ViewMode): void {
    this.viewMode.set(mode);
    if (mode === 'list') {
      this.loadFlatTasks();
    } else if (mode === 'gantt') {
      this.loadGanttData();
    }
  }

  private loadGanttData(): void {
    forkJoin({
      tasks: this.taskService.listGanttTasks(this.boardId),
      deps: this.dependencyService.getBoardDependencies(this.boardId),
    }).subscribe({
      next: ({ tasks, deps }) => {
        this.ganttTasks.set(tasks as unknown as GanttTask[]);
        this.boardDependencies.set(deps as unknown as GanttDependency[]);
      },
    });
  }

  onListTaskClicked(taskId: string): void {
    this.router.navigate(['/task', taskId]);
  }

  onTaskMoved(event: TaskMoveEvent): void {
    const snapshot = structuredClone(this.boardState());

    // Get tasks in target column
    const targetTasks = this.boardState()[event.targetColumnId] || [];

    // Calculate new position
    const beforeTask = targetTasks[event.currentIndex - 1];
    const afterTask = targetTasks[event.currentIndex + 1];

    const beforePos = beforeTask?.position || null;
    const afterPos = afterTask?.position || null;

    let newPosition: string;
    try {
      newPosition = generateKeyBetween(beforePos, afterPos);
    } catch {
      // Fallback if fractional indexing fails
      newPosition = Date.now().toString();
    }

    // Optimistic update already done by CDK
    // Update the task's position and column_id in our state
    this.boardState.update((state) => {
      const newState = { ...state };

      // Update task in target column
      if (newState[event.targetColumnId]) {
        newState[event.targetColumnId] = newState[event.targetColumnId].map(
          (t) =>
            t.id === event.task.id
              ? { ...t, column_id: event.targetColumnId, position: newPosition }
              : t,
        );
      }

      return newState;
    });

    // Celebrate if moved to a done column
    const targetColumn = this.columns().find(
      (c) => c.id === event.targetColumnId,
    );
    if (
      targetColumn?.status_mapping?.done &&
      event.previousColumnId !== event.targetColumnId
    ) {
      this.celebratingTaskId.set(event.task.id);
      setTimeout(() => this.celebratingTaskId.set(null), 1200);
    }

    // Call API
    this.taskService
      .moveTask(event.task.id, {
        column_id: event.targetColumnId,
        position: newPosition,
      })
      .subscribe({
        error: () => {
          // Rollback on error
          this.boardState.set(snapshot);
          this.showError('Failed to move task. Reverted.');
        },
      });
  }

  onTaskClicked(task: Task): void {
    this.router.navigate(['/task', task.id]);
  }

  closeTaskDetail(): void {
    this.selectedTaskId.set(null);
  }

  onTaskUpdated(task: Task): void {
    this.boardState.update((state) => {
      const newState = { ...state };
      const columnTasks = newState[task.column_id];
      if (columnTasks) {
        newState[task.column_id] = columnTasks.map((t) =>
          t.id === task.id ? task : t,
        );
      }
      return newState;
    });
  }

  onCreateTask(): void {
    // Open create task dialog with first column selected
    const firstColumn = this.columns()[0];
    if (firstColumn) {
      this.onAddTaskToColumn(firstColumn.id);
    }
  }

  onAddTaskToColumn(columnId: string): void {
    const column = this.columns().find((c) => c.id === columnId);
    if (!column) return;

    this.createTaskDialogColumnId = columnId;
    this.createTaskDialogColumnName = column.name;
    this.createTaskDialogMembers = this.boardMembers().map((m) => ({
      id: m.user_id,
      name: m.display_name || m.email || 'Unknown',
      avatar_url: m.avatar_url ?? undefined,
    }));
    this.createTaskDialogLabels = this.allLabels().map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
    }));
    this.createTaskDialogMilestones = this.boardMilestones().map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
    }));
    this.createTaskDialogGroups = this.boardGroups().map((g) => ({
      id: g.group.id,
      name: g.group.name,
      color: g.group.color,
    }));
    this.showCreateTaskDialog = true;
  }

  onCreateTaskResult(result: CreateTaskDialogResult): void {
    this.createTask(this.createTaskDialogColumnId, result);
  }

  private createTask(columnId: string, taskData: CreateTaskDialogResult): void {
    this.taskService
      .createTask(this.boardId, {
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        column_id: columnId,
        due_date: taskData.due_date,
        start_date: taskData.start_date,
        estimated_hours: taskData.estimated_hours,
        group_id: taskData.group_id,
        milestone_id: taskData.milestone_id,
        assignee_ids: taskData.assignee_ids,
        label_ids: taskData.label_ids,
      })
      .subscribe({
        next: (task) => {
          // Add task to the board state
          this.boardState.update((state) => {
            const newState = { ...state };
            const columnTasks = newState[columnId] || [];
            newState[columnId] = [...columnTasks, task].sort((a, b) =>
              a.position.localeCompare(b.position),
            );
            return newState;
          });
        },
        error: () => {
          this.showError('Failed to create task');
        },
      });
  }

  onAddColumn(): void {
    this.showCreateColumnDialog = true;
  }

  onCreateColumnResult(result: CreateColumnDialogResult): void {
    this.createColumn(result);
  }

  private createColumn(columnData: CreateColumnDialogResult): void {
    const columns = this.columns();
    const lastColumn = columns[columns.length - 1];

    this.boardService
      .createColumn(this.boardId, {
        name: columnData.name,
        color: columnData.color,
        status_mapping: columnData.isDone ? { done: true } : undefined,
      })
      .subscribe({
        next: (column) => {
          this.columns.update((cols) =>
            [...cols, column].sort((a, b) =>
              a.position.localeCompare(b.position),
            ),
          );
          // Initialize empty task array for new column
          this.boardState.update((state) => ({
            ...state,
            [column.id]: [],
          }));
        },
        error: () => {
          this.showError('Failed to create column');
        },
      });
  }

  // === Task Group Operations ===

  onCreateGroup(): void {
    this.showCreateGroupDialog = true;
  }

  onCreateGroupResult(result: CreateTaskGroupDialogResult): void {
    const groups = this.boardGroups();
    const lastGroup = groups[groups.length - 1];
    const position = generateKeyBetween(
      lastGroup?.group.position ?? null,
      null,
    );

    this.taskGroupService
      .createGroup(this.boardId, {
        board_id: this.boardId,
        name: result.name,
        color: result.color,
        position,
      })
      .subscribe({
        next: () => this.reloadGroups(),
        error: () => this.showError('Failed to create group'),
      });
  }

  onGroupNameChange(groupId: string, name: string): void {
    this.taskGroupService.updateGroup(groupId, { name }).subscribe({
      next: () => this.reloadGroups(),
      error: () => this.showError('Failed to rename group'),
    });
  }

  onGroupColorChange(groupId: string, color: string): void {
    this.taskGroupService.updateGroup(groupId, { color }).subscribe({
      next: () => this.reloadGroups(),
      error: () => this.showError('Failed to update group color'),
    });
  }

  onGroupToggleCollapse(group: TaskGroupWithStats): void {
    const newCollapsed = !group.group.collapsed;

    // Optimistic update
    this.boardGroups.update((groups) =>
      groups.map((g) =>
        g.group.id === group.group.id
          ? { ...g, group: { ...g.group, collapsed: newCollapsed } }
          : g,
      ),
    );

    this.taskGroupService
      .toggleCollapse(group.group.id, newCollapsed)
      .subscribe({
        error: () => {
          // Revert on error
          this.boardGroups.update((groups) =>
            groups.map((g) =>
              g.group.id === group.group.id
                ? { ...g, group: { ...g.group, collapsed: !newCollapsed } }
                : g,
            ),
          );
          this.showError('Failed to toggle group');
        },
      });
  }

  onGroupDelete(groupId: string): void {
    this.taskGroupService.deleteGroup(groupId).subscribe({
      next: () => {
        this.reloadGroups();
        this.loadBoard(); // Reload tasks since they moved to Ungrouped
      },
      error: () => this.showError('Failed to delete group'),
    });
  }

  private reloadGroups(): void {
    this.taskGroupService.listGroupsWithStats(this.boardId).subscribe({
      next: (groups) => this.boardGroups.set(groups),
    });
  }

  clearError(): void {
    this.errorMessage.set(null);
  }

  private loadFlatTasks(): void {
    this.listLoading.set(true);
    this.taskService
      .listFlat(this.boardId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks) => {
          this.flatTasks.set(tasks);
          this.listLoading.set(false);
        },
        error: () => {
          this.listLoading.set(false);
          this.showError('Failed to load task list');
        },
      });
  }

  private loadBoard(): void {
    this.loading.set(true);

    // Batch endpoint for board + columns + tasks + members
    this.boardService.getBoardFull(this.boardId).subscribe({
      next: (response: BoardFullResponse) => {
        this.board.set(response.board);
        this.columns.set(
          [...response.board.columns].sort((a, b) =>
            a.position.localeCompare(b.position),
          ),
        );

        // Group tasks by column_id into Record<string, Task[]>
        const tasksByColumn: Record<string, Task[]> = {};
        for (const col of response.board.columns) {
          tasksByColumn[col.id] = [];
        }
        for (const t of response.tasks) {
          const task: Task = {
            id: t.id,
            column_id: t.column_id,
            group_id: t.group_id,
            title: t.title,
            description: t.description,
            priority: t.priority as Task['priority'],
            position: t.position,
            milestone_id: t.milestone_id,
            assignee_id: null,
            due_date: t.due_date,
            created_by: t.created_by_id,
            created_at: t.created_at,
            updated_at: t.updated_at,
            assignees: t.assignees,
            labels: t.labels as any[],
            subtask_completed: t.subtask_completed,
            subtask_total: t.subtask_total,
            has_running_timer: t.has_running_timer,
            comment_count: t.comment_count,
          };
          if (!tasksByColumn[t.column_id]) {
            tasksByColumn[t.column_id] = [];
          }
          tasksByColumn[t.column_id].push(task);
        }
        // Sort tasks within each column by position
        for (const colId of Object.keys(tasksByColumn)) {
          tasksByColumn[colId].sort((a, b) =>
            a.position.localeCompare(b.position),
          );
        }
        this.boardState.set(tasksByColumn);

        this.boardMembers.set(response.members);
        this.loading.set(false);

        // Subscribe to board updates
        this.wsService.send('subscribe', { channel: `board:${this.boardId}` });
      },
      error: () => {
        this.loading.set(false);
        this.showError('Failed to load board');
      },
    });

    // Milestones and groups are not in the batch response yet; load separately
    this.milestoneService.list(this.boardId).subscribe({
      next: (milestones) => this.boardMilestones.set(milestones),
    });
    this.taskGroupService.listGroupsWithStats(this.boardId).subscribe({
      next: (groups) => this.boardGroups.set(groups),
    });
  }

  private filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
    return tasks.filter((task) => {
      // Search filter
      if (
        filters.search &&
        !task.title.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      // Priority filter
      if (
        filters.priorities.length > 0 &&
        !filters.priorities.includes(task.priority)
      ) {
        return false;
      }

      // Assignee filter
      if (filters.assigneeIds.length > 0) {
        const taskAssigneeIds = task.assignees?.map((a) => a.id) || [];
        const hasMatchingAssignee = filters.assigneeIds.some((id) =>
          taskAssigneeIds.includes(id),
        );
        if (!hasMatchingAssignee) {
          return false;
        }
      }

      // Due date filter
      if (filters.dueDateStart || filters.dueDateEnd) {
        if (!task.due_date) {
          return false;
        }
        const dueDate = new Date(task.due_date);
        if (filters.dueDateStart && dueDate < new Date(filters.dueDateStart)) {
          return false;
        }
        if (filters.dueDateEnd && dueDate > new Date(filters.dueDateEnd)) {
          return false;
        }
      }

      // Label filter
      if (filters.labelIds.length > 0) {
        const taskLabelIds = task.labels?.map((l) => l.id) || [];
        const hasMatchingLabel = filters.labelIds.some((id) =>
          taskLabelIds.includes(id),
        );
        if (!hasMatchingLabel) {
          return false;
        }
      }

      return true;
    });
  }

  private handleWebSocketMessage(message: {
    type: string;
    payload: unknown;
  }): void {
    if (!message.payload || typeof message.payload !== 'object') return;

    const currentUserId = this.authService.currentUser()?.id;

    // Skip own updates to avoid double-applying
    const payload = message.payload as { userId?: string; task?: Task };
    if (payload.userId && payload.userId === currentUserId) {
      return;
    }

    switch (message.type) {
      case 'task:created':
        this.handleTaskCreated(payload.task!);
        break;
      case 'task:updated':
        this.handleTaskUpdated(payload.task!);
        break;
      case 'task:moved':
        this.handleTaskMoved(payload.task!);
        break;
      case 'task:deleted':
        this.handleTaskDeleted(payload.task!);
        break;
    }
  }

  private handleTaskCreated(task: Task): void {
    this.boardState.update((state) => {
      const newState = { ...state };
      const columnTasks = newState[task.column_id] || [];
      newState[task.column_id] = [...columnTasks, task].sort((a, b) =>
        a.position.localeCompare(b.position),
      );
      return newState;
    });
  }

  private handleTaskUpdated(task: Task): void {
    this.boardState.update((state) => {
      const newState = { ...state };
      for (const [columnId, tasks] of Object.entries(newState)) {
        newState[columnId] = tasks.map((t) => (t.id === task.id ? task : t));
      }
      return newState;
    });
  }

  private handleTaskMoved(task: Task): void {
    this.boardState.update((state) => {
      const newState = { ...state };

      // Remove from all columns
      for (const [columnId, tasks] of Object.entries(newState)) {
        newState[columnId] = tasks.filter((t) => t.id !== task.id);
      }

      // Add to target column
      const columnTasks = newState[task.column_id] || [];
      newState[task.column_id] = [...columnTasks, task].sort((a, b) =>
        a.position.localeCompare(b.position),
      );

      return newState;
    });
  }

  private handleTaskDeleted(task: Task): void {
    this.boardState.update((state) => {
      const newState = { ...state };
      for (const [columnId, tasks] of Object.entries(newState)) {
        newState[columnId] = tasks.filter((t) => t.id !== task.id);
      }
      return newState;
    });
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.clearError(), 5000);
  }

  // === Bulk Operations ===

  toggleTaskSelection(taskId: string): void {
    const current = this.selectedTaskIds();
    if (current.includes(taskId)) {
      this.selectedTaskIds.set(current.filter((id) => id !== taskId));
    } else {
      this.selectedTaskIds.set([...current, taskId]);
    }
  }

  clearSelection(): void {
    this.selectedTaskIds.set([]);
    this.selectionMode.set(false);
  }

  onBulkAction(action: BulkAction): void {
    const ids = this.selectedTaskIds();
    if (ids.length === 0) return;

    if (action.type === 'delete') {
      this.taskService.bulkDelete(this.boardId, { task_ids: ids }).subscribe({
        next: () => {
          this.clearSelection();
          this.loadBoard();
        },
        error: () => this.showError('Failed to delete tasks'),
      });
      return;
    }

    const req: BulkUpdateRequest = { task_ids: ids };
    if (action.type === 'move' && action.column_id)
      req.column_id = action.column_id;
    if (action.type === 'priority' && action.priority)
      req.priority = action.priority;
    if (action.type === 'milestone') {
      if (action.clear_milestone) {
        req.clear_milestone = true;
      } else if (action.milestone_id) {
        req.milestone_id = action.milestone_id;
      }
    }
    if (action.type === 'group') {
      if (action.clear_group) {
        req.clear_group = true;
      } else if (action.group_id) {
        req.group_id = action.group_id;
      }
    }

    this.taskService.bulkUpdate(this.boardId, req).subscribe({
      next: () => {
        this.clearSelection();
        this.loadBoard();
      },
      error: () => this.showError('Failed to update tasks'),
    });
  }

  // === Card Keyboard Navigation (J/K/Enter) ===

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    // Don't trigger when typing in inputs/textareas/select/contenteditable
    const target = event.target as HTMLElement;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }

    // Only handle J/K/Enter for card navigation when in kanban view
    if (this.viewMode() !== 'kanban') return;

    switch (event.key) {
      case 'j':
      case 'J':
        this.navigateCard(1);
        event.preventDefault();
        break;
      case 'k':
      case 'K':
        this.navigateCard(-1);
        event.preventDefault();
        break;
      case 'Enter':
        if (this.focusedTaskId()) {
          this.openFocusedTask();
          event.preventDefault();
        }
        break;
    }
  }

  private navigateCard(direction: number): void {
    const allTasks = this.getAllVisibleTasks();
    if (allTasks.length === 0) return;

    const currentId = this.focusedTaskId();
    const currentIndex = currentId
      ? allTasks.findIndex((t) => t.id === currentId)
      : -1;

    const nextIndex = Math.max(
      0,
      Math.min(allTasks.length - 1, currentIndex + direction),
    );
    const nextTaskId = allTasks[nextIndex].id;
    this.focusedTaskId.set(nextTaskId);

    // Scroll the focused card into view
    setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${nextTaskId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  }

  private getAllVisibleTasks(): Task[] {
    const cols = this.columns();
    const filtered = this.filteredBoardState();
    const tasks: Task[] = [];

    for (const col of cols) {
      const colTasks = filtered[col.id] || [];
      tasks.push(...colTasks);
    }

    return tasks;
  }

  private openFocusedTask(): void {
    const taskId = this.focusedTaskId();
    if (taskId) {
      this.router.navigate(['/task', taskId]);
    }
  }

  // === Keyboard Shortcuts ===

  private registerShortcuts(): void {
    this.shortcutsService.register('board-new-task', {
      key: 'n',
      description: 'Create new task',
      category: 'Board',
      action: () => this.onCreateTask(),
    });

    this.shortcutsService.register('board-search', {
      key: '/',
      description: 'Focus search',
      category: 'Board',
      action: () => {
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[placeholder*="Search"]',
        );
        searchInput?.focus();
      },
    });

    this.shortcutsService.register('board-escape', {
      key: 'Escape',
      description: 'Close panel / Clear selection / Clear focus',
      category: 'Board',
      action: () => {
        if (this.focusedTaskId()) {
          this.focusedTaskId.set(null);
        } else if (this.selectedTaskIds().length > 0) {
          this.clearSelection();
        } else if (this.selectedTaskId()) {
          this.closeTaskDetail();
        }
      },
    });

    this.shortcutsService.register('board-view-kanban', {
      key: '1',
      description: 'Kanban view',
      category: 'Board',
      action: () => this.viewMode.set('kanban'),
    });

    this.shortcutsService.register('board-view-list', {
      key: '2',
      description: 'List view',
      category: 'Board',
      action: () => {
        this.viewMode.set('list');
        this.onViewModeChanged('list');
      },
    });

    this.shortcutsService.register('board-view-calendar', {
      key: '3',
      description: 'Calendar view',
      category: 'Board',
      action: () => {
        this.viewMode.set('calendar');
        this.onViewModeChanged('calendar');
      },
    });

    this.shortcutsService.register('board-view-gantt', {
      key: '4',
      description: 'Gantt view',
      category: 'Board',
      action: () => {
        this.viewMode.set('gantt');
        this.onViewModeChanged('gantt');
      },
    });

    this.shortcutsService.register('board-view-reports', {
      key: '5',
      description: 'Reports view',
      category: 'Board',
      action: () => {
        this.viewMode.set('reports');
        this.onViewModeChanged('reports');
      },
    });

    this.shortcutsService.register('board-view-time-report', {
      key: '6',
      description: 'Time report view',
      category: 'Board',
      action: () => {
        this.viewMode.set('time-report');
        this.onViewModeChanged('time-report');
      },
    });
  }
}
