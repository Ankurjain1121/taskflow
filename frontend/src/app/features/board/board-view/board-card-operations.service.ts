import { Injectable, inject } from '@angular/core';
import { takeUntil, Subject } from 'rxjs';
import { Task, TaskService } from '../../../core/services/task.service';
import { UndoService } from '../../../shared/services/undo.service';
import { MessageService } from 'primeng/api';
import { BoardStateService } from './board-state.service';

@Injectable()
export class BoardCardOperationsService {
  private taskService = inject(TaskService);
  private undoService = inject(UndoService);
  private messageService = inject(MessageService);
  private state = inject(BoardStateService);

  onCardColumnMove(
    event: { taskId: string; columnId: string },
    destroy$: Subject<void>,
  ): void {
    const snapshot = structuredClone(this.state.boardState());

    this.state.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      let movedTask: Task | null = null;
      for (const [colId, tasks] of Object.entries(state)) {
        const found = tasks.find((t) => t.id === event.taskId);
        if (found)
          movedTask = { ...found, column_id: event.columnId, position: 'a0' };
        newState[colId] = tasks.filter((t) => t.id !== event.taskId);
      }
      if (movedTask) {
        newState[event.columnId] = [
          ...(newState[event.columnId] || []),
          movedTask,
        ].sort((a, b) => a.position.localeCompare(b.position));
      }
      return newState;
    });

    this.taskService
      .moveTask(event.taskId, { status_id: event.columnId, position: 'a0' })
      .pipe(takeUntil(destroy$))
      .subscribe({
        error: () => {
          this.state.boardState.set(snapshot);
          this.state.showError('Failed to move task');
        },
      });
  }

  onCardDuplicate(taskId: string, destroy$: Subject<void>): void {
    let originalTask: Task | null = null;
    const currentState = this.state.boardState();
    for (const tasks of Object.values(currentState)) {
      const found = tasks.find((t) => t.id === taskId);
      if (found) {
        originalTask = found;
        break;
      }
    }
    if (!originalTask) return;

    const tempId = crypto.randomUUID();
    const tempTask: Task = {
      ...originalTask,
      id: tempId,
      title: `${originalTask.title} (copy)`,
      position: 'zzzzzz',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const snapshot = structuredClone(currentState);
    const origColumnId = originalTask.status_id ?? '';
    this.state.boardState.update((state) => {
      const newState = { ...state };
      newState[origColumnId] = [...(newState[origColumnId] || []), tempTask];
      return newState;
    });

    this.taskService
      .duplicateTask(taskId)
      .pipe(takeUntil(destroy$))
      .subscribe({
        next: (realTask) => {
          this.state.boardState.update((state) => {
            const newState = { ...state };
            const col = newState[realTask.status_id ?? ''] || [];
            newState[realTask.status_id ?? ''] = col
              .map((t) => (t.id === tempId ? realTask : t))
              .sort((a, b) => a.position.localeCompare(b.position));
            return newState;
          });
          this.undoService.setMessageService(this.messageService);
          this.undoService.schedule({
            id: `dup-${realTask.id}`,
            summary: 'Task duplicated',
            execute: () => {},
            rollback: () => {
              this.state.deleteTask(realTask.id);
            },
          });
        },
        error: () => {
          this.state.boardState.set(snapshot);
          this.state.showError('Failed to duplicate task');
        },
      });
  }
}
