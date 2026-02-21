import { Injectable, inject } from '@angular/core';
import { TaskService, BulkUpdateRequest } from '../../../core/services/task.service';
import { BulkAction } from '../bulk-actions/bulk-actions-bar.component';

@Injectable()
export class BoardBulkActionsService {
  private taskService = inject(TaskService);

  executeBulkAction(
    boardId: string,
    action: BulkAction,
    taskIds: string[],
    callbacks: {
      onSuccess: () => void;
      onError: (message: string) => void;
    },
  ): void {
    if (taskIds.length === 0) return;

    if (action.type === 'delete') {
      this.taskService.bulkDelete(boardId, { task_ids: taskIds }).subscribe({
        next: () => callbacks.onSuccess(),
        error: () => callbacks.onError('Failed to delete tasks'),
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

    this.taskService.bulkUpdate(boardId, req).subscribe({
      next: () => callbacks.onSuccess(),
      error: () => callbacks.onError('Failed to update tasks'),
    });
  }
}
