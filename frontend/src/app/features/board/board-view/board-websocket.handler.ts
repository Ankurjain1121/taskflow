import { Injectable, inject } from '@angular/core';
import { Task } from '../../../core/services/task.service';
import { Column } from '../../../core/services/board.service';
import { AuthService } from '../../../core/services/auth.service';
import { PresenceService } from '../../../core/services/presence.service';
import { ConflictNotificationService } from '../../../core/services/conflict-notification.service';
import { ProjectStateService } from './board-state.service';

/**
 * Handles incoming WebSocket board events from the backend.
 *
 * Backend sends events in two formats:
 * 1. Single event (backward compatible):
 *    { "type": "TaskCreated", "task": {...}, "origin_user_id": "..." }
 * 2. Batched events (optimized):
 *    { "events": [{...}, {...}], "timestamp": "2024-..." }
 *
 * The RxJS webSocket operator JSON-parses the frame, so all fields
 * are at the message root (NOT nested in a "payload" wrapper).
 */
@Injectable()
export class ProjectWebsocketHandler {
  private authService = inject(AuthService);
  private presenceService = inject(PresenceService);
  private conflictNotification = inject(ConflictNotificationService);
  private state = inject(ProjectStateService);

  handleMessage(message: Record<string, unknown>): void {
    // Check if this is a batched message
    if (Array.isArray(message['events'])) {
      // Process batched events
      const events = message['events'] as Record<string, unknown>[];
      for (const event of events) {
        this.processEvent(event);
      }
    } else {
      // Process single event (backward compatible)
      this.processEvent(message);
    }
  }

  private processEvent(message: Record<string, unknown>): void {
    const originUserId = message['origin_user_id'] as string | undefined;
    const currentUserId = this.authService.currentUser()?.id;

    // Skip own actions — the local optimistic update already applied
    if (originUserId && originUserId === currentUserId) {
      return;
    }

    switch (message['type']) {
      case 'TaskCreated':
        this.handleTaskCreated(message['task'] as Partial<Task>);
        break;
      case 'TaskUpdated': {
        const task = message['task'] as Partial<Task>;
        const changedFields = message['changed_fields'] as string[] | undefined;
        const originUserName = message['origin_user_name'] as
          | string
          | undefined;
        this.handleTaskUpdated(task);
        if (task?.id && changedFields && originUserName) {
          this.conflictNotification.checkConflict(
            task.id,
            changedFields,
            originUserName,
          );
        }
        break;
      }
      case 'TaskMoved':
        this.handleTaskMoved(
          message['task_id'] as string,
          message['column_id'] as string,
          message['position'] as string,
        );
        break;
      case 'TaskDeleted':
        this.handleTaskDeleted(message['task_id'] as string);
        break;
      case 'ColumnCreated':
        this.handleColumnCreated(message['column'] as Column);
        break;
      case 'ColumnUpdated':
        this.handleColumnUpdated(message['column'] as Partial<Column>);
        break;
      case 'ColumnDeleted':
        this.handleColumnDeleted(message['column_id'] as string);
        break;
      case 'PresenceUpdate':
        this.presenceService.updateViewers(
          (message['user_ids'] as string[]) || [],
        );
        break;
      case 'TaskLocked':
        this.presenceService.setTaskLock(message['task_id'] as string, {
          user_id: message['user_id'] as string,
          user_name: message['user_name'] as string,
        });
        this.presenceService.updateViewerName(
          message['user_id'] as string,
          message['user_name'] as string,
        );
        break;
      case 'TaskUnlocked':
        this.presenceService.removeTaskLock(message['task_id'] as string);
        break;
    }
  }

  private handleTaskCreated(broadcast: Partial<Task>): void {
    if (!broadcast?.id || !(broadcast?.status_id ?? broadcast?.column_id)) return;

    this.state.boardState.update((state) => {
      const newState = { ...state };
      const bucketKey = broadcast.status_id ?? broadcast.column_id ?? '';
      const columnTasks = newState[bucketKey] || [];

      // Avoid duplicates (e.g. if we already inserted optimistically)
      if (columnTasks.some((t) => t.id === broadcast.id)) return state;

      // Build a minimal Task from the broadcast fields
      const task: Task = {
        id: broadcast.id!,
        project_id:
          broadcast.project_id ??
          (broadcast as Record<string, unknown>)['board_id'] as string ??
          '',
        status_id: broadcast.status_id ?? broadcast.column_id ?? null,
        title: broadcast.title ?? '',
        description: null,
        priority: broadcast.priority ?? 'medium',
        position: broadcast.position ?? 'zzzzzz',
        milestone_id: null,
        due_date: null,
        created_by: '',
        created_at: new Date().toISOString(),
        updated_at: broadcast.updated_at ?? new Date().toISOString(),
        assignees: [],
        labels: [],
      };

      newState[bucketKey] = [...columnTasks, task].sort((a, b) =>
        a.position.localeCompare(b.position),
      );
      return newState;
    });
  }

  private handleTaskUpdated(broadcast: Partial<Task>): void {
    if (!broadcast?.id) return;

    this.state.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      for (const [columnId, tasks] of Object.entries(state)) {
        newState[columnId] = tasks.map((t) => {
          if (t.id !== broadcast.id) return t;
          // MERGE: only overwrite fields present in the broadcast, preserve the rest
          return { ...t, ...broadcast };
        });
      }
      return newState;
    });
  }

  private handleTaskMoved(
    taskId: string,
    targetColumnId: string,
    position: string,
  ): void {
    if (!taskId || !targetColumnId) return;

    this.state.boardState.update((state) => {
      const newState = { ...state };
      let movedTask: Task | undefined;

      // Remove from all columns
      for (const [columnId, tasks] of Object.entries(newState)) {
        const found = tasks.find((t) => t.id === taskId);
        if (found) movedTask = found;
        newState[columnId] = tasks.filter((t) => t.id !== taskId);
      }

      if (!movedTask) return state;

      // Insert into target column with updated position
      const updated = { ...movedTask, status_id: targetColumnId, position };
      const columnTasks = newState[targetColumnId] || [];
      newState[targetColumnId] = [...columnTasks, updated].sort((a, b) =>
        a.position.localeCompare(b.position),
      );

      return newState;
    });
  }

  private handleTaskDeleted(taskId: string): void {
    if (!taskId) return;

    this.state.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      for (const [columnId, tasks] of Object.entries(state)) {
        newState[columnId] = tasks.filter((t) => t.id !== taskId);
      }
      return newState;
    });
  }

  private handleColumnCreated(column: Column): void {
    if (!column?.id) return;

    // Add column if not already present
    this.state.columns.update((cols) => {
      if (cols.some((c) => c.id === column.id)) return cols;
      return [...cols, column].sort((a, b) =>
        a.position.localeCompare(b.position),
      );
    });
    this.state.boardState.update((state) => {
      if (state[column.id]) return state;
      return { ...state, [column.id]: [] };
    });
  }

  private handleColumnUpdated(broadcast: Partial<Column>): void {
    if (!broadcast?.id) return;

    this.state.columns.update((cols) =>
      cols
        .map((c) => (c.id === broadcast.id ? { ...c, ...broadcast } : c))
        .sort((a, b) => a.position.localeCompare(b.position)),
    );
  }

  private handleColumnDeleted(columnId: string): void {
    if (!columnId) return;

    this.state.columns.update((cols) => cols.filter((c) => c.id !== columnId));
    this.state.boardState.update((state) => {
      const newState = { ...state };
      delete newState[columnId];
      return newState;
    });
  }
}
