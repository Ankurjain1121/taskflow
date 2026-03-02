import { Injectable, signal, computed, inject } from '@angular/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { isOverdue } from '../../../shared/utils/task-colors';

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
  UpdateTaskRequest,
} from '../../../core/services/task.service';
import {
  TaskGroupService,
  TaskGroupWithStats,
} from '../../../core/services/task-group.service';
import {
  MilestoneService,
  Milestone,
} from '../../../core/services/milestone.service';
import { DependencyService } from '../../../core/services/dependency.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { GanttTask, GanttDependency } from '../gantt-view/gantt-view.component';
import { TaskFilters } from '../board-toolbar/board-toolbar.component';
import { CreateTaskDialogResult } from './create-task-dialog.component';
import { CreateColumnDialogResult } from './create-column-dialog.component';
import { generateKeyBetween } from 'fractional-indexing';
import { GroupByMode, SwimlaneGroup, SwimlaneState } from './swimlane.types';
import { buildSwimlaneGroups, buildSwimlaneState } from './swimlane-utils';

@Injectable()
export class BoardStateService {
  private boardService = inject(BoardService);
  private taskService = inject(TaskService);
  private taskGroupService = inject(TaskGroupService);
  private milestoneService = inject(MilestoneService);
  private dependencyService = inject(DependencyService);
  private wsService = inject(WebSocketService);

  // === Signals ===
  readonly loading = signal(true);
  readonly board = signal<Board | null>(null);
  readonly columns = signal<Column[]>([]);
  readonly boardState = signal<Record<string, Task[]>>({});
  readonly flatTasks = signal<TaskListItem[]>([]);
  readonly ganttTasks = signal<GanttTask[]>([]);
  readonly boardDependencies = signal<GanttDependency[]>([]);
  readonly listLoading = signal(false);
  readonly filters = signal<TaskFilters>({
    search: '',
    priorities: [],
    assigneeIds: [],
    dueDateStart: null,
    dueDateEnd: null,
    labelIds: [],
    overdue: false,
  });
  readonly celebratingTaskId = signal<string | null>(null);
  readonly focusedTaskId = signal<string | null>(null);
  readonly selectedTaskId = signal<string | null>(null);
  readonly selectedTaskIds = signal<string[]>([]);
  readonly selectionMode = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly boardMembers = signal<BoardMember[]>([]);
  readonly boardMilestones = signal<Milestone[]>([]);
  readonly boardGroups = signal<TaskGroupWithStats[]>([]);
  readonly collapsedColumnIds = signal<Set<string>>(new Set());
  readonly groupBy = signal<GroupByMode>('none');
  readonly collapsedSwimlaneIds = signal<Set<string>>(new Set());
  readonly cardDensity = signal<'compact' | 'normal' | 'expanded'>(
    (['compact', 'normal', 'expanded'].includes(
      localStorage.getItem('taskflow_card_density') ?? '',
    )
      ? (localStorage.getItem('taskflow_card_density') as
          | 'compact'
          | 'normal'
          | 'expanded')
      : 'normal'),
  );
  readonly dragSimulationActive = signal<boolean>(false);
  readonly dragSimulationSourceColumnId = signal<string | null>(null);
  readonly dragSimulationCurrentColumnId = signal<string | null>(null);

  // === Computed Signals ===
  readonly collapsedGroupIds = computed(() => {
    return new Set(
      this.boardGroups()
        .filter((g) => g.group.collapsed)
        .map((g) => g.group.id),
    );
  });

