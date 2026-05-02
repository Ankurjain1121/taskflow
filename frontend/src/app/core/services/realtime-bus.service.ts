import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, Observable, Subscription } from 'rxjs';
import { WebSocketService } from './websocket.service';
import { AuthService } from './auth.service';

export type TaskMutationKind =
  | 'created'
  | 'updated'
  | 'moved'
  | 'bulk_moved'
  | 'deleted';

export interface TaskMutation {
  kind: TaskMutationKind;
  taskId?: string;
  taskIds?: string[];
  statusId?: string;
}

const TASK_EVENT_TYPES = new Set<string>([
  'TaskCreated',
  'TaskUpdated',
  'TaskMoved',
  'TaskBulkMoved',
  'TaskDeleted',
]);

@Injectable({ providedIn: 'root' })
export class RealtimeBusService implements OnDestroy {
  private ws = inject(WebSocketService);
  private auth = inject(AuthService);

  private taskMutated = new Subject<TaskMutation>();
  readonly taskMutated$: Observable<TaskMutation> = this.taskMutated.asObservable();

  private wsSub: Subscription | null = null;

  init(): void {
    if (this.wsSub) return;
    this.ws.connect();
    this.wsSub = this.ws.messages$.subscribe({
      next: (msg) => this.dispatch(msg as unknown as Record<string, unknown>),
    });
  }

  private dispatch(msg: Record<string, unknown>): void {
    if (Array.isArray(msg['events'])) {
      for (const e of msg['events'] as Record<string, unknown>[]) {
        this.processEvent(e);
      }
      return;
    }
    this.processEvent(msg);
  }

  private processEvent(event: Record<string, unknown>): void {
    const type = event['type'] as string | undefined;
    if (!type || !TASK_EVENT_TYPES.has(type)) return;

    const originUserId = event['origin_user_id'] as string | undefined;
    const currentUserId = this.auth.currentUser()?.id;
    if (originUserId && originUserId === currentUserId) return;

    switch (type) {
      case 'TaskCreated':
        this.taskMutated.next({
          kind: 'created',
          taskId: this.extractTaskId(event['task']),
        });
        break;
      case 'TaskUpdated':
        this.taskMutated.next({
          kind: 'updated',
          taskId: this.extractTaskId(event['task']),
        });
        break;
      case 'TaskMoved':
        this.taskMutated.next({
          kind: 'moved',
          taskId: event['task_id'] as string | undefined,
          statusId: event['status_id'] as string | undefined,
        });
        break;
      case 'TaskBulkMoved':
        this.taskMutated.next({
          kind: 'bulk_moved',
          taskIds: event['task_ids'] as string[] | undefined,
          statusId: event['status_id'] as string | undefined,
        });
        break;
      case 'TaskDeleted':
        this.taskMutated.next({
          kind: 'deleted',
          taskId: event['task_id'] as string | undefined,
        });
        break;
    }
  }

  private extractTaskId(task: unknown): string | undefined {
    if (task && typeof task === 'object' && 'id' in task) {
      return (task as { id?: string }).id;
    }
    return undefined;
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
    this.taskMutated.complete();
  }
}
