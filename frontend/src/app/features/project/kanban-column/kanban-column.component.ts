import {
  Component,
  input,
  output,
  computed,
  signal,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDropList,
  CdkDragDrop,
  CdkDragHandle,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Column } from '../../../core/services/project.service';
import { Task } from '../../../core/services/task.service';
import { CardFields } from '../project-view/project-state.service';
import { type ColorByMode, resolveCardColor, type ColorableTask } from '../../../shared/utils/task-colors';
import { PresenceService } from '../../../core/services/presence.service';
import { AuthService } from '../../../core/services/auth.service';
import { OnboardingChecklistService } from '../../../core/services/onboarding-checklist.service';
import { TaskCardComponent } from '../task-card/task-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
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
  imports: [
    CommonModule,
    FormsModule,
    CdkDropList,
    CdkDragHandle,
    ScrollingModule,
    TaskCardComponent,
    EmptyStateComponent,
    Menu,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isCollapsed()) {
      <!-- Collapsed Column -->
      <button
        (click)="collapseToggled.emit(column().id)"
        [attr.aria-label]="'Expand ' + column().name + ' column'"
        class="flex flex-col items-center text-left bg-[var(--muted)] rounded-lg min-h-[500px] w-[40px] flex-shrink-0 cursor-pointer hover:bg-[var(--secondary)] transition-colors border-none p-0"
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
      </button>
    } @else {
      <div
        class="flex flex-col bg-[var(--muted)] rounded-lg min-h-[500px] w-[272px] flex-shrink-0 transition-colors duration-200"
        [class.drag-target-active]="isDragTarget()"
      >
        <!-- Color Accent Bar -->
        <div
          class="h-1 rounded-t-lg"
          [style.background-color]="column().color || 'var(--primary)'"
        ></div>

        <!-- Column Header -->
        <div class="px-3 py-3 border-b border-[var(--border)] group">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 min-w-0">
              <!-- Column Icon -->
              @if (column().icon) {
                <span class="text-base leading-none flex-shrink-0">{{
                  column().icon
                }}</span>
              }

              <!-- Column Name -->
              <h3 class="font-medium text-[var(--foreground)] truncate min-w-0 uppercase tracking-wider">
                {{ column().name }}
              </h3>

              <!-- Task Count -->
              <span
                class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium"
                [style.background]="'color-mix(in srgb, ' + (column().color || 'var(--primary)') + ' 15%, transparent)'"
                [style.color]="column().color || 'var(--primary)'"
              >
                {{ tasks().length }}
              </span>

              <!-- Plus Button -->
              <button
                (click)="startQuickAdd()"
                class="p-1 hover:bg-[var(--secondary)] rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                title="Quick add task"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>

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
              <!-- Drag Handle -->
              <div
                cdkDragHandle
                class="p-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                title="Drag to reorder"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
                  />
                </svg>
              </div>

              <!-- Collapse Button -->
              <button
                (click)="collapseToggled.emit(column().id)"
                class="p-1 hover:bg-[var(--secondary)] rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
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
                class="p-1 hover:bg-[var(--secondary)] rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                title="Column options"
                aria-label="Column options"
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
        @if (useVirtualScroll()) {
          <cdk-virtual-scroll-viewport
            cdkDropList
            [id]="'column-' + column().id"
            [cdkDropListData]="tasks()"
            [cdkDropListConnectedTo]="connectedLists()"
            (cdkDropListDropped)="onDrop($event)"
            [itemSize]="cardHeight()"
            class="flex-1 px-2 py-2 min-h-[200px]"
            [style.height.px]="viewportHeight()"
          >
            <div
              *cdkVirtualFor="let task of tasks(); trackBy: trackByTaskId"
              class="pb-2"
            >
              <app-task-card
                [task]="task"
                [density]="density()"
                [stripeColor]="getStripeColor(task)"
                [isBlocked]="false"
                [isCelebrating]="celebratingTaskId() === task.id"
                [isFocused]="focusedTaskId() === task.id"
                [isSelected]="selectedTaskIds().includes(task.id)"
                [isDoneColumn]="isDoneColumn()"
                [columns]="allColumns()"
                [statusTransitions]="statusTransitions()"
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
                [lockedBy]="getTaskLockInfo(task.id)"
                [cardFields]="cardFields()"
                (taskClicked)="onTaskClicked($event)"
                (selectionToggled)="selectionToggled.emit($event)"
                (priorityChanged)="priorityChanged.emit($event)"
                (titleChanged)="titleChanged.emit($event)"
                (columnMoveRequested)="columnMoveRequested.emit($event)"
                (moveToProjectRequested)="moveToProjectRequested.emit($event)"
                (duplicateRequested)="duplicateRequested.emit($event)"
                (deleteRequested)="deleteRequested.emit($event)"
              ></app-task-card>
            </div>
          </cdk-virtual-scroll-viewport>
        } @else {
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
                [density]="density()"
                [stripeColor]="getStripeColor(task)"
                [isBlocked]="false"
                [isCelebrating]="celebratingTaskId() === task.id"
                [isFocused]="focusedTaskId() === task.id"
                [isSelected]="selectedTaskIds().includes(task.id)"
                [isDoneColumn]="isDoneColumn()"
                [columns]="allColumns()"
                [statusTransitions]="statusTransitions()"
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
                [lockedBy]="getTaskLockInfo(task.id)"
                [cardFields]="cardFields()"
                (taskClicked)="onTaskClicked($event)"
                (selectionToggled)="selectionToggled.emit($event)"
                (priorityChanged)="priorityChanged.emit($event)"
                (titleChanged)="titleChanged.emit($event)"
                (columnMoveRequested)="columnMoveRequested.emit($event)"
                (moveToProjectRequested)="moveToProjectRequested.emit($event)"
                (duplicateRequested)="duplicateRequested.emit($event)"
                (deleteRequested)="deleteRequested.emit($event)"
              ></app-task-card>
            }

            <!-- Empty State -->
            @if (tasks().length === 0) {
              <app-empty-state
                variant="column"
                size="compact"
                (ctaClicked)="onAddTask()"
              />
            }
          </div>
        }

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
                  [disabled]="quickSubmitting()"
                  class="flex-1 px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] bg-[var(--primary)] rounded hover:opacity-90 disabled:opacity-50"
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
export class KanbanColumnComponent {
  private presenceService = inject(PresenceService);
  private authService = inject(AuthService);
  private checklistService = inject(OnboardingChecklistService);

