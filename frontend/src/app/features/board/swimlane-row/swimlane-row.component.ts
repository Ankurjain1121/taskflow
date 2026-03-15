import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { Task } from '../../../core/services/task.service';
import { Column } from '../../../core/services/board.service';
import { PresenceService } from '../../../core/services/presence.service';
import { AuthService } from '../../../core/services/auth.service';
import { OnboardingChecklistService } from '../../../core/services/onboarding-checklist.service';
import { TaskCardComponent } from '../task-card/task-card.component';
import {
  SwimlaneGroup,
  SwimlaneTaskMoveEvent,
  GroupByMode,
} from '../board-view/swimlane.types';
import {
  CardFields,
  DEFAULT_CARD_FIELDS,
} from '../board-view/board-state.service';
import {
  makeCellId,
  parseCellId,
  NONE_KEY,
} from '../board-view/swimlane-utils';

@Component({
  selector: 'app-swimlane-row',
  standalone: true,
  imports: [CommonModule, CdkDropList, TaskCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex min-w-max border-b border-[var(--border)]">
      <!-- Sticky Left Label -->
      <div
        class="sticky left-0 z-10 flex-shrink-0 w-40 bg-[var(--card)] border-r border-[var(--border)] flex flex-col"
        [style.border-left]="
          swimlaneGroup().color
            ? '3px solid ' + swimlaneGroup().color
            : '3px solid var(--border)'
        "
      >
        <div class="sticky top-0 flex items-center gap-2 px-2 py-3">
          <!-- Collapse toggle -->
          <button
            (click)="toggleCollapse()"
            class="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            [title]="collapsed() ? 'Expand' : 'Collapse'"
          >
            <i
              class="pi text-xs transition-transform duration-200"
              [class.pi-chevron-down]="!collapsed()"
              [class.pi-chevron-right]="collapsed()"
            ></i>
          </button>

          <!-- Avatar or color dot -->
          @if (swimlaneGroup().avatarUrl) {
            <img
              [src]="swimlaneGroup().avatarUrl"
              class="w-6 h-6 rounded-full flex-shrink-0 object-cover"
              [alt]="swimlaneGroup().label"
            />
          } @else if (!swimlaneGroup().isNone && swimlaneGroup().color) {
            <span
              class="w-2.5 h-2.5 rounded-full flex-shrink-0"
              [style.background-color]="swimlaneGroup().color"
            ></span>
          } @else if (!swimlaneGroup().isNone) {
            <div
              class="w-6 h-6 rounded-full flex-shrink-0 bg-[var(--primary)] flex items-center justify-center text-[10px] font-bold text-white"
            >
              {{ getInitials(swimlaneGroup().label) }}
            </div>
          } @else {
            <span
              class="w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 border-dashed border-[var(--muted-foreground)]"
            ></span>
          }

          <!-- Label + count -->
          <div class="min-w-0 flex-1">
            <p
              class="text-xs font-medium text-[var(--foreground)] truncate leading-tight"
            >
              {{ swimlaneGroup().label }}
            </p>
            <p class="text-[10px] text-[var(--muted-foreground)] leading-tight">
              {{ totalCount() }} task{{ totalCount() !== 1 ? 's' : '' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Column Cells -->
      @if (!collapsed()) {
        @for (column of columns(); track column.id) {
          <div
            cdkDropList
            [id]="getCellId(column.id)"
            [cdkDropListData]="tasksForColumn(column.id)"
            [cdkDropListConnectedTo]="connectedListIds()"
            (cdkDropListDropped)="onDrop($event, column.id)"
            class="w-[272px] flex-shrink-0 min-h-[120px] p-2 space-y-2 border-r border-[var(--border)] bg-[var(--background)]"
          >
            @for (task of tasksForColumn(column.id); track task.id) {
              <app-task-card
                [task]="task"
                [density]="density()"
                [cardFields]="cardFields()"
                [isBlocked]="false"
                [isCelebrating]="celebratingTaskId() === task.id"
                [isFocused]="focusedTaskId() === task.id"
                [isSelected]="selectedTaskIds().includes(task.id)"
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
                (taskClicked)="taskClicked.emit($event)"
                (selectionToggled)="selectionToggled.emit($event)"
                (priorityChanged)="priorityChanged.emit($event)"
                (titleChanged)="titleChanged.emit($event)"
                (columnMoveRequested)="columnMoveRequested.emit($event)"
                (duplicateRequested)="duplicateRequested.emit($event)"
                (deleteRequested)="deleteRequested.emit($event)"
              />
            }

            <!-- Empty cell drop zone -->
            @if (tasksForColumn(column.id).length === 0) {
              <div
                class="flex items-center justify-center h-16 rounded-md border-2 border-dashed border-[var(--border)] opacity-40"
              >
                <span class="text-xs text-[var(--muted-foreground)]"
                  >Drop here</span
                >
              </div>
            }
          </div>
        }
      } @else {
        <!-- Collapsed: show per-column counts -->
        @for (column of columns(); track column.id) {
          <div
            class="w-[272px] flex-shrink-0 flex items-center justify-center border-r border-[var(--border)] bg-[var(--muted)] py-2"
          >
            <span class="text-xs text-[var(--muted-foreground)]">
              {{ tasksForColumn(column.id).length }}
            </span>
          </div>
        }
      }
    </div>
  `,
})
export class SwimlaneRowComponent {
  private presenceService = inject(PresenceService);
  private authService = inject(AuthService);
  private checklistService = inject(OnboardingChecklistService);

  swimlaneGroup = input.required<SwimlaneGroup>();
  columns = input.required<Column[]>();
  /** Record<colId, Task[]> for this swimlane row */
  tasksPerColumn = input<Record<string, Task[]>>({});
  /** All cell IDs across all rows for cross-lane DnD */
  connectedListIds = input<string[]>([]);
  celebratingTaskId = input<string | null>(null);
  focusedTaskId = input<string | null>(null);
  selectedTaskIds = input<string[]>([]);
  allColumns = input<Column[]>([]);
  statusTransitions = input<Record<string, string[] | null>>({});
  boardPrefix = input<string | null>(null);
  density = input<'compact' | 'normal' | 'expanded'>('normal');
  cardFields = input<CardFields>(DEFAULT_CARD_FIELDS);
  groupBy = input<GroupByMode>('none');

  taskMoved = output<SwimlaneTaskMoveEvent>();
  taskClicked = output<Task>();
  addTaskClicked = output<string>();
  selectionToggled = output<string>();
  priorityChanged = output<{ taskId: string; priority: string }>();
  titleChanged = output<{ taskId: string; title: string }>();
  columnMoveRequested = output<{ taskId: string; columnId: string }>();
  duplicateRequested = output<string>();
  deleteRequested = output<string>();
  collapseChanged = output<string>();

  readonly collapsed = signal(false);

  readonly totalCount = computed(() =>
    Object.values(this.tasksPerColumn()).reduce(
      (sum, tasks) => sum + tasks.length,
      0,
    ),
  );

  getCellId(colId: string): string {
    return makeCellId(colId, this.swimlaneGroup().key);
  }

  tasksForColumn(colId: string): Task[] {
    return this.tasksPerColumn()[colId] ?? [];
  }

  toggleCollapse(): void {
    this.collapsed.update((v) => !v);
    this.collapseChanged.emit(this.swimlaneGroup().key);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getTaskLockInfo(
    taskId: string,
  ): { user_id: string; user_name: string } | null {
    const lock = this.presenceService.taskLocks().get(taskId);
    if (!lock) return null;
    const currentUserId = this.authService.currentUser()?.id;
    if (lock.user_id === currentUserId) return null;
    return lock;
  }

  onDrop(event: CdkDragDrop<Task[]>, targetColumnId: string): void {
    if (
      event.previousContainer.id === event.container.id &&
      event.previousIndex === event.currentIndex
    ) {
      return;
    }

    const task = event.item.data as Task;
    const sourceListId = event.previousContainer.id;

    // Determine source column and group from the source list ID
    let prevColId: string;
    let fromGroupKey: string;

    if (sourceListId.startsWith('cell_')) {
      const parsed = parseCellId(sourceListId);
      prevColId = parsed.colId;
      fromGroupKey = parsed.groupKey;
    } else if (sourceListId.startsWith('column-')) {
      // Dragged from flat kanban — not expected in swimlane mode, fall back
      prevColId = sourceListId.replace('column-', '');
      fromGroupKey = this.swimlaneGroup().key;
    } else {
      prevColId = task.status_id ?? '';
      fromGroupKey = this.swimlaneGroup().key;
    }

    this.taskMoved.emit({
      task,
      targetColumnId,
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
      previousColumnId: prevColId,
      fromGroupKey,
      toGroupKey: this.swimlaneGroup().key,
      groupBy: this.groupBy(),
    });

    this.checklistService.markComplete('try_drag_drop');
    try {
      localStorage.setItem('tf_drag_drop_done', '1');
    } catch {
      /* ignore */
    }
  }
}
