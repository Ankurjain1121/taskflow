import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { generateKeyBetween } from 'fractional-indexing';

import { BoardService, Board, Column, BoardMember } from '../../../core/services/board.service';
import { TaskService, Task, Assignee, TaskListItem, Label, BulkUpdateRequest } from '../../../core/services/task.service';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';
import {
  CreateTaskDialogComponent,
  CreateTaskDialogResult,
} from './create-task-dialog.component';
import {
  CreateColumnDialogComponent,
  CreateColumnDialogResult,
} from './create-column-dialog.component';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/services/auth.service';
import { MilestoneService, Milestone } from '../../../core/services/milestone.service';

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
import { GanttViewComponent, GanttTask, GanttDependency } from '../gantt-view/gantt-view.component';
import { ReportsViewComponent } from '../reports-view/reports-view.component';
import { TimeReportComponent } from '../time-report/time-report.component';
import { BulkActionsBarComponent, BulkAction } from '../bulk-actions/bulk-actions-bar.component';
import { ShortcutHelpComponent } from '../../../shared/components/shortcut-help/shortcut-help.component';
import { DependencyService } from '../../../core/services/dependency.service';

@Component({
  selector: 'app-board-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CdkDropListGroup,
    MatDialogModule,
    KanbanColumnComponent,
    BoardToolbarComponent,
    TaskDetailComponent,
    ListViewComponent,
    CalendarViewComponent,
    GanttViewComponent,
    ReportsViewComponent,
    TimeReportComponent,
    BulkActionsBarComponent,
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
                'settings'
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

      <!-- Board Content -->
      @if (loading()) {
        <div class="flex-1 overflow-x-auto p-4">
          <div class="flex gap-4 h-full">
            @for (i of [1,2,3,4]; track i) {
              <div class="flex-shrink-0 w-72">
                <div class="bg-white rounded-lg border border-gray-200 p-3">
                  <div class="skeleton skeleton-text w-24 mb-4" style="height: 14px;"></div>
                  <div class="space-y-3">
                    @for (j of [1,2,3]; track j) {
                      <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
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
          <app-reports-view
            [boardId]="boardId"
          ></app-reports-view>
        </div>
      } @else if (viewMode() === 'time-report') {
        <!-- Time Report View -->
        <div class="flex-1 overflow-y-auto">
          <app-time-report
            [boardId]="boardId"
          ></app-time-report>
        </div>
      } @else {
        <!-- Kanban Board -->
        <div
          class="flex-1 overflow-x-auto p-4"
          cdkDropListGroup
        >
          <div class="flex gap-4 h-full">
            @for (column of columns(); track column.id) {
              <app-kanban-column
                [column]="column"
                [tasks]="getFilteredTasksForColumn(column.id)"
                [connectedLists]="connectedColumnIds()"
                [celebratingTaskId]="celebratingTaskId()"
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
          (bulkAction)="onBulkAction($event)"
          (cancelSelection)="clearSelection()"
        ></app-bulk-actions-bar>
      }

      <!-- Keyboard Shortcuts Help -->
      <app-shortcut-help></app-shortcut-help>

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
  private boardService = inject(BoardService);
  private taskService = inject(TaskService);
  private wsService = inject(WebSocketService);
  private authService = inject(AuthService);
  private dependencyService = inject(DependencyService);
  private milestoneService = inject(MilestoneService);
  private shortcutsService = inject(KeyboardShortcutsService);
  private dialog = inject(MatDialog);
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
  selectedTaskId = signal<string | null>(null);
  selectedTaskIds = signal<string[]>([]);
  selectionMode = signal(false);
  errorMessage = signal<string | null>(null);
  boardMembers = signal<BoardMember[]>([]);
  boardMilestones = signal<Milestone[]>([]);

  // Computed: filtered board state
  filteredBoardState = computed(() => {
    const state = this.boardState();
    const f = this.filters();

    const result: Record<string, Task[]> = {};

    for (const [columnId, tasks] of Object.entries(state)) {
      result[columnId] = this.filterTasks(tasks, f);
    }

    return result;
  });

  // Computed: all unique assignees across tasks
  allAssignees = computed(() => {
    const assigneeMap = new Map<string, Assignee>();
    const state = this.boardState();

    for (const tasks of Object.values(state)) {
      for (const task of tasks) {
        if (task.assignees) {
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
      for (const task of tasks) {
        if (task.labels) {
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
    this.selectedTaskId.set(taskId);
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
              : t
        );
      }

      return newState;
    });

    // Celebrate if moved to a done column
    const targetColumn = this.columns().find(c => c.id === event.targetColumnId);
    if (targetColumn?.status_mapping?.done && event.previousColumnId !== event.targetColumnId) {
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
        error: (err) => {
          console.error('Failed to move task:', err);
          // Rollback on error
          this.boardState.set(snapshot);
          this.showError('Failed to move task. Reverted.');
        },
      });
  }

  onTaskClicked(task: Task): void {
    this.selectedTaskId.set(task.id);
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
          t.id === task.id ? task : t
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

    const members = this.boardMembers().map((m) => ({
      id: m.user_id,
      name: m.display_name || m.email || 'Unknown',
      avatar_url: m.avatar_url ?? undefined,
    }));

    const labels = this.allLabels().map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
    }));

    const milestones = this.boardMilestones().map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
    }));

    const dialogRef = this.dialog.open(CreateTaskDialogComponent, {
      width: '500px',
      data: {
        columnId,
        columnName: column.name,
        members,
        labels,
        milestones,
      },
    });

    dialogRef.afterClosed().subscribe((result: CreateTaskDialogResult | undefined) => {
      if (result) {
        this.createTask(columnId, result);
      }
    });
  }

  private createTask(columnId: string, taskData: CreateTaskDialogResult): void {
    this.taskService
      .createTask(columnId, {
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        due_date: taskData.due_date,
        start_date: taskData.start_date,
        estimated_hours: taskData.estimated_hours,
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
              a.position.localeCompare(b.position)
            );
            return newState;
          });
        },
        error: (err) => {
          console.error('Failed to create task:', err);
          this.showError('Failed to create task');
        },
      });
  }

  onAddColumn(): void {
    const dialogRef = this.dialog.open(CreateColumnDialogComponent, {
      width: '500px',
    });

    dialogRef.afterClosed().subscribe((result: CreateColumnDialogResult | undefined) => {
      if (result) {
        this.createColumn(result);
      }
    });
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
            [...cols, column].sort((a, b) => a.position.localeCompare(b.position))
          );
          // Initialize empty task array for new column
          this.boardState.update((state) => ({
            ...state,
            [column.id]: [],
          }));
        },
        error: (err) => {
          console.error('Failed to create column:', err);
          this.showError('Failed to create column');
        },
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
        error: (err) => {
          console.error('Failed to load flat task list:', err);
          this.listLoading.set(false);
          this.showError('Failed to load task list');
        },
      });
  }

  private loadBoard(): void {
    this.loading.set(true);

    forkJoin({
      board: this.boardService.getBoard(this.boardId),
      columns: this.boardService.listColumns(this.boardId),
      tasks: this.taskService.listByBoard(this.boardId),
      members: this.boardService.getBoardMembers(this.boardId),
      milestones: this.milestoneService.list(this.boardId),
    }).subscribe({
      next: ({ board, columns, tasks, members, milestones }) => {
        this.board.set(board);
        this.columns.set(columns.sort((a, b) => a.position.localeCompare(b.position)));
        this.boardState.set(tasks);
        this.boardMembers.set(members);
        this.boardMilestones.set(milestones);
        this.loading.set(false);

        // Subscribe to board updates
        this.wsService.send('subscribe', { channel: `board:${this.boardId}` });
      },
      error: (err) => {
        console.error('Failed to load board:', err);
        this.loading.set(false);
        this.showError('Failed to load board');
      },
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
          taskAssigneeIds.includes(id)
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
          taskLabelIds.includes(id)
        );
        if (!hasMatchingLabel) {
          return false;
        }
      }

      return true;
    });
  }

  private handleWebSocketMessage(message: { type: string; payload: unknown }): void {
    const currentUserId = this.authService.currentUser()?.id;

    // Skip own updates to avoid double-applying
    const payload = message.payload as { userId?: string; task?: Task };
    if (payload.userId === currentUserId) {
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
        a.position.localeCompare(b.position)
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
        a.position.localeCompare(b.position)
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
        error: (err) => this.showError('Failed to delete tasks'),
      });
      return;
    }

    const req: BulkUpdateRequest = { task_ids: ids };
    if (action.type === 'move' && action.column_id) req.column_id = action.column_id;
    if (action.type === 'priority' && action.priority) req.priority = action.priority;
    if (action.type === 'milestone') {
      if (action.clear_milestone) {
        req.clear_milestone = true;
      } else if (action.milestone_id) {
        req.milestone_id = action.milestone_id;
      }
    }

    this.taskService.bulkUpdate(this.boardId, req).subscribe({
      next: () => {
        this.clearSelection();
        this.loadBoard();
      },
      error: (err) => this.showError('Failed to update tasks'),
    });
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
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
        searchInput?.focus();
      },
    });

    this.shortcutsService.register('board-escape', {
      key: 'Escape',
      description: 'Close panel / Clear selection',
      category: 'Board',
      action: () => {
        if (this.selectedTaskIds().length > 0) {
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
