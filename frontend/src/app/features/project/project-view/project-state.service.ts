import { Injectable, signal, computed, inject } from '@angular/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';

export const MAX_SELECTION = 500;

import {
  ProjectService,
  Board,
  Column,
  ProjectMember,
  ProjectFullResponse,
  BoardMeta,
} from '../../../core/services/project.service';
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
import { TaskFilters } from '../project-toolbar/project-toolbar.component';
import { type ColorByMode, COLOR_BY_MODES } from '../../../shared/utils/task-colors';
import { CreateTaskDialogResult } from './create-task-dialog.component';
import { CreateColumnDialogResult } from './create-column-dialog.component';
import { GroupByMode, SwimlaneGroup, SwimlaneState } from './swimlane.types';
import { buildSwimlaneGroups, buildSwimlaneState } from './swimlane-utils';
import { ProjectFilterService } from './project-filter.service';
import { ProjectGroupingService } from './project-grouping.service';
import { ProjectMutationsService } from './project-mutations.service';

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
export class ProjectStateService {
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private taskGroupService = inject(TaskGroupService);
  private milestoneService = inject(MilestoneService);
  private dependencyService = inject(DependencyService);
  private wsService = inject(WebSocketService);
  private filterService = inject(ProjectFilterService);
  private groupingService = inject(ProjectGroupingService);
  private mutations = inject(ProjectMutationsService);

