import {
  Component,
  input,
  output,
  computed,
  signal,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDropList,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Column } from '../../../core/services/board.service';
import { Task } from '../../../core/services/task.service';
import { TaskCardComponent } from '../task-card/task-card.component';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

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
  imports: [CommonModule, FormsModule, CdkDropList, TaskCardComponent, Menu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isCollapsed()) {
      <!-- Collapsed Column -->
      <div
        (click)="collapseToggled.emit(column().id)"
        class="flex flex-col items-center bg-[var(--muted)] rounded-lg min-h-[500px] w-[40px] flex-shrink-0 cursor-pointer hover:bg-[var(--secondary)] transition-colors"
      >
        <div
          class="h-1 w-full rounded-t-lg"
          [style.background-color]="column().color || 'var(--primary)'"
        ></div>
        <div class="flex flex-col items-center gap-2 py-3 flex-1">
          <span
            class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-medium bg-[var(--secondary)] text-[var(--foreground)]"
          >
            {{ tasks().length }}
          </span>
          <span
            class="text-xs font-medium text-[var(--foreground)] whitespace-nowrap"
            style="writing-mode: vertical-rl; text-orientation: mixed;"
          >
            {{ column().name }}
          </span>
        </div>
      </div>
    } @else {
      <div
        class="flex flex-col bg-[var(--muted)] rounded-lg min-h-[500px] w-[272px] flex-shrink-0"
      >
        <!-- Color Accent Bar -->
        <div
          class="h-1 rounded-t-lg"
          [style.background-color]="column().color || 'var(--primary)'"
        ></div>

        <!-- Column Header -->
        <div class="px-3 py-3 border-b border-[var(--border)]">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
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

              <!-- WIP Limit Indicator -->
              @if (column().wip_limit) {
                <span class="text-xs ml-0.5" [class]="wipStatusClass()">
                  {{ tasks().length }}/{{ column().wip_limit }}
                </span>
              }

              <!-- Done Checkmark -->
              @if (isDoneColumn()) {
                <svg
                  class="w-4 h-4 text-[var(--success)]"
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

            <div class="flex items-center gap-1">
              <!-- Collapse Button -->
              <button
                (click)="collapseToggled.emit(column().id)"
                class="p-1 hover:bg-[var(--secondary)] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="Collapse column"
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
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>

              <!-- Column Menu -->
              <button
                (click)="columnMenu.toggle($event)"
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
              <p-menu #columnMenu [popup]="true" [model]="columnMenuItems()" />
            </div>
          </div>

          <!-- WIP Limit Warning -->
          @if (isOverWipLimit()) {
            <div
              class="mt-2 text-xs text-[var(--status-amber-text)] bg-[var(--status-amber-bg)] rounded px-2 py-1"
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
          @for (task of visibleTasks(); track task.id) {
            <app-task-card
              [task]="task"
              [isBlocked]="false"
              [isCelebrating]="celebratingTaskId() === task.id"
              [isFocused]="focusedTaskId() === task.id"
              [isSelected]="selectedTaskIds().includes(task.id)"
              [columns]="allColumns()"
              [boardPrefix]="boardPrefix()"
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
              (selectionToggled)="selectionToggled.emit($event)"
              (priorityChanged)="priorityChanged.emit($event)"
              (columnMoveRequested)="columnMoveRequested.emit($event)"
              (duplicateRequested)="duplicateRequested.emit($event)"
              (deleteRequested)="deleteRequested.emit($event)"
            ></app-task-card>
          }

          <!-- Scroll sentinel for lazy rendering -->
          @if (isLazy() && visibleTasks().length < tasks().length) {
            <div #scrollSentinel class="h-4 w-full"></div>
          }

          <!-- Show More Button -->
          @if (visibleTasks().length < tasks().length) {
            <button
              class="w-full py-2 text-sm text-[var(--text-secondary,var(--muted-foreground))] hover:text-[var(--text-primary,var(--foreground))] hover:bg-[var(--hover,var(--secondary))] rounded-md transition-colors"
              (click)="loadMore()"
            >
              Show {{ remainingCount() }} more...
            </button>
          }

          <!-- Empty State -->
          @if (tasks().length === 0) {
            <div
              class="flex flex-col items-center py-8 text-[var(--muted-foreground)]"
            >
              <i class="pi pi-inbox text-2xl mb-2 opacity-40"></i>
              <p class="text-sm">No tasks</p>
            </div>
          }
        </div>

        <!-- Add Task Footer -->
        <div class="px-2 py-2 border-t border-[var(--border)]">
          @if (isQuickAdding()) {
            <div class="space-y-1">
              <input
                type="text"
                [(ngModel)]="quickTaskTitle"
                (keydown)="onQuickTaskKeydown($event)"
                placeholder="Task title..."
                class="w-full px-3 py-2 text-sm bg-[var(--card)] border border-[var(--border)] rounded-md text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                #quickTaskInput
              />
              <div class="flex items-center gap-1">
                <button
                  (click)="submitQuickTask()"
                  class="flex-1 px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] bg-[var(--primary)] rounded hover:opacity-90"
                >
                  Add
                </button>
                <button
                  (click)="onAddTask()"
                  class="px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] rounded"
                  title="More options"
                >
                  <svg
                    class="w-3.5 h-3.5"
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
                <button
                  (click)="cancelQuickAdd()"
                  class="px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          } @else {
            <button
              (click)="startQuickAdd()"
              class="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] rounded-md btn-snappy"
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
          }
        </div>
      </div>
    }
  `,
  host: {
    class: 'group',
  },
})
export class KanbanColumnComponent implements AfterViewInit, OnDestroy {
  private ngZone = inject(NgZone);

  column = input.required<Column>();
  tasks = input.required<Task[]>();
  connectedLists = input<string[]>([]);
  celebratingTaskId = input<string | null>(null);
  focusedTaskId = input<string | null>(null);

  selectedTaskIds = input<string[]>([]);
  allColumns = input<Column[]>([]);
  boardPrefix = input<string | null>(null);
  isCollapsed = input<boolean>(false);

  taskMoved = output<TaskMoveEvent>();
  taskClicked = output<Task>();
  addTaskClicked = output<string>();
  selectionToggled = output<string>();
  priorityChanged = output<{ taskId: string; priority: string }>();
  columnMoveRequested = output<{ taskId: string; columnId: string }>();
  duplicateRequested = output<string>();
  deleteRequested = output<string>();
  quickTaskCreated = output<{ columnId: string; title: string }>();
  collapseToggled = output<string>();
  renameRequested = output<string>();
  wipLimitRequested = output<string>();
  columnDeleteRequested = output<string>();

  readonly columnMenuItems = computed((): MenuItem[] => [
    {
      label: 'Rename',
      icon: 'pi pi-pencil',
      command: () => this.renameRequested.emit(this.column().id),
    },
    {
      label: 'Set WIP Limit',
      icon: 'pi pi-sliders-h',
      command: () => this.wipLimitRequested.emit(this.column().id),
    },
    { separator: true },
    {
      label: 'Delete Column',
      icon: 'pi pi-trash',
      styleClass: 'text-red-500',
      command: () => this.columnDeleteRequested.emit(this.column().id),
    },
  ]);

  isQuickAdding = signal(false);
  quickTaskTitle = '';

  // --- Lazy rendering for large columns (50+ tasks) ---
  private renderLimit = signal(30);
  private scrollObserver: IntersectionObserver | null = null;

  @ViewChild('scrollSentinel') scrollSentinel?: ElementRef<HTMLDivElement>;

  readonly isLazy = computed(() => this.tasks().length >= 50);

  readonly visibleTasks = computed(() => {
    if (!this.isLazy()) return this.tasks();
    return this.tasks().slice(0, this.renderLimit());
  });

  ngAfterViewInit(): void {
    this.setupScrollObserver();
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
    this.scrollObserver = null;
  }

  private setupScrollObserver(): void {
    if (!this.scrollSentinel?.nativeElement) return;

    this.ngZone.runOutsideAngular(() => {
      this.scrollObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            this.ngZone.run(() => {
              this.renderLimit.update((limit) =>
                Math.min(limit + 20, this.tasks().length),
              );
              // Re-observe if there are still more tasks
              if (this.renderLimit() >= this.tasks().length) {
                this.scrollObserver?.disconnect();
              }
            });
          }
        },
        { rootMargin: '200px' },
      );
      if (this.scrollSentinel?.nativeElement) {
        this.scrollObserver.observe(this.scrollSentinel.nativeElement);
      }
    });
  }

  readonly remainingCount = computed(() =>
    Math.min(20, this.tasks().length - this.visibleTasks().length),
  );

  readonly wipStatusClass = computed(() => {
    const limit = this.column().wip_limit;
    if (!limit) return 'text-[var(--muted-foreground)]';
    const count = this.tasks().length;
    if (count > limit) return 'text-red-500 font-bold';
    if (count === limit) return 'text-amber-500 font-semibold';
    return 'text-[var(--muted-foreground)]';
  });

  loadMore(): void {
    this.renderLimit.update((limit) =>
      Math.min(limit + 20, this.tasks().length),
    );
  }

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
    this.isQuickAdding.set(false);
    this.quickTaskTitle = '';
    this.addTaskClicked.emit(this.column().id);
  }

  startQuickAdd(): void {
    this.isQuickAdding.set(true);
    this.quickTaskTitle = '';
  }

  cancelQuickAdd(): void {
    this.isQuickAdding.set(false);
    this.quickTaskTitle = '';
  }

  submitQuickTask(): void {
    const title = this.quickTaskTitle.trim();
    if (!title) return;
    this.quickTaskCreated.emit({ columnId: this.column().id, title });
    this.quickTaskTitle = '';
  }

  onQuickTaskKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.submitQuickTask();
    }
    if (event.key === 'Escape') {
      this.cancelQuickAdd();
    }
  }
}
