import { Injectable, inject } from '@angular/core';
import {
  TaskService,
  Task,
  BulkUpdateRequest,
} from '../../../core/services/task.service';
import { BulkAction } from '../bulk-actions/bulk-actions-bar.component';
import { BoardStateService } from './board-state.service';

@Injectable()
export class BoardBulkActionsService {
  private taskService = inject(TaskService);
  private state = inject(BoardStateService);

  executeBulkAction(
    projectId: string,
    action: BulkAction,
    taskIds: string[],
    callbacks: {
      onSuccess: () => void;
      onError: (message: string) => void;
    },
  ): void {
    if (taskIds.length === 0) return;

    const snapshot = structuredClone(this.state.boardState());

    if (action.type === 'delete') {
      // Optimistically remove all matching tasks
      this.state.boardState.update((state) => {
        const newState: Record<string, Task[]> = {};
        const idSet = new Set(taskIds);
        for (const [colId, tasks] of Object.entries(state)) {
          newState[colId] = tasks.filter((t) => !idSet.has(t.id));
        }
        return newState;
      });

      this.taskService.bulkDelete(projectId, { task_ids: taskIds }).subscribe({
        next: () => callbacks.onSuccess(),
        error: () => {
          this.state.boardState.set(snapshot);
          callbacks.onError('Failed to delete tasks');
        },
      });
      return;
    }

    const req: BulkUpdateRequest = { task_ids: taskIds };
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

    // Optimistically apply bulk updates to board state
    this.state.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      const idSet = new Set(taskIds);

      if (action.type === 'move' && action.column_id) {
        // Move tasks to target column
        const targetColId = action.column_id;
        const movedTasks: Task[] = [];
        for (const [colId, tasks] of Object.entries(state)) {
          const staying = tasks.filter((t) => !idSet.has(t.id));
          const moving = tasks.filter((t) => idSet.has(t.id));
          movedTasks.push(
            ...moving.map((t) => ({ ...t, column_id: targetColId })),
          );
          newState[colId] = staying;
        }
        newState[targetColId] = [
          ...(newState[targetColId] || []),
          ...movedTasks,
        ];
      } else {
        // Apply field updates (priority, milestone, group)
        const fieldUpdates: Partial<Task> = {};
        if (action.type === 'priority' && action.priority) {
          fieldUpdates.priority = action.priority as Task['priority'];
        }
        if (action.type === 'milestone') {
          fieldUpdates.milestone_id = action.clear_milestone
            ? null
            : (action.milestone_id ?? null);
        }
        if (action.type === 'group') {
          fieldUpdates.group_id = action.clear_group
            ? null
            : (action.group_id ?? null);
        }
        for (const [colId, tasks] of Object.entries(state)) {
          newState[colId] = tasks.map((t) =>
            idSet.has(t.id) ? { ...t, ...fieldUpdates } : t,
          );
        }
      }
      return newState;
    });

    this.taskService.bulkUpdate(projectId, req).subscribe({
      next: () => callbacks.onSuccess(),
      error: () => {
        this.state.boardState.set(snapshot);
        callbacks.onError('Failed to update tasks');
      },
    });
  }
}
