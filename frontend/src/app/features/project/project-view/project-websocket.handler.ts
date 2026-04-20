import { Injectable, inject } from '@angular/core';
import { Task } from '../../../core/services/task.service';
import { Column } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { PresenceService } from '../../../core/services/presence.service';
import { ConflictNotificationService } from '../../../core/services/conflict-notification.service';
import { ProjectStateService } from './project-state.service';
import type { WsBoardEvent } from '../../../shared/types/WsBoardEvent';
import type { TaskBroadcast } from '../../../shared/types/TaskBroadcast';
import type { ColumnBroadcast } from '../../../shared/types/ColumnBroadcast';

/**
 * Handles incoming WebSocket board events from the backend.
 *
 * Types are generated from Rust via ts-rs (see WsBoardEvent).
 * Regenerate with: ./scripts/export-types.sh
 *
 * Backend sends events in two formats:
 * 1. Single event: { "type": "TaskCreated", "task": {...}, ... }
 * 2. Batched: { "events": [{...}, {...}], "timestamp": "..." }
 */
@Injectable()
export class ProjectWebsocketHandler {
  private authService = inject(AuthService);
  private presenceService = inject(PresenceService);
  private conflictNotification = inject(ConflictNotificationService);
  private state = inject(ProjectStateService);

  handleMessage(message: Record<string, unknown>): void {
    if (Array.isArray(message['events'])) {
      const events = message['events'] as WsBoardEvent[];
      for (const event of events) {
        this.processEvent(event);
      }
    } else {
      this.processEvent(message as WsBoardEvent);
    }
  }

  private processEvent(event: WsBoardEvent): void {
    const originUserId = 'origin_user_id' in event ? event.origin_user_id : undefined;
    const currentUserId = this.authService.currentUser()?.id;

    if (originUserId && originUserId === currentUserId) {
      return;
    }

    switch (event.type) {
      case 'TaskCreated':
        this.handleTaskCreated(event.task);
        break;
      case 'TaskUpdated': {
        const { task } = event;
        this.handleTaskUpdated(task);
        if (task.id && task.changed_fields && task.origin_user_name) {
          this.conflictNotification.checkConflict(
            task.id,
            task.changed_fields,
            task.origin_user_name,
          );
        }
        break;
      }
      case 'TaskMoved':
        this.handleTaskMoved(
          event.task_id,
          event.status_id,
          event.position,
        );
        break;
      case 'TaskBulkMoved':
        this.handleTaskBulkMoved(event.task_ids, event.status_id);
        break;
      case 'TaskDeleted':
        this.handleTaskDeleted(event.task_id);
        break;
      case 'ColumnCreated':
        this.handleColumnCreated(event.column);
        break;
      case 'ColumnUpdated':
        this.handleColumnUpdated(event.column);
        break;
      case 'ColumnDeleted':
        this.handleColumnDeleted(event.column_id);
        break;
      case 'PresenceUpdate':
        this.presenceService.updateViewers(event.user_ids || []);
        break;
      case 'TaskLocked':
        this.presenceService.setTaskLock(event.task_id, {
          user_id: event.user_id,
          user_name: event.user_name,
        });
        this.presenceService.updateViewerName(
          event.user_id,
          event.user_name,
        );
        break;
      case 'TaskUnlocked':
        this.presenceService.removeTaskLock(event.task_id);
        break;
    }
  }

  private handleTaskCreated(broadcast: TaskBroadcast): void {
    if (!broadcast.id || !broadcast.status_id) return;

    this.state.boardState.update((state) => {
      const newState = { ...state };
      const bucketKey = broadcast.status_id ?? '';
      const columnTasks = newState[bucketKey] || [];

      if (columnTasks.some((t) => t.id === broadcast.id)) return state;

      const task: Task = {
        id: broadcast.id,
        project_id: '',
        status_id: broadcast.status_id,
        title: broadcast.title,
        description: null,
        priority: broadcast.priority,
        position: broadcast.position,
        milestone_id: null,
        due_date: null,
        created_by: '',
        created_at: new Date().toISOString(),
        updated_at: broadcast.updated_at,
        assignees: [],
        labels: [],
      };

      newState[bucketKey] = [...columnTasks, task].sort((a, b) =>
        a.position.localeCompare(b.position),
      );
      return newState;
    });
  }

  private handleTaskUpdated(broadcast: TaskBroadcast): void {
    if (!broadcast.id) return;

    this.state.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      for (const [columnId, tasks] of Object.entries(state)) {
        newState[columnId] = tasks.map((t) => {
          if (t.id !== broadcast.id) return t;
          return {
            ...t,
            title: broadcast.title,
            priority: broadcast.priority,
            status_id: broadcast.status_id,
            position: broadcast.position,
            updated_at: broadcast.updated_at,
          };
        });
      }
      return newState;
    });
  }

  private handleTaskMoved(
    taskId: string,
    targetColumnId: string | null,
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

  private handleTaskBulkMoved(taskIds: string[], targetColumnId: string): void {
    if (!taskIds.length || !targetColumnId) return;

    const idSet = new Set(taskIds);
    this.state.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      const moved: Task[] = [];

      // Collect + strip moved tasks from all columns
      for (const [columnId, tasks] of Object.entries(state)) {
        const keep: Task[] = [];
        for (const t of tasks) {
          if (idSet.has(t.id)) moved.push(t);
          else keep.push(t);
        }
        newState[columnId] = keep;
      }

      if (!moved.length) return state;

      const updatedMoved = moved.map((t) => ({
        ...t,
        status_id: targetColumnId,
      }));
      const existing = newState[targetColumnId] ?? [];
      newState[targetColumnId] = [...existing, ...updatedMoved].sort((a, b) =>
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

  private handleColumnCreated(broadcast: ColumnBroadcast): void {
    if (!broadcast.id) return;

    const column: Column = {
      id: broadcast.id,
      name: broadcast.name,
      position: broadcast.position,
      color: broadcast.color,
      status_mapping: null,
      wip_limit: null,
      created_at: new Date().toISOString(),
    };

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

  private handleColumnUpdated(broadcast: ColumnBroadcast): void {
    if (!broadcast.id) return;

    this.state.columns.update((cols) =>
      cols
        .map((c) =>
          c.id === broadcast.id
            ? { ...c, name: broadcast.name, position: broadcast.position, color: broadcast.color }
            : c,
        )
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
