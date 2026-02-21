import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { generateKeyBetween } from 'fractional-indexing';
import { Task, TaskService } from '../../../core/services/task.service';
import { TaskMoveEvent } from '../kanban-column/kanban-column.component';
import { BoardStateService } from './board-state.service';

@Injectable()
export class BoardDragDropHandler {
  private taskService = inject(TaskService);
  private router = inject(Router);
  private state = inject(BoardStateService);

  onTaskMoved(event: TaskMoveEvent): void {
    const snapshot = structuredClone(this.state.boardState());

    const filteredTarget = this.state
      .filterTasks(
        snapshot[event.targetColumnId] || [],
        this.state.filters(),
      )
      .filter((t) => t.id !== event.task.id);

    const beforeTask =
      event.currentIndex > 0 ? filteredTarget[event.currentIndex - 1] : null;
    const afterTask =
      event.currentIndex < filteredTarget.length
        ? filteredTarget[event.currentIndex]
        : null;

    const beforePos = beforeTask?.position ?? null;
    const afterPos = afterTask?.position ?? null;

    let newPosition: string;
    try {
      newPosition = generateKeyBetween(beforePos, afterPos);
    } catch {
      newPosition = Date.now().toString();
    }

    this.state.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};

      for (const [columnId, tasks] of Object.entries(state)) {
        newState[columnId] = tasks.filter((t) => t.id !== event.task.id);
      }

      const updatedTask = {
        ...event.task,
        column_id: event.targetColumnId,
        position: newPosition,
      };
      const targetTasks = [...(newState[event.targetColumnId] || [])];
      targetTasks.splice(event.currentIndex, 0, updatedTask);
      newState[event.targetColumnId] = targetTasks;

      return newState;
    });

    const targetColumn = this.state
      .columns()
      .find((c) => c.id === event.targetColumnId);
    if (
      targetColumn?.status_mapping?.done &&
      event.previousColumnId !== event.targetColumnId
    ) {
      this.state.celebratingTaskId.set(event.task.id);
      setTimeout(() => this.state.celebratingTaskId.set(null), 1200);
    }

    this.taskService
      .moveTask(event.task.id, {
        column_id: event.targetColumnId,
        position: newPosition,
      })
      .subscribe({
        error: () => {
          this.state.boardState.set(snapshot);
          this.state.showError('Failed to move task. Reverted.');
        },
      });
  }

  // === Card Keyboard Navigation ===

  navigateCard(direction: number): void {
    const allTasks = this.getAllVisibleTasks();
    if (allTasks.length === 0) return;

    const currentId = this.state.focusedTaskId();
    const currentIndex = currentId
      ? allTasks.findIndex((t) => t.id === currentId)
      : -1;

    const nextIndex = Math.max(
      0,
      Math.min(allTasks.length - 1, currentIndex + direction),
    );
    const nextTaskId = allTasks[nextIndex].id;
    this.state.focusedTaskId.set(nextTaskId);

    setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${nextTaskId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  }

  openFocusedTask(): void {
    const taskId = this.state.focusedTaskId();
    if (taskId) {
      this.router.navigate(['/task', taskId]);
    }
  }

  private getAllVisibleTasks(): Task[] {
    const cols = this.state.columns();
    const filtered = this.state.filteredBoardState();
    const tasks: Task[] = [];

    for (const col of cols) {
      const colTasks = filtered[col.id] || [];
      tasks.push(...colTasks);
    }

    return tasks;
  }
}
