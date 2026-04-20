import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Observable, tap, catchError, throwError } from 'rxjs';
import {
  TaskService,
  Task,
  BulkUpdateRequest,
} from './task.service';
import { HapticService } from './haptic.service';
import { ConfettiService } from './confetti.service';

export interface CompletionOptions {
  celebrate?: boolean;
  silent?: boolean;
}

/**
 * Single entry point for every "mark task done / reopen / move status" flow.
 * Wraps TaskService endpoints so UI surfaces get uniform WS + automation side
 * effects (backend move_task_inner) and uniform UX (haptic + confetti + toast).
 */
@Injectable({ providedIn: 'root' })
export class TaskCompletionService {
  private tasks = inject(TaskService);
  private haptic = inject(HapticService);
  private confetti = inject(ConfettiService);
  private messages = inject(MessageService);

  complete(taskId: string, opts: CompletionOptions = {}): Observable<Task> {
    return this.tasks.completeTask(taskId).pipe(
      tap(() => this.onSuccess(opts)),
      catchError((err) => this.onError('Could not mark task done', opts, err)),
    );
  }

  uncomplete(taskId: string, opts: CompletionOptions = {}): Observable<Task> {
    return this.tasks.uncompleteTask(taskId).pipe(
      tap(() => this.haptic.light()),
      catchError((err) => this.onError('Could not reopen task', opts, err)),
    );
  }

  moveToStatus(
    taskId: string,
    statusId: string,
    position: string = 'bottom',
    opts: CompletionOptions & { isDone?: boolean } = {},
  ): Observable<Task> {
    return this.tasks
      .moveTask(taskId, { status_id: statusId, position })
      .pipe(
        tap(() => {
          if (opts.isDone) this.onSuccess(opts);
          else this.haptic.light();
        }),
        catchError((err) =>
          this.onError('Could not change task status', opts, err),
        ),
      );
  }

  bulkMove(
    projectId: string,
    taskIds: string[],
    statusId: string,
    opts: CompletionOptions & { isDone?: boolean } = {},
  ): Observable<{ updated: number }> {
    const req: BulkUpdateRequest = { task_ids: taskIds, status_id: statusId };
    return this.tasks.bulkUpdate(projectId, req).pipe(
      tap(() => {
        if (opts.isDone) this.onSuccess(opts);
      }),
      catchError((err) =>
        this.onError('Bulk update failed', opts, err),
      ),
    );
  }

  private onSuccess(opts: CompletionOptions): void {
    void this.haptic.success();
    if (opts.celebrate) this.confetti.fire();
  }

  private onError(
    summary: string,
    opts: CompletionOptions,
    err: unknown,
  ): Observable<never> {
    if (!opts.silent) {
      this.messages.add({
        severity: 'error',
        summary,
        detail: 'Please try again.',
        life: 4000,
      });
    }
    return throwError(() => err);
  }
}
