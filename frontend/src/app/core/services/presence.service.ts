import { Injectable, signal, OnDestroy } from '@angular/core';
import { WebSocketService } from './websocket.service';

export interface TaskLockInfo {
  user_id: string;
  user_name: string;
}

@Injectable({
  providedIn: 'root',
})
export class PresenceService implements OnDestroy {
  readonly boardViewers = signal<string[]>([]);
  readonly taskLocks = signal<Map<string, TaskLockInfo>>(new Map());
  readonly viewerNames = signal<Map<string, string>>(new Map());

  private currentBoardId: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private wsService: WebSocketService) {}

  joinBoard(boardId: string): void {
    if (this.currentBoardId) {
      this.leaveBoard();
    }
    this.currentBoardId = boardId;
    this.wsService.send('presence_join', { board_id: boardId });
    this.startHeartbeat();
  }

  leaveBoard(): void {
    if (this.currentBoardId) {
      this.wsService.send('presence_leave', { board_id: this.currentBoardId });
      this.currentBoardId = null;
    }
    this.stopHeartbeat();
    this.boardViewers.set([]);
    this.taskLocks.set(new Map());
  }

  lockTask(taskId: string): void {
    if (this.currentBoardId) {
      this.wsService.send('lock_task', {
        board_id: this.currentBoardId,
        task_id: taskId,
      });
    }
  }

  unlockTask(taskId: string): void {
    if (this.currentBoardId) {
      this.wsService.send('unlock_task', {
        board_id: this.currentBoardId,
        task_id: taskId,
      });
    }
  }

  updateViewers(userIds: string[]): void {
    this.boardViewers.set(userIds);
  }

  setTaskLock(taskId: string, lock: TaskLockInfo): void {
    this.taskLocks.update((locks) => {
      const updated = new Map(locks);
      updated.set(taskId, lock);
      return updated;
    });
  }

  removeTaskLock(taskId: string): void {
    this.taskLocks.update((locks) => {
      const updated = new Map(locks);
      updated.delete(taskId);
      return updated;
    });
  }

  updateViewerName(userId: string, userName: string): void {
    this.viewerNames.update((names) => {
      const updated = new Map(names);
      updated.set(userId, userName);
      return updated;
    });
  }

  ngOnDestroy(): void {
    this.leaveBoard();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.currentBoardId) {
        this.wsService.send('heartbeat', { board_id: this.currentBoardId });
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
