import { inject, Injectable } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

import {
  TaskService,
  UpdateTaskRequest,
} from '../../../core/services/task.service';
import { ProjectStateService } from './project-state.service';

@Injectable()
export class ProjectListEditHandler {
  private readonly taskService = inject(TaskService);
  private readonly state = inject(ProjectStateService);

  onTitleChanged(
    event: { taskId: string; title: string },
    boardId: string,
    destroy$: Subject<void>,
  ): void {
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
      .moveTask(event.taskId, {
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
      .updateTask(taskId, req)
      .pipe(takeUntil(destroy$))
      .subscribe({
        next: (updatedTask) => {
          this.state.flatTasks.update((tasks) =>
            tasks.map((t) =>
              t.id === taskId ? { ...t, ...updatedTask } : t,
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
