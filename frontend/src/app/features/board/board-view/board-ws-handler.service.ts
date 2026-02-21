import { Injectable, inject } from '@angular/core';
import { Task } from '../../../core/services/task.service';
import { AuthService } from '../../../core/services/auth.service';

@Injectable()
export class BoardWsHandlerService {
  private authService = inject(AuthService);

  handleMessage(
    message: { type: string; payload: unknown },
    callbacks: {
      onTaskCreated: (task: Task) => void;
      onTaskUpdated: (task: Task) => void;
      onTaskMoved: (task: Task) => void;
      onTaskDeleted: (task: Task) => void;
    },
  ): void {
    if (!message.payload || typeof message.payload !== 'object') return;

    const currentUserId = this.authService.currentUser()?.id;

    const payload = message.payload as { userId?: string; task?: Task };
    if (payload.userId && payload.userId === currentUserId) {
      return;
    }

    switch (message.type) {
      case 'task:created':
        if (payload.task) callbacks.onTaskCreated(payload.task);
        break;
      case 'task:updated':
        if (payload.task) callbacks.onTaskUpdated(payload.task);
        break;
      case 'task:moved':
        if (payload.task) callbacks.onTaskMoved(payload.task);
        break;
      case 'task:deleted':
        if (payload.task) callbacks.onTaskDeleted(payload.task);
        break;
    }
  }
}
