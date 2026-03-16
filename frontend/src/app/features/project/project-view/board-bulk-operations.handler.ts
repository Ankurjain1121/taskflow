import { Injectable, inject, signal, viewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { Task } from '../../../core/services/task.service';
import { BulkOperationsService } from '../../../core/services/bulk-operations.service';
import { BulkAction } from '../bulk-actions/bulk-actions-bar.component';
import { BulkPreviewData } from '../bulk-operations/bulk-preview-dialog.component';
import { ProjectBulkActionsService } from './board-bulk-actions.service';
import { ProjectStateService } from './board-state.service';

@Injectable()
export class ProjectBulkOperationsHandler {
  private bulkActionsService = inject(ProjectBulkActionsService);
  private bulkOpsService = inject(BulkOperationsService);
  private state = inject(ProjectStateService);

  readonly showBulkPreview = signal(false);
  readonly bulkPreviewData = signal<BulkPreviewData | null>(null);
  private pendingBulkAction: BulkAction | null = null;

  onBulkAction(action: BulkAction): void {
    const taskIds = this.state.selectedTaskIds();
    const count = taskIds.length;
    if (count === 0) return;

    this.pendingBulkAction = action;

    const description = this.describeBulkAction(action, count);
    const warnings: string[] = [];
    if (action.type === 'delete') {
      warnings.push(
        'This action cannot be undone after the undo window expires.',
      );
    }

    this.bulkPreviewData.set({
      action: action.type,
      description,
      taskCount: count,
      warnings,
    });
    this.showBulkPreview.set(true);
  }

  onBulkPreviewConfirmed(
    boardId: string,
    destroy$: Subject<void>,
    callbacks: {
      getUndoToast: () =>
        | { show: (opId: string, desc: string) => void }
        | undefined;
      resetPreviewDialog: () => void;
    },
  ): void {
    const action = this.pendingBulkAction;
    if (!action) return;

    const taskIds = this.state.selectedTaskIds();
    this.showBulkPreview.set(false);

    this.bulkActionsService.executeBulkAction(boardId, action, taskIds, {
      onSuccess: () => {
        this.state.clearSelection();
        this.bulkOpsService
          .executeOperation(
            boardId,
            action.type,
            taskIds,
            this.buildBulkParams(action),
          )
          .subscribe({
            next: (result) => {
              const toast = callbacks.getUndoToast();
              if (toast) {
                toast.show(
                  result.operation_id,
                  this.describeBulkAction(action, taskIds.length),
                );
              }
            },
            error: () => {
              // Backend undo endpoint not available yet; that's ok
            },
          });
        this.state.loadBoard(boardId, destroy$);
      },
      onError: (message) => {
        this.state.showError(message);
      },
    });

    this.pendingBulkAction = null;
    callbacks.resetPreviewDialog();
  }

  onBulkPreviewCancelled(): void {
    this.showBulkPreview.set(false);
    this.pendingBulkAction = null;
  }

  onExportSelectedCsv(): void {
    const taskIds = new Set(this.state.selectedTaskIds());
    const allTasks: Task[] = [];
    const boardState = this.state.boardState();
    for (const tasks of Object.values(boardState)) {
      for (const task of tasks) {
        if (taskIds.has(task.id)) {
          allTasks.push(task);
        }
      }
    }
    this.bulkOpsService.exportTasksCsv(allTasks);
  }

  describeBulkAction(action: BulkAction, count: number): string {
    switch (action.type) {
      case 'move': {
        const col = this.state.columns().find((c) => c.id === action.column_id);
        return `Move ${count} task${count !== 1 ? 's' : ''} to "${col?.name ?? 'column'}"`;
      }
      case 'priority':
        return `Set priority to "${action.priority}" for ${count} task${count !== 1 ? 's' : ''}`;
      case 'milestone':
        if (action.clear_milestone) {
          return `Clear milestone for ${count} task${count !== 1 ? 's' : ''}`;
        }
        return `Set milestone for ${count} task${count !== 1 ? 's' : ''}`;
      case 'group':
        if (action.clear_group) {
          return `Remove group for ${count} task${count !== 1 ? 's' : ''}`;
        }
        return `Move ${count} task${count !== 1 ? 's' : ''} to group`;
      case 'delete':
        return `Delete ${count} task${count !== 1 ? 's' : ''}`;
    }
  }

  private buildBulkParams(
    action: BulkAction,
  ): Record<string, unknown> | undefined {
    const params: Record<string, unknown> = {};
    if (action.column_id) params['status_id'] = action.column_id;
    if (action.priority) params['priority'] = action.priority;
    if (action.milestone_id) params['milestone_id'] = action.milestone_id;
    if (action.clear_milestone) params['clear_milestone'] = true;
    if (action.group_id) params['task_list_id'] = action.group_id;
    if (action.clear_group) params['clear_task_list'] = true;
    return Object.keys(params).length > 0 ? params : undefined;
  }
}
