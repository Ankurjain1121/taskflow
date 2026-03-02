import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { generateKeyBetween } from 'fractional-indexing';
import { Task, TaskService } from '../../../core/services/task.service';
import { TaskMoveEvent } from '../kanban-column/kanban-column.component';
import { BoardStateService } from './board-state.service';
import { SwimlaneTaskMoveEvent } from './swimlane.types';
import { NONE_KEY } from './swimlane-utils';

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

  onSwimlaneTaskMoved(event: SwimlaneTaskMoveEvent): void {
    // Always handle the column-position change (same logic as flat kanban)
    this.onTaskMoved({
      task: event.task,
      targetColumnId: event.targetColumnId,
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
      previousColumnId: event.previousColumnId,
    });

    // If same lane, no property update needed
    if (event.fromGroupKey === event.toGroupKey) return;

    const taskId = event.task.id;
    const { fromGroupKey, toGroupKey, groupBy } = event;

    if (groupBy === 'priority' && toGroupKey !== NONE_KEY) {
      // optimisticUpdateTask handles its own snapshot + rollback
      this.state.optimisticUpdateTask(
        taskId,
        { priority: toGroupKey as Task['priority'] },
        { priority: toGroupKey },
      );
    } else if (groupBy === 'assignee') {
      const snapshot = structuredClone(this.state.boardState());

      // Optimistic: strip old assignee from the task
      this.state.boardState.update((state) => {
        const newState: Record<string, Task[]> = {};
        for (const [colId, tasks] of Object.entries(state)) {
          newState[colId] = tasks.map((t) => {
            if (t.id !== taskId) return t;
            const kept = (t.assignees ?? []).filter((a) => a.id !== fromGroupKey);
            return { ...t, assignees: kept };
          });
        }
        return newState;
      });

      const rollback = () => {
        this.state.boardState.set(snapshot);
        this.state.showError('Failed to update assignee. Reverted.');
      };

      if (fromGroupKey !== NONE_KEY) {
        this.taskService.unassignUser(taskId, fromGroupKey).subscribe({ error: rollback });
      }
      if (toGroupKey !== NONE_KEY) {
        this.taskService.assignUser(taskId, toGroupKey).subscribe({ error: rollback });
      }
    } else if (groupBy === 'label') {
      const snapshot = structuredClone(this.state.boardState());

      // Optimistic: strip old label from the task
      this.state.boardState.update((state) => {
        const newState: Record<string, Task[]> = {};
        for (const [colId, tasks] of Object.entries(state)) {
          newState[colId] = tasks.map((t) => {
            if (t.id !== taskId) return t;
            const kept = (t.labels ?? []).filter((l) => l.id !== fromGroupKey);
            return { ...t, labels: kept };
          });
        }
        return newState;
      });

      const rollback = () => {
        this.state.boardState.set(snapshot);
        this.state.showError('Failed to update label. Reverted.');
      };

      if (fromGroupKey !== NONE_KEY) {
        this.taskService.removeLabel(taskId, fromGroupKey).subscribe({ error: rollback });
      }
      if (toGroupKey !== NONE_KEY) {
        this.taskService.addLabel(taskId, toGroupKey).subscribe({ error: rollback });
      }
    }
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