  column = input.required<Column>();
  tasks = input.required<Task[]>();
  connectedLists = input<string[]>([]);
  celebratingTaskId = input<string | null>(null);
  focusedTaskId = input<string | null>(null);
  density = input<'compact' | 'normal' | 'expanded'>('normal');
  colorBy = input<ColorByMode>('priority');

  selectedTaskIds = input<string[]>([]);
  allColumns = input<Column[]>([]);
  statusTransitions = input<Record<string, string[] | null>>({});
  boardPrefix = input<string | null>(null);
  isCollapsed = input<boolean>(false);
  dragSimActive = input<boolean>(false);
  dragSimCurrentColId = input<string | null>(null);
  cardFields = input<CardFields>({
    showPriority: true,
    showDueDate: true,
    showAssignees: true,
    showLabels: true,
    showSubtaskProgress: true,
    showComments: true,
    showAttachments: true,
    showTaskId: true,
    showDescription: true,
    showDaysInColumn: true,
  });

  isDragTarget = computed(
    () =>
      this.dragSimActive() && this.dragSimCurrentColId() === this.column().id,
  );

  taskMoved = output<TaskMoveEvent>();
  taskClicked = output<Task>();
  addTaskClicked = output<string>();
  selectionToggled = output<string>();
  priorityChanged = output<{ taskId: string; priority: string }>();
  titleChanged = output<{ taskId: string; title: string }>();
  columnMoveRequested = output<{ taskId: string; columnId: string }>();
  moveToProjectRequested = output<string>();
  duplicateRequested = output<string>();
  deleteRequested = output<string>();
  quickTaskCreated = output<{ columnId: string; title: string }>();
  quickSubmitting = signal(false);
  collapseToggled = output<string>();
  renameRequested = output<string>();
  wipLimitRequested = output<string>();
  columnDeleteRequested = output<string>();
  iconChangeRequested = output<{
    columnId: string;
    currentIcon: string | null;
  }>();

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
    {
      label: 'Set Icon',
      icon: 'pi pi-tag',
      command: () =>
        this.iconChangeRequested.emit({
          columnId: this.column().id,
          currentIcon: this.column().icon ?? null,
        }),
    },
    { separator: true },
    {
      label: 'Delete Column',
      icon: 'pi pi-trash',
      styleClass: 'text-[var(--destructive)]',
      command: () => this.columnDeleteRequested.emit(this.column().id),
    },
  ]);

  isQuickAdding = signal(false);
  quickTaskTitle = '';

  // --- Virtual scrolling for large columns (50+ tasks) ---
  private static readonly VIRTUAL_SCROLL_THRESHOLD = 50;

  /** Enable virtual scroll only for columns with many tasks */
  readonly useVirtualScroll = computed(
    () => this.tasks().length >= KanbanColumnComponent.VIRTUAL_SCROLL_THRESHOLD,
  );

  /** Card height (including gap) based on density setting */
  readonly cardHeight = computed(() => {
    const d = this.density();
    // compact ~56px, normal ~88px, expanded ~128px (card + 8px gap)
    return d === 'compact' ? 56 : d === 'expanded' ? 128 : 88;
  });

  /** Viewport height for the virtual scroll container */
  readonly viewportHeight = computed(() => {
    // Use a reasonable column height (fills available space)
    // cdk-virtual-scroll-viewport needs an explicit height
    return 600;
  });

  trackByTaskId(_index: number, task: Task): string {
    return task.id;
  }

  getStripeColor(task: Task): string | null {
    if (this.colorBy() === 'priority') return null; // priority uses top-border (default)
    const colorable: ColorableTask = {
      priority: task.priority,
      labels: (task.labels ?? []).map((l) => ({ name: l.name, color: l.color })),
      assignees: (task.assignees ?? []).map((a) => ({ id: a.id, name: a.display_name })),
      project_color: null,
    };
    return resolveCardColor(colorable, this.colorBy());
  }

  readonly wipStatusClass = computed(() => {
    const limit = this.column().wip_limit;
    if (!limit) return 'text-[var(--muted-foreground)]';
    const count = this.tasks().length;
    if (count > limit) return 'text-[var(--destructive)] font-bold';
    if (count === limit) return 'text-amber-500 font-semibold';
    return 'text-[var(--muted-foreground)]';
  });

  isDoneColumn = computed(() => {
    const mapping = this.column().status_mapping;
    return mapping?.done === true;
  });

  isOverWipLimit = computed(() => {
    const limit = this.column().wip_limit;
    if (!limit) return false;
    return this.tasks().length > limit;
  });

  getTaskLockInfo(
    taskId: string,
  ): { user_id: string; user_name: string } | null {
    const lock = this.presenceService.taskLocks().get(taskId);
    if (!lock) return null;
    const currentUserId = this.authService.currentUser()?.id;
    if (lock.user_id === currentUserId) return null;
    return lock;
  }

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

    this.checklistService.markComplete('try_drag_drop');
    try {
      localStorage.setItem('tf_drag_drop_done', '1');
    } catch {
      /* ignore */
    }
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
    if (this.quickSubmitting()) return;
    const title = this.quickTaskTitle.trim();
    if (!title) return;
    this.quickSubmitting.set(true);
    this.quickTaskCreated.emit({ columnId: this.column().id, title });
    this.quickTaskTitle = '';
    this.quickSubmitting.set(false);
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