  constructor() {
    this.mutations.init({
      boardState: this.boardState,
      columns: this.columns,
      projectMembers: this.projectMembers,
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
  readonly projectMembers = signal<ProjectMember[]>([]);
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
  readonly statusTransitions = signal<Record<string, string[] | null>>({});
  readonly dragSimulationActive = signal<boolean>(false);
  readonly dragSimulationSourceColumnId = signal<string | null>(null);
  readonly dragSimulationCurrentColumnId = signal<string | null>(null);
  readonly cardDensity = signal<'compact' | 'normal' | 'expanded'>(
    ['compact', 'normal', 'expanded'].includes(
      localStorage.getItem('taskbolt_card_density') ?? '',
    )
      ? (localStorage.getItem('taskbolt_card_density') as
          | 'compact'
          | 'normal'
          | 'expanded')
      : 'normal',
  );
  readonly cardFields = signal<CardFields>(
    (() => {
      try {
        const stored = localStorage.getItem('taskbolt_card_fields');
        if (stored) return { ...DEFAULT_CARD_FIELDS, ...JSON.parse(stored) };
      } catch {
        /* ignore */
      }
      return DEFAULT_CARD_FIELDS;
    })(),
  );
  readonly colorBy = signal<ColorByMode>(
    (() => {
      const stored = localStorage.getItem('taskbolt_color_by');
      return COLOR_BY_MODES.includes(stored as ColorByMode)
        ? (stored as ColorByMode)
        : 'priority';
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

  readonly hasActiveFilters = computed(() => {
    const f = this.filters();
    return !!(
      f.search ||
      f.priorities.length > 0 ||
      f.assigneeIds.length > 0 ||
      f.labelIds.length > 0 ||
      f.dueDateStart ||
      f.dueDateEnd ||
      f.overdue
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
        .filter((t) => {
          const listId = t.task_list_id ?? t.group_id;
          return !listId || !collapsed.has(listId);
        });
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
    this.projectService.getBoardFull(boardId).subscribe({
      next: (response: ProjectFullResponse) => {
        this.board.set(response.project);
        this.projectService.setActiveProject(response.project);
        const cols = (
          (response.project?.statuses ?? []) as unknown as Column[]
        ).sort((a, b) => a.position.localeCompare(b.position));
        this.columns.set(cols);

        // Build transition map from statuses that have allowed_transitions
        const rawStatuses = response.project?.statuses ?? [];
        const tMap: Record<string, string[] | null> = {};
        for (const s of rawStatuses) {
          const ps = s as { id: string; allowed_transitions?: string[] | null };
          tMap[ps.id] = ps.allowed_transitions ?? null;
        }
        this.statusTransitions.set(tMap);

        const tasksByColumn: Record<string, Task[]> = {};
        for (const col of cols) {
          tasksByColumn[col.id] = [];
        }
        for (const t of response.tasks) {
          const bucketKey = t.status_id ?? t.column_id ?? '';
          const task: Task = {
            id: t.id,
            project_id: (t as unknown as { project_id?: string }).project_id ?? '',
            status_id: t.status_id ?? null,
            status_name: t.status_name ?? null,
            status_color: t.status_color ?? null,
            status_type: t.status_type ?? null,
            task_list_id: t.task_list_id ?? null,
            title: t.title,
            description: t.description,
            priority: t.priority as Task['priority'],
            position: t.position,
            milestone_id: t.milestone_id,
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
          if (!tasksByColumn[bucketKey]) {
            tasksByColumn[bucketKey] = [];
          }
          tasksByColumn[bucketKey].push(task);
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

        this.projectMembers.set(response.members);
        this.loading.set(false);

        this.wsService.send('subscribe', { channel: `project:${boardId}` });
      },
      error: () => {
        this.loading.set(false);
        this.showError('Failed to load board');
      },
    });

    this.milestoneService.list(boardId).subscribe({
      next: (milestones) => this.boardMilestones.set(milestones),
      error: (err) => { console.error('Failed to load milestones:', err); },
    });
    this.taskGroupService.listGroupsWithStats(boardId).subscribe({
      next: (groups) => this.boardGroups.set(groups),
      error: (err) => { console.error('Failed to load task groups:', err); },
    });
  }

  loadMoreTasks(boardId: string): void {
    const offset = this.tasksLoaded();
    this.projectService.getBoardFull(boardId, { limit: 100, offset }).subscribe({
      next: (response: ProjectFullResponse) => {
        if (response.meta) {
          this.taskMeta.set(response.meta);
        }
        this.tasksLoaded.update((loaded) => loaded + response.tasks.length);

        this.boardState.update((state) => {
          const newState = { ...state };
          for (const t of response.tasks) {
            const task: Task = {
              id: t.id,
              project_id: (t as unknown as { project_id?: string }).project_id ?? '',
              status_id: t.status_id ?? null,
              status_name: t.status_name ?? null,
              status_color: t.status_color ?? null,
              status_type: t.status_type ?? null,
              task_list_id: t.task_list_id ?? null,
              title: t.title,
              description: t.description,
              priority: t.priority as Task['priority'],
              position: t.position,
              milestone_id: t.milestone_id,
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
            const bucketKey = t.status_id ?? t.column_id ?? '';
            if (!newState[bucketKey]) {
              newState[bucketKey] = [];
            }
            newState[bucketKey] = [...newState[bucketKey], task];
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
      error: (err) => { console.error('Failed to load Gantt data:', err); },
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
        `taskbolt_collapsed_columns_${boardId}`,
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
      `taskbolt_collapsed_columns_${boardId}`,
      JSON.stringify([...updated]),
    );
  }

  isColumnCollapsed(columnId: string): boolean {
    return this.collapsedColumnIds().has(columnId);
  }

  // === Card Density ===

  setCardDensity(density: 'compact' | 'normal' | 'expanded'): void {
    this.cardDensity.set(density);
    localStorage.setItem('taskbolt_card_density', density);
  }

  setColorBy(mode: ColorByMode): void {
    this.colorBy.set(mode);
    localStorage.setItem('taskbolt_color_by', mode);
  }

  // === Card Fields ===

  updateCardField(key: keyof CardFields, value: boolean): void {
    this.cardFields.update((f) => {
      const next = { ...f, [key]: value };
      localStorage.setItem('taskbolt_card_fields', JSON.stringify(next));
      return next;
    });
  }

  resetCardFields(): void {
    this.cardFields.set({ ...DEFAULT_CARD_FIELDS });
    localStorage.setItem(
      'taskbolt_card_fields',
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
