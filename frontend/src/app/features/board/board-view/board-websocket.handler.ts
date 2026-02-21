import { Injectable, inject } from '@angular/core';
import { Task } from '../../../core/services/task.service';
import { AuthService } from '../../../core/services/auth.service';
import { BoardStateService } from './board-state.service';

@Injectable()
export class BoardWebsocketHandler {
  private authService = inject(AuthService);
  private state = inject(BoardStateService);

  handleMessage(message: { type: string; payload: unknown }): void {
    if (!message.payload || typeof message.payload !== 'object') return;

    const currentUserId = this.authService.currentUser()?.id;

    const payload = message.payload as { userId?: string; task?: Task };
    if (payload.userId && payload.userId === currentUserId) {
      return;
    }

    switch (message.type) {
      case 'task:created':
        if (payload.task) this.handleTaskCreated(payload.task);
        break;
      case 'task:updated':
        if (payload.task) this.handleTaskUpdated(payload.task);
        break;
      case 'task:moved':
        if (payload.task) this.handleTaskMoved(payload.task);
        break;
      case 'task:deleted':
        if (payload.task) this.handleTaskDeleted(payload.task);
        break;
    }
  }

  private handleTaskCreated(task: Task): void {
    this.state.boardState.update((state) => {
      const newState = { ...state };
      const columnTasks = newState[task.column_id] || [];
      newState[task.column_id] = [...columnTasks, task].sort((a, b) =>
        a.position.localeCompare(b.position),
      );
      return newState;
    });
  }

  private handleTaskUpdated(task: Task): void {
    this.state.boardState.update((state) => {
      const newState = { ...state };
      for (const [columnId, tasks] of Object.entries(newState)) {
        newState[columnId] = tasks.map((t) => (t.id === task.id ? task : t));
      }
      return newState;
    });
  }

  private handleTaskMoved(task: Task): void {
    this.state.boardState.update((state) => {
      const newState = { ...state };

      for (const [columnId, tasks] of Object.entries(newState)) {
        newState[columnId] = tasks.filter((t) => t.id !== task.id);
      }

      const columnTasks = newState[task.column_id] || [];
      newState[task.column_id] = [...columnTasks, task].sort((a, b) =>
        a.position.localeCompare(b.position),
      );

      return newState;
    });
  }

  private handleTaskDeleted(task: Task): void {
    this.state.boardState.update((state) => {
      const newState = { ...state };
      for (const [columnId, tasks] of Object.entries(newState)) {
        newState[columnId] = tasks.filter((t) => t.id !== task.id);
      }
      return newState;
    });
  }
}
