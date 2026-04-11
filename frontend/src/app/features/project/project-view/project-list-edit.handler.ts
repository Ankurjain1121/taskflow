import { inject, Injectable } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { generateKeyBetween } from 'fractional-indexing';

import {
  TaskService,
  TaskListItem,
  UpdateTaskRequest,
} from '../../../core/services/task.service';
import { ProjectStateService } from './project-state.service';

export type CreateDirection = 'above' | 'below';

@Injectable()
export class ProjectListEditHandler {
  private readonly taskService = inject(TaskService);
  private readonly state = inject(ProjectStateService);

  /** IDs of optimistic tasks created via Ctrl+Shift+Up/Down that haven't been named yet. */
  private readonly pendingNewTaskIds = new Set<string>();

  /** Temp ids whose inline-edit was cancelled before the server create call returned. */
  private readonly cancelledBeforeResponse = new Set<string>();

  /**
   * Maps the optimistic temp id shown in the UI to the real server-assigned task id.
   * We keep the UI showing the temp id so that inline-edit state doesn't reset when
   * the create API returns, and translate to the real id only when we hit the backend
   * (update / delete / move).
   */
  private readonly tempToRealId = new Map<string, string>();

  private resolveRealId(taskId: string): string {
    return this.tempToRealId.get(taskId) ?? taskId;
  }

  /**
   * Create an empty task above or below the given focused task using a fractional
   * index between the focused task and its neighbor. Returns the temp id of the
   * optimistic row so the caller can open it in inline edit mode, or null if the
   * focused task cannot be found.
   */
  createTaskRelative(
    focusedTaskId: string,
    direction: CreateDirection,
    boardId: string,
    destroy$: Subject<void>,
  ): string | null {
    const all = this.state.flatTasks();
    const focused = all.find((t) => t.id === focusedTaskId);
    if (!focused) return null;

    // Siblings share the same task_list_id and parent grouping.
    const siblings = all
      .filter((t) => t.task_list_id === focused.task_list_id)
      .slice()
      .sort((a, b) => a.position.localeCompare(b.position));

    const idx = siblings.findIndex((t) => t.id === focusedTaskId);
    if (idx === -1) return null;

    let prev: TaskListItem | null;
    let next: TaskListItem | null;
    if (direction === 'above') {
      prev = idx > 0 ? siblings[idx - 1] : null;
      next = focused;
    } else {
      prev = focused;
      next = idx < siblings.length - 1 ? siblings[idx + 1] : null;
    }

    let newPosition: string;
    try {
      newPosition = generateKeyBetween(
        prev?.position ?? null,
        next?.position ?? null,
      );
    } catch {
      // Shouldn't happen with valid fractional positions, but fall back safely.
      newPosition = (prev?.position ?? 'a0') + 'a';
    }

    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const placeholder: TaskListItem = {
      id: tempId,
      title: '',
      description: null,
      priority: focused.priority,
      due_date: null,
      status_id: focused.status_id,
      status_name: focused.status_name,
      status_color: focused.status_color,
      status_type: focused.status_type,
      task_list_id: focused.task_list_id,
      task_list_name: focused.task_list_name,
      position: newPosition,
      created_by_id: '',
      created_at: now,
      updated_at: now,
    };

    this.pendingNewTaskIds.add(tempId);
    this.state.flatTasks.update((tasks) => [...tasks, placeholder]);

    const createReq = {
      title: 'New task',
      priority: focused.priority,
      status_id: focused.status_id ?? undefined,
      task_list_id: focused.task_list_id ?? undefined,
    };

    this.taskService
      .createTask(boardId, createReq)
      .pipe(takeUntil(destroy$))
      .subscribe({
        next: (realTask) => {
          // If the user cancelled before the server responded, delete the orphan.
          if (this.cancelledBeforeResponse.has(tempId)) {
            this.cancelledBeforeResponse.delete(tempId);
            this.taskService
              .deleteTask(realTask.id)
              .pipe(takeUntil(destroy$))
              .subscribe({ error: () => {} });
            return;
          }

          // Keep tempId in the UI (so inline-edit state survives); map it to the real id
          // so subsequent PATCH/DELETE/move calls hit the right server row.
          this.tempToRealId.set(tempId, realTask.id);

          // Mirror server metadata onto the temp row but keep the temp id.
          this.state.flatTasks.update((tasks) =>
            tasks.map((t) =>
              t.id === tempId
                ? {
                    ...t,
                    created_by_id: realTask.created_by ?? t.created_by_id,
                    created_at: realTask.created_at,
                    updated_at: realTask.updated_at,
                  }
                : t,
            ),
          );

          // Apply the fractional position server-side.
          if (realTask.status_id) {
            this.taskService
              .moveTask(realTask.id, {
                status_id: realTask.status_id,
                position: newPosition,
              })
              .pipe(takeUntil(destroy$))
              .subscribe({
                error: () => {
                  this.state.showError(
                    'Task created but position could not be saved',
                  );
                },
              });
          }
        },
        error: () => {
          // Roll back the optimistic insert.
          this.pendingNewTaskIds.delete(tempId);
          this.state.flatTasks.update((tasks) =>
            tasks.filter((t) => t.id !== tempId),
          );
          this.state.showError('Failed to create task');
        },
      });

    return tempId;
  }

