import { Injectable, WritableSignal, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { generateKeyBetween } from 'fractional-indexing';

import { ProjectService, Column } from '../../../core/services/project.service';
import {
  TaskService,
  Task,
  Assignee,
  Label,
  UpdateTaskRequest,
} from '../../../core/services/task.service';
import {
  TaskGroupService,
  TaskGroupWithStats,
} from '../../../core/services/task-group.service';
import { RecurringService } from '../../../core/services/recurring.service';
import { SaveStatusService } from '../../../core/services/save-status.service';
import { CreateTaskDialogResult } from './create-task-dialog.component';
import { CreateColumnDialogResult } from './create-column-dialog.component';

export interface MutationContext {
  boardState: WritableSignal<Record<string, Task[]>>;
  columns: WritableSignal<Column[]>;
  projectMembers: WritableSignal<
    import('../../../core/services/project.service').ProjectMember[]
  >;
  boardGroups: WritableSignal<TaskGroupWithStats[]>;
  allLabels: () => Label[];
  showError: (message: string) => void;
  reloadGroups: (boardId: string) => void;
  loadBoard: (boardId: string, destroy$: Subject<void>) => void;
}

@Injectable()
export class ProjectMutationsService {
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private taskGroupService = inject(TaskGroupService);
  private recurringService = inject(RecurringService);
  private saveStatus = inject(SaveStatusService);

  private ctx!: MutationContext;

  init(ctx: MutationContext): void {
    this.ctx = ctx;
  }

  // === Task CRUD ===

  createTask(
    boardId: string,
    columnId: string,
    taskData: CreateTaskDialogResult,
  ): void {
    const snapshot = structuredClone(this.ctx.boardState());

    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const tempTask: Task = {
      id: tempId,
      project_id: boardId,
      status_id: columnId,
      task_list_id: null,
      title: taskData.title,
      description: taskData.description ?? null,
      priority: (taskData.priority as Task['priority']) ?? 'medium',
      position: 'zzzzzz',
      milestone_id: null,
      due_date: taskData.due_date ?? null,
      created_by: '',
      created_at: now,
      updated_at: now,
      assignees: [],
      labels: [],
    };

    this.ctx.boardState.update((state) => {
      const newState = { ...state };
      const columnTasks = newState[columnId] || [];
      newState[columnId] = [...columnTasks, tempTask];
      return newState;
    });

    this.saveStatus.markSaving();
    this.taskService
      .createTask(boardId, {
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        status_id: columnId,
        due_date: taskData.due_date,
        start_date: taskData.start_date,
        estimated_hours: taskData.estimated_hours,
        assignee_ids: taskData.assignee_ids,
        reporting_person_id: taskData.reporting_person_id,
      })
      .subscribe({
        next: (realTask) => {
          this.saveStatus.markSaved();
          this.ctx.boardState.update((state) => {
            const newState = { ...state };
            const columnTasks = newState[columnId] || [];
            newState[columnId] = columnTasks
              .map((t) => (t.id === tempId ? realTask : t))
              .sort((a, b) => a.position.localeCompare(b.position));
            return newState;
          });

          // Post-create: set up recurring config
          if (taskData.is_recurring && taskData.recurrence_pattern) {
            this.recurringService
              .createConfig(realTask.id, {
                pattern: taskData.recurrence_pattern,
              })
              .subscribe({
                error: () =>
                  this.ctx.showError(
                    'Task created but recurring schedule could not be set',
                  ),
              });
          }

          // Post-create: add watchers
          if (taskData.watcher_ids?.length) {
            for (const userId of taskData.watcher_ids) {
              this.taskService.addWatcher(realTask.id, userId).subscribe({
                error: () =>
                  this.ctx.showError(
                    'Task created but watchers could not be added',
                  ),
              });
            }
          }
        },
        error: () => {
          this.saveStatus.markError();
          this.ctx.boardState.set(snapshot);
          this.ctx.showError('Failed to create task');
        },
      });
  }

  updateTaskInState(task: Task): void {
    this.ctx.boardState.update((state) => {
      const newState = { ...state };
      const columnTasks = newState[task.status_id ?? ''];
      if (columnTasks) {
        newState[task.status_id ?? ''] = columnTasks.map((t) =>
          t.id === task.id ? task : t,
        );
      }
      return newState;
    });
  }

  optimisticUpdateTask(
    taskId: string,
    updates: Partial<Task>,
    serverUpdates?: Record<string, unknown>,
  ): void {
    const snapshot = structuredClone(this.ctx.boardState());

    this.ctx.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      for (const [columnId, tasks] of Object.entries(state)) {
        newState[columnId] = tasks.map((t) =>
          t.id === taskId ? { ...t, ...updates } : t,
        );
      }
      return newState;
    });

    this.saveStatus.markSaving();
    const req = serverUpdates ?? (updates as Record<string, unknown>);
    this.taskService.updateTask(taskId, req as UpdateTaskRequest).subscribe({
      next: (updatedTask) => {
        this.saveStatus.markSaved();
        this.ctx.boardState.update((state) => {
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
        this.saveStatus.markError();
        this.ctx.boardState.set(snapshot);
        this.ctx.showError('Failed to update task. Reverted.');
      },
    });
  }

  optimisticAssignUser(taskId: string, userId: string): void {
    const snapshot = structuredClone(this.ctx.boardState());
    const member = this.ctx.projectMembers().find((m) => m.user_id === userId);
    this.ctx.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      for (const [colId, tasks] of Object.entries(state)) {
        newState[colId] = tasks.map((t) => {
          if (t.id !== taskId) return t;
          const existing = t.assignees ?? [];
          if (existing.some((a) => a.id === userId)) return t;
          const newAssignee: Assignee = {
            id: userId,
            display_name: member?.name ?? 'Unknown',
            avatar_url: member?.avatar_url ?? null,
          };
          return { ...t, assignees: [...existing, newAssignee] };
        });
      }
      return newState;
    });
    this.saveStatus.markSaving();
    this.taskService.assignUser(taskId, userId).subscribe({
      next: () => this.saveStatus.markSaved(),
      error: () => {
        this.saveStatus.markError();
        this.ctx.boardState.set(snapshot);
        this.ctx.showError('Failed to assign user. Reverted.');
      },
    });
  }

  optimisticUnassignUser(taskId: string, userId: string): void {
    const snapshot = structuredClone(this.ctx.boardState());
    this.ctx.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      for (const [colId, tasks] of Object.entries(state)) {
        newState[colId] = tasks.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            assignees: (t.assignees ?? []).filter((a) => a.id !== userId),
          };
        });
      }
      return newState;
    });
    this.saveStatus.markSaving();
    this.taskService.unassignUser(taskId, userId).subscribe({
      next: () => this.saveStatus.markSaved(),
      error: () => {
        this.saveStatus.markError();
        this.ctx.boardState.set(snapshot);
        this.ctx.showError('Failed to unassign user. Reverted.');
      },
    });
  }

  optimisticAddLabel(taskId: string, labelId: string): void {
    const snapshot = structuredClone(this.ctx.boardState());
    const label = this.ctx.allLabels().find((l) => l.id === labelId);
    if (!label) return;
    this.ctx.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      for (const [colId, tasks] of Object.entries(state)) {
        newState[colId] = tasks.map((t) => {
          if (t.id !== taskId) return t;
          const existing = t.labels ?? [];
          if (existing.some((l) => l.id === labelId)) return t;
          return { ...t, labels: [...existing, label] };
        });
      }
      return newState;
    });
    this.saveStatus.markSaving();
    this.taskService.addLabel(taskId, labelId).subscribe({
      next: () => this.saveStatus.markSaved(),
      error: () => {
        this.saveStatus.markError();
        this.ctx.boardState.set(snapshot);
        this.ctx.showError('Failed to add label. Reverted.');
      },
    });
  }

  optimisticRemoveLabel(taskId: string, labelId: string): void {
    const snapshot = structuredClone(this.ctx.boardState());
    this.ctx.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      for (const [colId, tasks] of Object.entries(state)) {
        newState[colId] = tasks.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            labels: (t.labels ?? []).filter((l) => l.id !== labelId),
          };
        });
      }
      return newState;
    });
    this.saveStatus.markSaving();
    this.taskService.removeLabel(taskId, labelId).subscribe({
      next: () => this.saveStatus.markSaved(),
      error: () => {
        this.saveStatus.markError();
        this.ctx.boardState.set(snapshot);
        this.ctx.showError('Failed to remove label. Reverted.');
      },
    });
  }

  deleteTask(taskId: string): void {
    const snapshot = structuredClone(this.ctx.boardState());

    this.ctx.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      for (const [colId, tasks] of Object.entries(state)) {
        newState[colId] = tasks.filter((t) => t.id !== taskId);
      }
      return newState;
    });

    this.saveStatus.markSaving();
    this.taskService.deleteTask(taskId).subscribe({
      next: () => this.saveStatus.markSaved(),
      error: () => {
        this.saveStatus.markError();
        this.ctx.boardState.set(snapshot);
        this.ctx.showError('Failed to delete task. Reverted.');
      },
    });
  }

  // === Column Operations ===

  createColumn(boardId: string, columnData: CreateColumnDialogResult): void {
    const colSnapshot = structuredClone(this.ctx.columns());
    const stateSnapshot = structuredClone(this.ctx.boardState());

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

    this.ctx.columns.update((cols) => [...cols, tempColumn]);
    this.ctx.boardState.update((state) => ({ ...state, [tempId]: [] }));

    this.saveStatus.markSaving();
    this.projectService
      .createColumn(boardId, {
        name: columnData.name,
        color: columnData.color,
        status_mapping: columnData.isDone ? { done: true } : undefined,
      })
      .subscribe({
        next: (realColumn) => {
          this.saveStatus.markSaved();
          this.ctx.columns.update((cols) =>
            cols
              .map((c) => (c.id === tempId ? realColumn : c))
              .sort((a, b) => a.position.localeCompare(b.position)),
          );
          this.ctx.boardState.update((state) => {
            const newState = { ...state };
            const tempTasks = newState[tempId] || [];
            delete newState[tempId];
            newState[realColumn.id] = tempTasks;
            return newState;
          });
        },
        error: () => {
          this.saveStatus.markError();
          this.ctx.columns.set(colSnapshot);
          this.ctx.boardState.set(stateSnapshot);
          this.ctx.showError('Failed to create column');
        },
      });
  }

  reorderColumn(prevIdx: number, currIdx: number): void {
    const snapshot = structuredClone(this.ctx.columns());

    const cols = [...snapshot];
    const [removed] = cols.splice(prevIdx, 1);
    cols.splice(currIdx, 0, removed);
    this.ctx.columns.set(cols);

    const movedColumn = cols[currIdx];
    this.projectService
      .reorderColumn(movedColumn.id, { new_index: currIdx })
      .subscribe({
        error: () => {
          this.ctx.columns.set(snapshot);
          this.ctx.showError('Failed to reorder column');
        },
      });
  }

  deleteColumn(boardId: string, columnId: string): void {
    const colSnapshot = structuredClone(this.ctx.columns());
    const stateSnapshot = structuredClone(this.ctx.boardState());

    this.ctx.columns.update((cols) => cols.filter((c) => c.id !== columnId));
    this.ctx.boardState.update((state) => {
      const newState = { ...state };
      delete newState[columnId];
      return newState;
    });

    this.projectService.deleteColumn(columnId).subscribe({
      error: () => {
        this.ctx.columns.set(colSnapshot);
        this.ctx.boardState.set(stateSnapshot);
        this.ctx.showError('Failed to delete column. Reverted.');
      },
    });
  }

  // === Task Group Operations ===

  createGroup(boardId: string, result: { name: string; color: string }): void {
    const groups = this.ctx.boardGroups();
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
        next: () => this.ctx.reloadGroups(boardId),
        error: () => this.ctx.showError('Failed to create group'),
      });
  }

  updateGroupName(boardId: string, groupId: string, name: string): void {
    this.taskGroupService.updateGroup(groupId, { name }).subscribe({
      next: () => this.ctx.reloadGroups(boardId),
      error: () => this.ctx.showError('Failed to rename group'),
    });
  }

  updateGroupColor(boardId: string, groupId: string, color: string): void {
    this.taskGroupService.updateGroup(groupId, { color }).subscribe({
      next: () => this.ctx.reloadGroups(boardId),
      error: () => this.ctx.showError('Failed to update group color'),
    });
  }

  toggleGroupCollapse(group: TaskGroupWithStats): void {
    const newCollapsed = !group.group.collapsed;

    this.ctx.boardGroups.update((groups) =>
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
          this.ctx.boardGroups.update((groups) =>
            groups.map((g) =>
              g.group.id === group.group.id
                ? { ...g, group: { ...g.group, collapsed: !newCollapsed } }
                : g,
            ),
          );
          this.ctx.showError('Failed to toggle group');
        },
      });
  }

  deleteGroup(boardId: string, groupId: string): void {
    this.taskGroupService.deleteGroup(groupId).subscribe({
      next: () => {
        this.ctx.reloadGroups(boardId);
        this.ctx.loadBoard(boardId, new Subject<void>());
      },
      error: () => this.ctx.showError('Failed to delete group'),
    });
  }
}
