import { Injectable, signal, computed, inject } from '@angular/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';

export const MAX_SELECTION = 500;

import {
  BoardService,
  Board,
  Column,
  BoardMember,
  BoardFullResponse,
  BoardMeta,
} from '../../../core/services/board.service';
import {
  TaskService,
  Task,
  Assignee,
  Label,
  TaskListItem,
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
import { GroupByMode, SwimlaneGroup, SwimlaneState } from './swimlane.types';
import { buildSwimlaneGroups, buildSwimlaneState } from './swimlane-utils';
import { BoardFilterService } from './board-filter.service';
import { BoardGroupingService } from './board-grouping.service';
import { BoardMutationsService } from './board-mutations.service';

export interface CardFields {
  showPriority: boolean;
  showDueDate: boolean;
  showAssignees: boolean;
  showLabels: boolean;
  showSubtaskProgress: boolean;
  showComments: boolean;
  showAttachments: boolean;
  showTaskId: boolean;
  showDescription: boolean;
  showDaysInColumn: boolean;
}

export const DEFAULT_CARD_FIELDS: CardFields = {
  showPriority: true,
  showDueDate: true,
  showAssignees: true,
  showLabels: true,
  showSubtaskProgress: true,
  showComments: true,
  showAttachments: true,
  showTaskId: true,
  showDescription: true,
  showDaysInColumn: true,
};

@Injectable()
export class BoardStateService {
  private boardService = inject(BoardService);
  private taskService = inject(TaskService);
  private taskGroupService = inject(TaskGroupService);
  private milestoneService = inject(MilestoneService);
  private dependencyService = inject(DependencyService);
  private wsService = inject(WebSocketService);
  private filterService = inject(BoardFilterService);
  private groupingService = inject(BoardGroupingService);
  private mutations = inject(BoardMutationsService);

  constructor() {
    this.mutations.init({
      boardState: this.boardState,
      columns: this.columns,
      boardMembers: this.boardMembers,
      boardGroups: this.boardGroups,
      allLabels: () => this.allLabels(),
      showError: (msg) => this.showError(msg),
      reloadGroups: (boardId) => this.reloadGroups(boardId),
      loadBoard: (boardId, destroy$) => this.loadBoard(boardId, destroy$),
    });
  }

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
  readonly taskMeta = signal<BoardMeta | null>(null);
  readonly tasksLoaded = signal<number>(0);
  readonly canLoadMore = computed(() => {
    const meta = this.taskMeta();
    if (!meta) return false;
    return this.tasksLoaded() < meta.total_task_count;
  });
  readonly dragSimulationActive = signal<boolean>(false);
  readonly dragSimulationSourceColumnId = signal<string | null>(null);
  readonly dragSimulationCurrentColumnId = signal<string | null>(null);
  readonly cardDensity = signal<'compact' | 'normal' | 'expanded'>(
    ['compact', 'normal', 'expanded'].includes(
      localStorage.getItem('taskflow_card_density') ?? '',
    )
      ? (localStorage.getItem('taskflow_card_density') as
          | 'compact'
          | 'normal'
          | 'expanded')
      : 'normal',
  );
  readonly cardFields = signal<CardFields>(
    (() => {
      try {
        const stored = localStorage.getItem('taskflow_card_fields');
        if (stored) return { ...DEFAULT_CARD_FIELDS, ...JSON.parse(stored) };
      } catch {
        /* ignore */
      }
      return DEFAULT_CARD_FIELDS;
    })(),
  );

  // === Delegated Signals (from grouping service) ===
  readonly groupBy = this.groupingService.groupBy;
  readonly collapsedSwimlaneIds = this.groupingService.collapsedSwimlaneIds;

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
      result[columnId] = this.filterService
        .filterTasks(tasks, f)
        .filter((t) => !t.group_id || !collapsed.has(t.group_id));
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

  readonly selectionAtLimit = computed(
    () => this.selectedTaskIds().length >= MAX_SELECTION,
  );

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
    return buildSwimlaneState(
      this.filteredBoardState(),
      this.swimlaneGroups(),
      mode,
    );
  });

  // === Data Loading ===

  loadBoard(boardId: string, destroy$: Subject<void>): void {
    this.loading.set(true);

    this.loadCollapsedColumns(boardId);
    this.groupingService.loadGroupBy(boardId);
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
            column_entered_at: t.column_entered_at,
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

        // Track pagination metadata
        if (response.meta) {
          this.taskMeta.set(response.meta);
          this.tasksLoaded.set(response.tasks.length);
        }

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

  loadMoreTasks(boardId: string): void {
    const offset = this.tasksLoaded();
    this.boardService.getBoardFull(boardId, { limit: 100, offset }).subscribe({
      next: (response: BoardFullResponse) => {
        if (response.meta) {
          this.taskMeta.set(response.meta);
        }
        this.tasksLoaded.update((loaded) => loaded + response.tasks.length);

        this.boardState.update((state) => {
          const newState = { ...state };
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
              column_entered_at: t.column_entered_at,
            };
            if (!newState[t.column_id]) {
              newState[t.column_id] = [];
            }
            newState[t.column_id] = [...newState[t.column_id], task];
          }
          for (const colId of Object.keys(newState)) {
            newState[colId] = [...newState[colId]].sort((a, b) =>
              a.position.localeCompare(b.position),
            );
          }
          return newState;
        });
      },
      error: () => {
        this.showError('Failed to load more tasks');
      },
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

  // === Task CRUD (delegated) ===

  createTask(
    boardId: string,
    columnId: string,
    taskData: CreateTaskDialogResult,
  ): void {
    this.mutations.createTask(boardId, columnId, taskData);
  }

  updateTaskInState(task: Task): void {
    this.mutations.updateTaskInState(task);
  }

  optimisticUpdateTask(
    taskId: string,
    updates: Partial<Task>,
    serverUpdates?: Record<string, unknown>,
  ): void {
    this.mutations.optimisticUpdateTask(taskId, updates, serverUpdates);
  }

  optimisticAssignUser(taskId: string, userId: string): void {
    this.mutations.optimisticAssignUser(taskId, userId);
  }

  optimisticUnassignUser(taskId: string, userId: string): void {
    this.mutations.optimisticUnassignUser(taskId, userId);
  }

  optimisticAddLabel(taskId: string, labelId: string): void {
    this.mutations.optimisticAddLabel(taskId, labelId);
  }

  optimisticRemoveLabel(taskId: string, labelId: string): void {
    this.mutations.optimisticRemoveLabel(taskId, labelId);
  }

  deleteTask(taskId: string): void {
    this.mutations.deleteTask(taskId);
  }

  // === Column Operations (delegated) ===

  createColumn(boardId: string, columnData: CreateColumnDialogResult): void {
    this.mutations.createColumn(boardId, columnData);
  }

  reorderColumn(prevIdx: number, currIdx: number): void {
    this.mutations.reorderColumn(prevIdx, currIdx);
  }

  deleteColumn(boardId: string, columnId: string): void {
    this.mutations.deleteColumn(boardId, columnId);
  }

  // === Task Group Operations (delegated) ===

  createGroup(boardId: string, result: { name: string; color: string }): void {
    this.mutations.createGroup(boardId, result);
  }

  updateGroupName(boardId: string, groupId: string, name: string): void {
    this.mutations.updateGroupName(boardId, groupId, name);
  }

  updateGroupColor(boardId: string, groupId: string, color: string): void {
    this.mutations.updateGroupColor(boardId, groupId, color);
  }

  toggleGroupCollapse(group: TaskGroupWithStats): void {
    this.mutations.toggleGroupCollapse(group);
  }

  deleteGroup(boardId: string, groupId: string): void {
    this.mutations.deleteGroup(boardId, groupId);
  }

  // === Selection ===

  toggleTaskSelection(taskId: string): boolean {
    const current = this.selectedTaskIds();
    if (current.includes(taskId)) {
      this.selectedTaskIds.set(current.filter((id) => id !== taskId));
      return false;
    }
    if (current.length >= MAX_SELECTION) {
      return true;
    }
    this.selectedTaskIds.set([...current, taskId]);
    return false;
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

  // === Card Fields ===

  updateCardField(key: keyof CardFields, value: boolean): void {
    this.cardFields.update((f) => {
      const next = { ...f, [key]: value };
      localStorage.setItem('taskflow_card_fields', JSON.stringify(next));
      return next;
    });
  }

  resetCardFields(): void {
    this.cardFields.set({ ...DEFAULT_CARD_FIELDS });
    localStorage.setItem(
      'taskflow_card_fields',
      JSON.stringify(DEFAULT_CARD_FIELDS),
    );
  }

  // === Swimlane Group By (delegated) ===

  loadGroupBy(boardId: string): void {
    this.groupingService.loadGroupBy(boardId);
  }

  setGroupBy(mode: GroupByMode, boardId: string): void {
    this.groupingService.setGroupBy(mode, boardId);
  }

  toggleSwimlaneCollapse(groupKey: string): void {
    this.groupingService.toggleSwimlaneCollapse(groupKey);
  }

  // === Error Handling ===

  showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.clearError(), 5000);
  }

  clearError(): void {
    this.errorMessage.set(null);
  }

  // === Filtering (delegated) ===

  filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
    return this.filterService.filterTasks(tasks, filters);
  }
}
