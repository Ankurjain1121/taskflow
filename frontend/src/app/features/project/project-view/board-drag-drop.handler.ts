import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { generateKeyBetween } from 'fractional-indexing';
import { Task, TaskService } from '../../../core/services/task.service';
import { TaskMoveEvent } from '../kanban-column/kanban-column.component';
import { ProjectStateService } from './board-state.service';
import { SwimlaneTaskMoveEvent } from './swimlane.types';
import { NONE_KEY } from './swimlane-utils';

@Injectable()
export class ProjectDragDropHandler {
  private taskService = inject(TaskService);
  private router = inject(Router);
  private state = inject(ProjectStateService);

  onTaskMoved(event: TaskMoveEvent): void {
    const snapshot = structuredClone(this.state.boardState());

    const filteredTarget = this.state
      .filterTasks(snapshot[event.targetColumnId] || [], this.state.filters())
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
        status_id: event.targetColumnId,
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
            const kept = (t.assignees ?? []).filter(
              (a) => a.id !== fromGroupKey,
            );
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
        this.taskService
          .unassignUser(taskId, fromGroupKey)
          .subscribe({ error: rollback });
      }
      if (toGroupKey !== NONE_KEY) {
        this.taskService
          .assignUser(taskId, toGroupKey)
          .subscribe({ error: rollback });
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
        this.taskService
          .removeLabel(taskId, fromGroupKey)
          .subscribe({ error: rollback });
      }
      if (toGroupKey !== NONE_KEY) {
        this.taskService
          .addLabel(taskId, toGroupKey)
          .subscribe({ error: rollback });
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

  navigateCardColumn(direction: -1 | 1): void {
    const taskId = this.state.focusedTaskId();
    if (!taskId) return;
    const cols = this.state.columns();
    const filtered = this.state.filteredBoardState();

    let currentColIdx = -1;
    for (let i = 0; i < cols.length; i++) {
      const tasks = filtered[cols[i].id] || [];
      if (tasks.some((t) => t.id === taskId)) {
        currentColIdx = i;
        break;
      }
    }
    if (currentColIdx === -1) return;

    const targetIdx = currentColIdx + direction;
    if (targetIdx < 0 || targetIdx >= cols.length) return;

    const targetCol = cols[targetIdx];
    const targetTasks = filtered[targetCol.id] || [];
    if (targetTasks.length > 0) {
      this.state.focusedTaskId.set(targetTasks[0].id);
      setTimeout(() => {
        const el = document.querySelector(
          `[data-task-id="${targetTasks[0].id}"]`,
        );
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 0);
    }
  }

  pickUpCard(): void {
    const taskId = this.state.focusedTaskId();
    if (!taskId) return;
    const cols = this.state.columns();
    const filtered = this.state.filteredBoardState();
    for (const col of cols) {
      const tasks = filtered[col.id] || [];
      if (tasks.some((t) => t.id === taskId)) {
        this.state.dragSimulationActive.set(true);
        this.state.dragSimulationSourceColumnId.set(col.id);
        this.state.dragSimulationCurrentColumnId.set(col.id);
        return;
      }
    }
  }

  moveCardToAdjacentColumn(direction: -1 | 1): void {
    if (!this.state.dragSimulationActive()) return;
    const currentColId = this.state.dragSimulationCurrentColumnId();
    const cols = this.state.columns();
    const currentIdx = cols.findIndex((c) => c.id === currentColId);
    if (currentIdx === -1) return;
    const targetIdx = currentIdx + direction;
    if (targetIdx < 0 || targetIdx >= cols.length) return;
    this.state.dragSimulationCurrentColumnId.set(cols[targetIdx].id);
  }

  dropCard(): void {
    if (!this.state.dragSimulationActive()) return;
    const taskId = this.state.focusedTaskId();
    const targetColId = this.state.dragSimulationCurrentColumnId();
    const sourceColId = this.state.dragSimulationSourceColumnId();
    this.cancelDrag();
    if (!taskId || !targetColId || targetColId === sourceColId) return;

    const state = this.state.boardState();
    let task: Task | null = null;
    for (const tasks of Object.values(state)) {
      const found = tasks.find((t) => t.id === taskId);
      if (found) {
        task = found;
        break;
      }
    }
    if (!task) return;
    this.onTaskMoved({
      task,
      targetColumnId: targetColId,
      previousIndex: 0,
      currentIndex: 0,
      previousColumnId: sourceColId ?? task.status_id ?? '',
    });
  }

  cancelDrag(): void {
    this.state.dragSimulationActive.set(false);
    this.state.dragSimulationSourceColumnId.set(null);
    this.state.dragSimulationCurrentColumnId.set(null);
  }

  scrollToColumn(index: number): void {
    const cols = this.state.columns();
    if (index < 0 || index >= cols.length) return;
    setTimeout(() => {
      const el = document.querySelector(`[data-column-index="${index}"]`);
      el?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start',
      });
    }, 0);
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
