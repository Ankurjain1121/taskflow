import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';

import { Task } from '../../../core/services/task.service';
import { Column } from '../../../core/services/project.service';
import { KanbanColumnComponent } from '../kanban-column/kanban-column.component';
import { TaskMoveEvent } from '../kanban-column/kanban-column.component';
import { CardFields } from './project-state.service';

@Component({
  selector: 'app-project-kanban-board',
  standalone: true,
  imports: [CommonModule, CdkDrag, CdkDropList, KanbanColumnComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex-1 overflow-x-auto p-4">
      @if (dragSimulationActive()) {
        <div
          class="fixed top-16 left-1/2 -translate-x-1/2 z-30 bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-full text-sm font-medium shadow-lg pointer-events-none"
          aria-live="polite"
        >
          Drag mode · ← → to move · Space to drop · Esc to cancel
        </div>
      }
      <div
        class="flex gap-2 h-full"
        cdkDropList
        cdkDropListOrientation="horizontal"
        (cdkDropListDropped)="onColumnDrop($event)"
      >
        @for (column of columns(); track column.id) {
          <app-kanban-column
            cdkDrag
            [cdkDragData]="column"
            [attr.data-column-index]="$index"
            [column]="column"
            [dragSimActive]="dragSimulationActive()"
            [dragSimCurrentColId]="dragSimulationCurrentColumnId()"
            [tasks]="getFilteredTasksForColumn(column.id)"
            [connectedLists]="connectedColumnIds()"
            [celebratingTaskId]="celebratingTaskId()"
            [focusedTaskId]="focusedTaskId()"
            [selectedTaskIds]="selectedTaskIds()"
            [allColumns]="columns()"
            [statusTransitions]="statusTransitions()"
            [boardPrefix]="boardPrefix()"
            [isCollapsed]="collapsedColumnIds().has(column.id)"
            [density]="density()"
            [cardFields]="cardFields()"
            (taskMoved)="taskMoved.emit($event)"
            (taskClicked)="taskClicked.emit($event)"
            (addTaskClicked)="addTaskClicked.emit($event)"
            (selectionToggled)="selectionToggled.emit($event)"
            (priorityChanged)="priorityChanged.emit($event)"
            (titleChanged)="titleChanged.emit($event)"
            (columnMoveRequested)="columnMoveRequested.emit($event)"
            (moveToProjectRequested)="moveToProjectRequested.emit($event)"
            (duplicateRequested)="duplicateRequested.emit($event)"
            (deleteRequested)="deleteRequested.emit($event)"
            (quickTaskCreated)="quickTaskCreated.emit($event)"
            (collapseToggled)="collapseToggled.emit($event)"
            (renameRequested)="renameRequested.emit($event)"
            (wipLimitRequested)="wipLimitRequested.emit($event)"
            (columnDeleteRequested)="columnDeleteRequested.emit($event)"
            (iconChangeRequested)="iconChangeRequested.emit($event)"
          ></app-kanban-column>
        }

        <!-- Add Column Button -->
        <div class="flex-shrink-0">
          <button
            (click)="addColumn.emit()"
            class="w-[272px] h-12 flex items-center justify-center gap-2 bg-[var(--secondary)] hover:bg-[var(--muted)] rounded-lg text-[var(--muted-foreground)] transition-colors"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Column
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ProjectKanbanBoardComponent {
  // Inputs
  readonly columns = input.required<Column[]>();
  readonly filteredBoardState = input.required<Record<string, Task[]>>();
  readonly dragSimulationActive = input.required<boolean>();
  readonly dragSimulationCurrentColumnId = input.required<string | null>();
  readonly celebratingTaskId = input.required<string | null>();
  readonly focusedTaskId = input.required<string | null>();
  readonly selectedTaskIds = input.required<string[]>();
  readonly connectedColumnIds = input.required<string[]>();
  readonly statusTransitions = input.required<Record<string, string[] | null>>();
  readonly boardPrefix = input.required<string | null>();
  readonly collapsedColumnIds = input.required<Set<string>>();
  readonly density = input.required<'compact' | 'normal' | 'expanded'>();
  readonly cardFields = input.required<CardFields>();

  // Outputs - task events
  readonly taskMoved = output<TaskMoveEvent>();
  readonly taskClicked = output<Task>();
  readonly addTaskClicked = output<string>();
  readonly selectionToggled = output<string>();
  readonly priorityChanged = output<{ taskId: string; priority: string }>();
  readonly titleChanged = output<{ taskId: string; title: string }>();
  readonly columnMoveRequested = output<{
    taskId: string;
    columnId: string;
  }>();
  readonly moveToProjectRequested = output<string>();
  readonly duplicateRequested = output<string>();
  readonly deleteRequested = output<string>();
  readonly quickTaskCreated = output<{ columnId: string; title: string }>();

  // Outputs - column events
  readonly collapseToggled = output<string>();
  readonly renameRequested = output<string>();
  readonly wipLimitRequested = output<string>();
  readonly columnDeleteRequested = output<string>();
  readonly iconChangeRequested = output<{
    columnId: string;
    currentIcon: string | null;
  }>();
  readonly columnDrop = output<{ previousIndex: number; currentIndex: number }>();
  readonly addColumn = output<void>();

  getFilteredTasksForColumn(columnId: string): Task[] {
    return this.filteredBoardState()[columnId] || [];
  }

  onColumnDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.columnDrop.emit({
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
    });
  }
}