  /**
   * Called when inline-edit is cancelled (Esc / blur with empty title).
   * If the task id belongs to a freshly-created pending task, delete it.
   */
  onInlineEditCancelled(
    taskId: string,
    boardId: string,
    destroy$: Subject<void>,
  ): void {
    if (!this.pendingNewTaskIds.has(taskId)) return;
    this.pendingNewTaskIds.delete(taskId);

    const realId = this.tempToRealId.get(taskId);
    this.tempToRealId.delete(taskId);

    this.state.flatTasks.update((tasks) =>
      tasks.filter((t) => t.id !== taskId),
    );

    if (realId) {
      // Server has already issued a real id — delete the server row.
      this.taskService
        .deleteTask(realId)
        .pipe(takeUntil(destroy$))
        .subscribe({
          error: () => {
            this.state.loadFlatTasks(boardId, destroy$);
          },
        });
    } else {
      // Create request is still in flight — mark for deletion on arrival.
      this.cancelledBeforeResponse.add(taskId);
    }
  }

  /** Mark a task id as "settled" — called after the user names the task successfully. */
  clearPending(taskId: string): void {
    this.pendingNewTaskIds.delete(taskId);
  }

  onTitleChanged(
    event: { taskId: string; title: string },
    boardId: string,
    destroy$: Subject<void>,
  ): void {
    // Title was successfully set — no longer a pending new task.
    this.pendingNewTaskIds.delete(event.taskId);
    this.updateFlatTask(event.taskId, { title: event.title }, boardId, destroy$);
  }

  onPriorityChanged(
    event: { taskId: string; priority: string },
    boardId: string,
    destroy$: Subject<void>,
  ): void {
    this.updateFlatTask(
      event.taskId,
      { priority: event.priority as UpdateTaskRequest['priority'] },
      boardId,
      destroy$,
    );
  }

  onStatusChanged(
    event: { taskId: string; statusId: string },
    boardId: string,
    destroy$: Subject<void>,
  ): void {
    const targetColumn = this.state
      .columns()
      .find((c) => c.id === event.statusId);
    if (targetColumn) {
      this.state.flatTasks.update((tasks) =>
        tasks.map((t) =>
          t.id === event.taskId
            ? {
                ...t,
                status_id: event.statusId,
                status_name: targetColumn.name,
                status_color: targetColumn.color,
              }
            : t,
        ),
      );
    }

    this.taskService
      .moveTask(this.resolveRealId(event.taskId), {
        status_id: event.statusId,
        position: 'bottom',
      })
      .pipe(takeUntil(destroy$))
      .subscribe({
        error: () => {
          this.state.showError('Failed to move task');
          this.state.loadFlatTasks(boardId, destroy$);
        },
      });
  }

  onDueDateChanged(
    event: { taskId: string; dueDate: string | null },
    boardId: string,
    destroy$: Subject<void>,
  ): void {
    const req: UpdateTaskRequest = event.dueDate
      ? { due_date: event.dueDate }
      : { clear_due_date: true };
    this.updateFlatTask(event.taskId, req, boardId, destroy$);
  }

  private updateFlatTask(
    taskId: string,
    req: UpdateTaskRequest,
    boardId: string,
    destroy$: Subject<void>,
  ): void {
    this.state.flatTasks.update((tasks) =>
      tasks.map((t) => (t.id === taskId ? { ...t, ...req } : t)),
    );

    this.taskService
      .updateTask(this.resolveRealId(taskId), req)
      .pipe(takeUntil(destroy$))
      .subscribe({
        next: (updatedTask) => {
          this.state.flatTasks.update((tasks) =>
            tasks.map((t) =>
              t.id === taskId ? { ...t, ...updatedTask, id: t.id } : t,
            ),
          );
        },
        error: () => {
          this.state.showError('Failed to update task');
          this.state.loadFlatTasks(boardId, destroy$);
        },
      });
  }
}
