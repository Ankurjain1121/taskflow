import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import {
  CdkDropList,
  CdkDrag,
  CdkDragDrop,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import {
  EisenhowerService,
  EisenhowerMatrixResponse,
  EisenhowerTask,
  EisenhowerQuadrant,
  EisenhowerFilters,
} from '../../../core/services/eisenhower.service';
import { TaskService, TaskPriority } from '../../../core/services/task.service';
import {
  WorkspaceService,
  Workspace,
} from '../../../core/services/workspace.service';
import { BoardService } from '../../../core/services/board.service';
import { EisenhowerTaskCardComponent } from './eisenhower-task-card.component';

interface QuadrantConfig {
  key: EisenhowerQuadrant;
  title: string;
  subtitle: string;
  bgClass: string;
  borderColor: string;
  coaching: string;
  actionLabel?: string;
}

const QUADRANT_MAP: Record<
  EisenhowerQuadrant,
  { urgency: boolean; importance: boolean }
> = {
  do_first: { urgency: true, importance: true },
  schedule: { urgency: false, importance: true },
  delegate: { urgency: true, importance: false },
  eliminate: { urgency: false, importance: false },
};

@Component({
  selector: 'app-eisenhower-matrix',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ConfirmDialog,
    CdkDropList,
    CdkDrag,
    EisenhowerTaskCardComponent,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--background)]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-[var(--card-foreground)]">
              Eisenhower Matrix
            </h1>
            <p class="text-sm text-[var(--muted-foreground)] mt-1">
              Prioritize your tasks by urgency and importance. Drag tasks
              between quadrants to override.
            </p>
          </div>
          <button
            (click)="resetAllOverrides()"
            class="inline-flex items-center gap-2 px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            [disabled]="loading()"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Auto-Sort
          </button>
        </div>

        <!-- Filter bar -->
        <div
          class="mb-6 flex flex-wrap items-center gap-3 bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-3"
        >
          <!-- Workspace filter -->
          <div class="flex items-center gap-2">
            <label
              for="ws-filter"
              class="text-xs font-medium text-[var(--muted-foreground)]"
              >Workspace</label
            >
            <select
              id="ws-filter"
              [ngModel]="selectedWorkspaceId()"
              (ngModelChange)="onWorkspaceChange($event)"
              class="text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">All</option>
              @for (ws of workspaces(); track ws.id) {
                <option [value]="ws.id">{{ ws.name }}</option>
              }
            </select>
          </div>

          <!-- Board filter (conditional on workspace selection) -->
          @if (selectedWorkspaceId()) {
            <div class="flex items-center gap-2">
              <label
                for="board-filter"
                class="text-xs font-medium text-[var(--muted-foreground)]"
                >Board</label
              >
              <select
                id="board-filter"
                [ngModel]="selectedBoardId()"
                (ngModelChange)="onBoardChange($event)"
                class="text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="">All boards</option>
                @for (board of boards(); track board.id) {
                  <option [value]="board.id">{{ board.name }}</option>
                }
              </select>
            </div>
          }

          <!-- Separator -->
          <div class="h-6 w-px bg-[var(--border)]"></div>

          <!-- Daily Focus toggle -->
          <button
            (click)="toggleDailyFocus()"
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors"
            [class]="
              dailyFocus()
                ? 'bg-primary text-primary-foreground'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/80'
            "
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
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            Daily Focus
          </button>

          <!-- Active filter count -->
          @if (activeFilterCount() > 0) {
            <button
              (click)="clearFilters()"
              class="ml-auto text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline transition-colors"
            >
              Clear filters
            </button>
          }
        </div>

        <!-- Loading State -->
        @if (loading()) {
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            @for (i of [1, 2, 3, 4]; track i) {
              <div
                class="bg-[var(--card)] rounded-lg border-2 border-[var(--border)] p-6"
              >
                <div class="skeleton skeleton-text w-32 mb-2"></div>
                <div class="skeleton skeleton-text w-48 mb-4"></div>
                <div class="space-y-2">
                  @for (j of [1, 2, 3]; track j) {
                    <div class="skeleton skeleton-card h-16"></div>
                  }
                </div>
              </div>
            }
          </div>
        } @else if (matrix()) {
          <!-- 2x2 Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            @for (quadrant of quadrants; track quadrant.key) {
              <div
                class="rounded-lg border-2 p-6 transition-all"
                [class]="quadrant.bgClass + ' ' + quadrant.borderColor"
              >
                <!-- Quadrant Header -->
                <div class="mb-4 pb-4 border-b border-[var(--border)]">
                  <h2
                    class="text-lg font-semibold text-[var(--card-foreground)]"
                  >
                    {{ quadrant.title }}
                  </h2>
                  <p class="text-sm text-[var(--muted-foreground)] mt-1">
                    {{ quadrant.subtitle }}
                  </p>
                  <p class="text-xs text-[var(--muted-foreground)] mt-2 italic">
                    {{ quadrant.coaching }}
                  </p>
                  <div class="mt-2 flex items-center justify-between">
                    <span
                      class="text-xs font-medium text-[var(--muted-foreground)]"
                    >
                      {{ getTasksByQuadrant(quadrant.key).length }} tasks
                    </span>
                    @if (quadrant.actionLabel) {
                      <button
                        class="text-xs font-medium text-primary hover:text-primary"
                        (click)="performQuadrantAction(quadrant.key)"
                      >
                        {{ quadrant.actionLabel }}
                      </button>
                    }
                  </div>
                </div>

                <!-- Tasks List (drop zone) -->
                <div
                  cdkDropList
                  [id]="'quadrant-' + quadrant.key"
                  [cdkDropListData]="getTasksByQuadrant(quadrant.key)"
                  [cdkDropListConnectedTo]="allDropListIds"
                  (cdkDropListDropped)="onDrop($event, quadrant.key)"
                  class="space-y-2 max-h-96 overflow-y-auto min-h-[4rem]"
                >
                  @for (
                    task of getTasksByQuadrant(quadrant.key);
                    track task.id
                  ) {
                    <div cdkDrag class="cursor-grab active:cursor-grabbing">
                      <div
                        class="bg-[var(--muted)] border-2 border-dashed border-[var(--border)] rounded-lg p-3"
                        *cdkDragPlaceholder
                      ></div>
                      <app-eisenhower-task-card
                        [task]="task"
                        (priorityChanged)="onPriorityChange($event)"
                      />
                    </div>
                  } @empty {
                    <div
                      class="text-center py-8 text-[var(--muted-foreground)]"
                    >
                      <p class="text-sm">No tasks in this quadrant</p>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
    <p-confirmDialog />
  `,
  styles: [
    `
      @reference "tailwindcss";
      .skeleton {
        @apply animate-pulse rounded;
        background: var(--muted);
      }
      .skeleton-text {
        @apply h-4;
      }
      .skeleton-card {
        @apply h-24;
      }
      .cdk-drag-preview {
        @apply shadow-lg rounded-lg opacity-90;
      }
      .cdk-drag-animating {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }
      .cdk-drop-list-dragging .cdk-drag {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }
    `,
  ],
})
export class EisenhowerMatrixComponent implements OnInit {
  private eisenhowerService = inject(EisenhowerService);
  private taskService = inject(TaskService);
  private workspaceService = inject(WorkspaceService);
  private boardService = inject(BoardService);
  private confirmationService = inject(ConfirmationService);

  loading = signal(false);
  matrix = signal<EisenhowerMatrixResponse | null>(null);

  // Filter state
  workspaces = signal<Workspace[]>([]);
  boards = signal<{ id: string; name: string }[]>([]);
  selectedWorkspaceId = signal('');
  selectedBoardId = signal('');
  dailyFocus = signal(false);

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.selectedWorkspaceId()) count++;
    if (this.selectedBoardId()) count++;
    if (this.dailyFocus()) count++;
    return count;
  });

  allDropListIds = [
    'quadrant-do_first',
    'quadrant-schedule',
    'quadrant-delegate',
    'quadrant-eliminate',
  ];

  quadrants: QuadrantConfig[] = [
    {
      key: 'do_first',
      title: 'Do First',
      subtitle: 'Urgent & Important',
      bgClass: 'bg-red-500/5 dark:bg-red-500/10',
      borderColor: 'border-red-300 dark:border-red-400/50',
      coaching: 'Do these tasks immediately. They require your attention now.',
    },
    {
      key: 'schedule',
      title: 'Schedule',
      subtitle: 'Not Urgent & Important',
      bgClass: 'bg-yellow-500/5 dark:bg-yellow-500/10',
      borderColor: 'border-yellow-300 dark:border-yellow-400/50',
      coaching:
        "Plan when you'll do these. They're important but not pressing.",
    },
    {
      key: 'delegate',
      title: 'Delegate',
      subtitle: 'Urgent & Not Important',
      bgClass: 'bg-orange-500/5 dark:bg-orange-500/10',
      borderColor: 'border-orange-300 dark:border-orange-400/50',
      coaching: 'Can someone else handle these? Delegate if possible.',
      actionLabel: 'Reassign',
    },
    {
      key: 'eliminate',
      title: 'Eliminate',
      subtitle: 'Not Urgent & Not Important',
      bgClass: 'bg-[var(--muted)]/50',
      borderColor: 'border-[var(--border)]',
      coaching: 'Consider removing these from your list entirely.',
      actionLabel: 'Archive',
    },
  ];

  ngOnInit() {
    this.loadWorkspaces();
    this.loadMatrix();
  }

  async loadMatrix() {
    this.loading.set(true);
    try {
      const filters: EisenhowerFilters = {};
      if (this.selectedWorkspaceId()) {
        filters.workspace_id = this.selectedWorkspaceId();
      }
      if (this.selectedBoardId()) {
        filters.board_id = this.selectedBoardId();
      }
      if (this.dailyFocus()) {
        filters.daily = true;
      }
      const matrix = await firstValueFrom(
        this.eisenhowerService.getMatrix(filters),
      );
      this.matrix.set(matrix || null);
    } catch {
      // Matrix will show empty state
    } finally {
      this.loading.set(false);
    }
  }

  onWorkspaceChange(workspaceId: string) {
    this.selectedWorkspaceId.set(workspaceId);
    this.selectedBoardId.set('');
    this.boards.set([]);
    if (workspaceId) {
      this.loadBoards(workspaceId);
    }
    this.loadMatrix();
  }

  onBoardChange(boardId: string) {
    this.selectedBoardId.set(boardId);
    this.loadMatrix();
  }

  toggleDailyFocus() {
    this.dailyFocus.update((v) => !v);
    this.loadMatrix();
  }

  clearFilters() {
    this.selectedWorkspaceId.set('');
    this.selectedBoardId.set('');
    this.dailyFocus.set(false);
    this.boards.set([]);
    this.loadMatrix();
  }

  private loadWorkspaces() {
    this.workspaceService.list().subscribe({
      next: (list) => this.workspaces.set(list),
    });
  }

  private loadBoards(workspaceId: string) {
    this.boardService.listBoards(workspaceId).subscribe({
      next: (list) =>
        this.boards.set(list.map((b) => ({ id: b.id, name: b.name }))),
    });
  }

  getTasksByQuadrant(quadrant: EisenhowerQuadrant): EisenhowerTask[] {
    const matrix = this.matrix();
    if (!matrix) return [];
    return matrix[quadrant] || [];
  }

  onPriorityChange(event: { taskId: string; priority: string }) {
    this.taskService
      .updateTask(event.taskId, { priority: event.priority as TaskPriority })
      .subscribe({
        next: () => this.loadMatrix(),
      });
  }

  onDrop(
    event: CdkDragDrop<EisenhowerTask[]>,
    targetQuadrant: EisenhowerQuadrant,
  ) {
    if (event.previousContainer === event.container) return;

    const task = event.previousContainer.data[event.previousIndex];
    const sourceQuadrantId = event.previousContainer.id;
    const sourceQuadrant = sourceQuadrantId.replace(
      'quadrant-',
      '',
    ) as EisenhowerQuadrant;

    // Optimistic update: move the task in the local state
    const currentMatrix = this.matrix();
    if (!currentMatrix) return;

    const updatedMatrix = { ...currentMatrix };
    const sourceList = [...updatedMatrix[sourceQuadrant]];
    const targetList = [...updatedMatrix[targetQuadrant]];

    transferArrayItem(
      sourceList,
      targetList,
      event.previousIndex,
      event.currentIndex,
    );

    updatedMatrix[sourceQuadrant] = sourceList;
    updatedMatrix[targetQuadrant] = targetList;
    this.matrix.set(updatedMatrix);

    // Call API to persist the override
    const { urgency, importance } = QUADRANT_MAP[targetQuadrant];
    this.eisenhowerService
      .updateTaskOverride(task.id, urgency, importance)
      .subscribe({
        error: () => {
          // Revert on error
          this.matrix.set(currentMatrix);
        },
      });
  }

  resetAllOverrides() {
    this.confirmationService.confirm({
      message:
        'Reset all manual overrides? Tasks will return to auto-computed quadrants.',
      header: 'Confirm Auto-Sort',
      icon: 'pi pi-refresh',
      acceptLabel: 'Reset',
      rejectLabel: 'Cancel',
      accept: async () => {
        try {
          await firstValueFrom(this.eisenhowerService.resetAllOverrides());
          await this.loadMatrix();
        } catch {
          // Reset failed silently - matrix keeps current state
        }
      },
    });
  }

  async performQuadrantAction(quadrant: EisenhowerQuadrant) {
    if (quadrant === 'eliminate') {
      const tasks = this.getTasksByQuadrant('eliminate');
      if (tasks.length === 0) return;

      this.confirmationService.confirm({
        message: `Archive all ${tasks.length} task(s) in the Eliminate quadrant?`,
        header: 'Confirm Archive',
        icon: 'pi pi-trash',
        acceptLabel: 'Archive All',
        rejectLabel: 'Cancel',
        accept: async () => {
          for (const task of tasks) {
            try {
              await firstValueFrom(this.taskService.deleteTask(task.id));
            } catch {
              // Skip failed deletions
            }
          }
          await this.loadMatrix();
        },
      });
    } else if (quadrant === 'delegate') {
      this.confirmationService.confirm({
        message:
          'Reassign functionality is not yet implemented. Please reassign tasks individually from the task detail page.',
        header: 'Not Available',
        icon: 'pi pi-info-circle',
        acceptLabel: 'OK',
        rejectVisible: false,
      });
    }
  }
}