  readonly filteredBoardState = computed(() => {
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

  readonly allAssignees = computed(() => {
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

  readonly allLabels = computed(() => {
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

  readonly connectedColumnIds = computed(() => {
    return this.columns().map((col) => 'column-' + col.id);
  });

  readonly swimlaneGroups = computed((): SwimlaneGroup[] => {
    const mode = this.groupBy();
    if (mode === 'none') return [];
    return buildSwimlaneGroups(this.boardState(), mode);
  });

  readonly swimlaneState = computed((): SwimlaneState => {
    const mode = this.groupBy();
    if (mode === 'none') return {};
    return buildSwimlaneState(this.filteredBoardState(), this.swimlaneGroups(), mode);
  });

  // === Data Loading ===

  loadBoard(boardId: string, destroy$: Subject<void>): void {
    this.loading.set(true);

    this.loadCollapsedColumns(boardId);
    this.loadGroupBy(boardId);
    this.boardService.getBoardFull(boardId).subscribe({
      next: (response: BoardFullResponse) => {
        this.board.set(response.board);
        this.columns.set(
          [...response.board.columns].sort((a, b) =>
            a.position.localeCompare(b.position),
          ),
        );

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
            labels: t.labels as unknown as Label[],
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
        for (const colId of Object.keys(tasksByColumn)) {
          tasksByColumn[colId].sort((a, b) =>
            a.position.localeCompare(b.position),
          );
        }
        this.boardState.set(tasksByColumn);

        this.boardMembers.set(response.members);
        this.loading.set(false);

        this.wsService.send('subscribe', { channel: `board:${boardId}` });
      },
      error: () => {
        this.loading.set(false);
        this.showError('Failed to load board');
      },
    });

    this.milestoneService.list(boardId).subscribe({
      next: (milestones) => this.boardMilestones.set(milestones),
    });
    this.taskGroupService.listGroupsWithStats(boardId).subscribe({
      next: (groups) => this.boardGroups.set(groups),
    });
  }

  loadFlatTasks(boardId: string, destroy$: Subject<void>): void {
    this.listLoading.set(true);
    this.taskService
      .listFlat(boardId)
      .pipe(takeUntil(destroy$))
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

  loadGanttData(boardId: string): void {
    forkJoin({
      tasks: this.taskService.listGanttTasks(boardId),
      deps: this.dependencyService.getBoardDependencies(boardId),
    }).subscribe({
      next: ({ tasks, deps }) => {
        this.ganttTasks.set(tasks as unknown as GanttTask[]);
        this.boardDependencies.set(deps as unknown as GanttDependency[]);
      },
    });
  }

  reloadGroups(boardId: string): void {
    this.taskGroupService.listGroupsWithStats(boardId).subscribe({
      next: (groups) => this.boardGroups.set(groups),
    });
  }

  // === Task CRUD ===

  createTask(
    boardId: string,
    columnId: string,
    taskData: CreateTaskDialogResult,
  ): void {
    // Snapshot for rollback
    const snapshot = structuredClone(this.boardState());

    // Create optimistic temp task
    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const tempTask: Task = {
      id: tempId,
      column_id: columnId,
      group_id: taskData.group_id ?? null,
      title: taskData.title,
      description: taskData.description ?? null,
      priority: (taskData.priority as Task['priority']) ?? 'medium',
      position: 'zzzzzz', // sort to end
      milestone_id: taskData.milestone_id ?? null,
      assignee_id: null,
      due_date: taskData.due_date ?? null,
      created_by: '',
      created_at: now,
      updated_at: now,
      assignees: [],
      labels: [],
    };

    // Optimistically insert
    this.boardState.update((state) => {
      const newState = { ...state };
      const columnTasks = newState[columnId] || [];
      newState[columnId] = [...columnTasks, tempTask];
      return newState;
    });

    this.taskService
      .createTask(boardId, {
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
        next: (realTask) => {
          // Replace temp task with server response
          this.boardState.update((state) => {
            const newState = { ...state };
            const columnTasks = newState[columnId] || [];
            newState[columnId] = columnTasks
              .map((t) => (t.id === tempId ? realTask : t))
              .sort((a, b) => a.position.localeCompare(b.position));
            return newState;
          });
        },
        error: () => {
          // Rollback to snapshot
          this.boardState.set(snapshot);
          this.showError('Failed to create task');
        },
      });
  }

  updateTaskInState(task: Task): void {
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

  /**
   * Optimistically update a task in boardState and send the update to the server.
   * Rolls back to snapshot on error.
   */
  optimisticUpdateTask(
    taskId: string,
    updates: Partial<Task>,
    serverUpdates?: Record<string, unknown>,
  ): void {
    const snapshot = structuredClone(this.boardState());

    // Apply optimistic update
    this.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      for (const [columnId, tasks] of Object.entries(state)) {
        newState[columnId] = tasks.map((t) =>
          t.id === taskId ? { ...t, ...updates } : t,
        );
      }
      return newState;
    });

    // Send to server
    const req = serverUpdates ?? (updates as Record<string, unknown>);
    this.taskService.updateTask(taskId, req as UpdateTaskRequest).subscribe({
      next: (updatedTask) => {
        // Replace with server-confirmed data
        this.boardState.update((state) => {
          const newState: Record<string, Task[]> = {};
          for (const [columnId, tasks] of Object.entries(state)) {
            newState[columnId] = tasks.map((t) =>
              t.id === taskId ? { ...t, ...updatedTask } : t,
            );
          }
          return newState;
        });
      },
      error: () => {
        this.boardState.set(snapshot);
        this.showError('Failed to update task. Reverted.');
      },
    });
  }

  // === Column Operations ===

  createColumn(boardId: string, columnData: CreateColumnDialogResult): void {
    // Snapshot for rollback
    const colSnapshot = structuredClone(this.columns());
    const stateSnapshot = structuredClone(this.boardState());

    // Optimistic temp column
    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const tempColumn: Column = {
      id: tempId,
      board_id: boardId,
      name: columnData.name,
      position: 'zzzzzz',
      color: columnData.color ?? '',
      status_mapping: columnData.isDone ? { done: true } : null,
      wip_limit: null,
      created_at: now,
      updated_at: now,
    };

    this.columns.update((cols) => [...cols, tempColumn]);
    this.boardState.update((state) => ({ ...state, [tempId]: [] }));

    this.boardService
      .createColumn(boardId, {
        name: columnData.name,
        color: columnData.color,
        status_mapping: columnData.isDone ? { done: true } : undefined,
      })
      .subscribe({
        next: (realColumn) => {
          // Replace temp with real column
          this.columns.update((cols) =>
            cols
              .map((c) => (c.id === tempId ? realColumn : c))
              .sort((a, b) => a.position.localeCompare(b.position)),
          );
          this.boardState.update((state) => {
            const newState = { ...state };
            const tempTasks = newState[tempId] || [];
            delete newState[tempId];
            newState[realColumn.id] = tempTasks;
            return newState;
          });
        },
        error: () => {
          this.columns.set(colSnapshot);
          this.boardState.set(stateSnapshot);
          this.showError('Failed to create column');
        },
      });
  }

  reorderColumn(prevIdx: number, currIdx: number): void {
    const snapshot = structuredClone(this.columns());

    // Optimistic reorder
    const cols = [...snapshot];
    const [removed] = cols.splice(prevIdx, 1);
    cols.splice(currIdx, 0, removed);
    this.columns.set(cols);

    const movedColumn = cols[currIdx];
    this.boardService.reorderColumn(movedColumn.id, { new_index: currIdx }).subscribe({
      error: () => {
        this.columns.set(snapshot);
        this.showError('Failed to reorder column');
      },
    });
  }

  deleteColumn(boardId: string, columnId: string): void {
    // Snapshot for rollback
    const colSnapshot = structuredClone(this.columns());
    const stateSnapshot = structuredClone(this.boardState());

    // Optimistically remove column
    this.columns.update((cols) => cols.filter((c) => c.id !== columnId));
    this.boardState.update((state) => {
      const newState = { ...state };
      delete newState[columnId];
      return newState;
    });

    this.boardService.deleteColumn(columnId).subscribe({
      error: () => {
        this.columns.set(colSnapshot);
        this.boardState.set(stateSnapshot);
        this.showError('Failed to delete column. Reverted.');
      },
    });
  }

  deleteTask(taskId: string): void {
    const snapshot = structuredClone(this.boardState());

    // Optimistically remove from all columns
    this.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      for (const [colId, tasks] of Object.entries(state)) {
        newState[colId] = tasks.filter((t) => t.id !== taskId);
      }
      return newState;
    });

    this.taskService.deleteTask(taskId).subscribe({
      error: () => {
        this.boardState.set(snapshot);
        this.showError('Failed to delete task. Reverted.');
      },
    });
  }

  // === Task Group Operations ===

  createGroup(boardId: string, result: { name: string; color: string }): void {
    const groups = this.boardGroups();
    const lastGroup = groups[groups.length - 1];
    const position = generateKeyBetween(
      lastGroup?.group.position ?? null,
      null,
    );

    this.taskGroupService
      .createGroup(boardId, {
        board_id: boardId,
        name: result.name,
        color: result.color,
        position,
      })
      .subscribe({
        next: () => this.reloadGroups(boardId),
        error: () => this.showError('Failed to create group'),
      });
  }

  updateGroupName(boardId: string, groupId: string, name: string): void {
    this.taskGroupService.updateGroup(groupId, { name }).subscribe({
      next: () => this.reloadGroups(boardId),
      error: () => this.showError('Failed to rename group'),
    });
  }

  updateGroupColor(boardId: string, groupId: string, color: string): void {
    this.taskGroupService.updateGroup(groupId, { color }).subscribe({
      next: () => this.reloadGroups(boardId),
      error: () => this.showError('Failed to update group color'),
    });
  }

  toggleGroupCollapse(group: TaskGroupWithStats): void {
    const newCollapsed = !group.group.collapsed;

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

  deleteGroup(boardId: string, groupId: string): void {
    this.taskGroupService.deleteGroup(groupId).subscribe({
      next: () => {
        this.reloadGroups(boardId);
        this.loadBoard(boardId, new Subject<void>());
      },
      error: () => this.showError('Failed to delete group'),
    });
  }

  // === Selection ===

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

  // === Column Collapse ===

  loadCollapsedColumns(boardId: string): void {
    try {
      const stored = localStorage.getItem(
        `taskflow_collapsed_columns_${boardId}`,
      );
      if (stored) {
        this.collapsedColumnIds.set(new Set(JSON.parse(stored)));
      } else {
        this.collapsedColumnIds.set(new Set());
      }
    } catch {
      this.collapsedColumnIds.set(new Set());
    }
  }

  toggleColumnCollapse(boardId: string, columnId: string): void {
    const current = this.collapsedColumnIds();
    const updated = new Set(current);
    if (updated.has(columnId)) {
      updated.delete(columnId);
    } else {
      updated.add(columnId);
    }
    this.collapsedColumnIds.set(updated);
    localStorage.setItem(
      `taskflow_collapsed_columns_${boardId}`,
      JSON.stringify([...updated]),
    );
  }

  isColumnCollapsed(columnId: string): boolean {
    return this.collapsedColumnIds().has(columnId);
  }

  // === Card Density ===

  setCardDensity(density: 'compact' | 'normal' | 'expanded'): void {
    this.cardDensity.set(density);
    localStorage.setItem('taskflow_card_density', density);
  }

  // === Swimlane Group By ===

  loadGroupBy(boardId: string): void {
    try {
      const stored = localStorage.getItem(`tf_swimlane_${boardId}`);
      if (stored && ['none', 'assignee', 'priority', 'label'].includes(stored)) {
        this.groupBy.set(stored as GroupByMode);
      } else {
        this.groupBy.set('none');
      }
    } catch {
      this.groupBy.set('none');
    }
  }

  setGroupBy(mode: GroupByMode, boardId: string): void {
    this.groupBy.set(mode);
    localStorage.setItem(`tf_swimlane_${boardId}`, mode);
  }

  toggleSwimlaneCollapse(groupKey: string): void {
    const current = this.collapsedSwimlaneIds();
    const updated = new Set(current);
    if (updated.has(groupKey)) {
      updated.delete(groupKey);
    } else {
      updated.add(groupKey);
    }
    this.collapsedSwimlaneIds.set(updated);
  }

  // === Error Handling ===

  showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.clearError(), 5000);
  }

  clearError(): void {
    this.errorMessage.set(null);
  }

  // === Filtering ===

  filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
    return tasks.filter((task) => {
      if (
        filters.search &&
        !task.title.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.priorities.length > 0 &&
        !filters.priorities.includes(task.priority)
      ) {
        return false;
      }

      if (filters.assigneeIds.length > 0) {
        const taskAssigneeIds = task.assignees?.map((a) => a.id) || [];
        const hasMatchingAssignee = filters.assigneeIds.some((id) =>
          taskAssigneeIds.includes(id),
        );
        if (!hasMatchingAssignee) {
          return false;
        }
      }

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

      if (filters.labelIds.length > 0) {
        const taskLabelIds = task.labels?.map((l) => l.id) || [];
        const hasMatchingLabel = filters.labelIds.some((id) =>
          taskLabelIds.includes(id),
        );
        if (!hasMatchingLabel) {
          return false;
        }
      }

      if (filters.overdue) {
        if (!task.due_date || !isOverdue(task.due_date)) {
          return false;
        }
      }

      return true;
    });
  }
}
