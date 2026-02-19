import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CdkDropList,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Column } from '../../../core/services/board.service';
import { Task } from '../../../core/services/task.service';
import { TaskCardComponent } from '../task-card/task-card.component';

export interface TaskMoveEvent {
  task: Task;
  targetColumnId: string;
  previousIndex: number;
  currentIndex: number;
  previousColumnId: string;
}

@Component({
  selector: 'app-kanban-column',
  standalone: true,
  imports: [CommonModule, CdkDropList, TaskCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col bg-[var(--muted)] rounded-lg min-h-[500px] w-72 flex-shrink-0"
    >
      <!-- Column Header -->
      <div class="px-3 py-3 border-b border-[var(--border)]">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <!-- Color Dot -->
            <span
              class="w-3 h-3 rounded-full"
              [style.background-color]="column().color || '#6366f1'"
            ></span>

            <!-- Column Name -->
            <h3 class="font-medium text-[var(--foreground)]">
              {{ column().name }}
            </h3>

            <!-- Task Count -->
            <span
              class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--secondary)] text-[var(--foreground)]"
            >
              {{ tasks().length }}
            </span>

            <!-- Done Checkmark -->
            @if (isDoneColumn()) {
              <svg
                class="w-4 h-4 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
            }
          </div>

          <!-- Column Menu -->
          <button
            class="p-1 hover:bg-[var(--secondary)] rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Column options"
          >
            <svg
              class="w-4 h-4 text-[var(--muted-foreground)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>
        </div>

        <!-- WIP Limit Warning -->
        @if (isOverWipLimit()) {
          <div
            class="mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1"
          >
            WIP limit ({{ column().wip_limit }}) exceeded
          </div>
        }
      </div>

      <!-- Tasks List -->
      <div
        cdkDropList
        [id]="'column-' + column().id"
        [cdkDropListData]="tasks()"
        [cdkDropListConnectedTo]="connectedLists()"
        (cdkDropListDropped)="onDrop($event)"
        class="flex-1 px-2 py-2 space-y-2 overflow-y-auto min-h-[200px]"
      >
        @for (task of tasks(); track task.id) {
          <app-task-card
            [task]="task"
            [isBlocked]="false"
            [isCelebrating]="celebratingTaskId() === task.id"
            [isFocused]="focusedTaskId() === task.id"
            [subtaskProgress]="
              task.subtask_total
                ? {
                    completed: task.subtask_completed ?? 0,
                    total: task.subtask_total,
                  }
                : null
            "
            [hasRunningTimer]="task.has_running_timer ?? false"
            (taskClicked)="onTaskClicked($event)"
          ></app-task-card>
        }

        <!-- Empty State -->
        @if (tasks().length === 0) {
          <div
            class="flex flex-col items-center justify-center h-24 text-sm border-2 border-dashed border-[var(--border)] rounded-lg transition-colors"
          >
            <span class="text-[var(--muted-foreground)]">Drop tasks here</span>
          </div>
        }
      </div>

      <!-- Add Task Button -->
      <div class="px-2 py-2 border-t border-[var(--border)]">
        <button
          (click)="onAddTask()"
          class="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] rounded-md transition-colors"
        >
          <svg
            class="w-4 h-4"
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
          Add task
        </button>
      </div>
    </div>
  `,
  host: {
    class: 'group',
  },
})
export class KanbanColumnComponent {
  column = input.required<Column>();
  tasks = input.required<Task[]>();
  connectedLists = input<string[]>([]);
  celebratingTaskId = input<string | null>(null);
  focusedTaskId = input<string | null>(null);

  taskMoved = output<TaskMoveEvent>();
  taskClicked = output<Task>();
  addTaskClicked = output<string>();

  isDoneColumn = computed(() => {
    const mapping = this.column().status_mapping;
    return mapping?.done === true;
  });

  isOverWipLimit = computed(() => {
    const limit = this.column().wip_limit;
    if (!limit) return false;
    return this.tasks().length > limit;
  });

  onDrop(event: CdkDragDrop<Task[]>): void {
    const task = event.item.data as Task;
    const previousColumnId = event.previousContainer.id.replace('column-', '');
    const targetColumnId = event.container.id.replace('column-', '');

    if (event.previousContainer === event.container) {
      // Same column reorder
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    } else {
      // Cross-column move
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }

    this.taskMoved.emit({
      task,
      targetColumnId,
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
      previousColumnId,
    });
  }

  onTaskClicked(task: Task): void {
    this.taskClicked.emit(task);
  }

  onAddTask(): void {
    this.addTaskClicked.emit(this.column().id);
  }
}
