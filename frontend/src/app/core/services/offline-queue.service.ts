import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateTaskRequest, Task } from './task.service';

export interface QueuedAction {
  id: string;
  type: 'create_task';
  projectId: string;
  payload: CreateTaskRequest;
  timestamp: number;
  retries: number;
}

const QUEUE_KEY = 'taskbolt_offline_queue';
const MAX_RETRIES = 3;

@Injectable({ providedIn: 'root' })
export class OfflineQueueService implements OnDestroy {
  private readonly apiUrl = '/api';

  /** IDs of tasks that are queued but not yet synced */
  readonly pendingIds = signal<Set<string>>(new Set());

  /** Number of items waiting to sync */
  readonly pendingCount = computed(() => this.pendingIds().size);

  private readonly onOnline = (): void => { this.processQueue(); };

  constructor(private readonly http: HttpClient) {
    this.rebuildPendingIds();
    window.addEventListener('online', this.onOnline);
    // Sync any leftover items on startup
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onOnline);
  }

  /** Returns true if a task ID is pending sync */
  isPending(taskId: string): boolean {
    return this.pendingIds().has(taskId);
  }

  /**
   * Enqueue a task creation for later sync.
   * Returns a temporary Task object for optimistic UI display.
   */
  enqueue(projectId: string, request: CreateTaskRequest): Task {
    const tempId = crypto.randomUUID();
    const action: QueuedAction = {
      id: tempId,
      type: 'create_task',
      projectId,
      payload: request,
      timestamp: Date.now(),
      retries: 0,
    };

    const queue = this.readQueue();
    queue.push(action);
    this.writeQueue(queue);
    this.rebuildPendingIds();

    // Return an optimistic Task object
    return {
      id: tempId,
      project_id: projectId,
      title: request.title,
      description: request.description ?? null,
      priority: request.priority ?? 'medium',
      position: '999999',
      due_date: request.due_date ?? null,
      status_id: request.status_id ?? null,
      milestone_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /** Process all queued actions in FIFO order */
  async processQueue(): Promise<void> {
    const queue = this.readQueue();
    if (queue.length === 0) return;

    let synced = 0;
    const remaining: QueuedAction[] = [];

    for (const action of queue) {
      if (!navigator.onLine) {
        remaining.push(action);
        continue;
      }

      try {
        await this.syncAction(action);
        synced++;
      } catch {
        const updated = { ...action, retries: action.retries + 1 };
        if (updated.retries < MAX_RETRIES) {
          remaining.push(updated);
        }
        // Drop after MAX_RETRIES -- silent discard
      }
    }

    this.writeQueue(remaining);
    this.rebuildPendingIds();

    if (synced > 0) {
      this.showSyncToast(synced);
    }
  }

  private syncAction(action: QueuedAction): Promise<Task> {
    const url = `${this.apiUrl}/projects/${action.projectId}/tasks`;
    return new Promise<Task>((resolve, reject) => {
      this.http.post<Task>(url, action.payload).subscribe({
        next: (task) => resolve(task),
        error: (err) => reject(err),
      });
    });
  }

  private showSyncToast(count: number): void {
    // Dispatch a custom event that app.component can listen to,
    // keeping this service free of PrimeNG MessageService dependency.
    window.dispatchEvent(
      new CustomEvent('taskbolt:offline-synced', { detail: { count } }),
    );
  }

  private readQueue(): QueuedAction[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private writeQueue(queue: QueuedAction[]): void {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  private rebuildPendingIds(): void {
    const ids = new Set(this.readQueue().map((a) => a.id));
    this.pendingIds.set(ids);
  }
}
