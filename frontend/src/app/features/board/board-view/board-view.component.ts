import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  HostListener,
  signal,
  viewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { CdkDrag, CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';

import { Task } from '../../../core/services/task.service';
import { Column } from '../../../core/services/board.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { PresenceService } from '../../../core/services/presence.service';

import {
  CreateTaskDialogComponent,
  CreateTaskDialogResult,
} from './create-task-dialog.component';
import {
  CreateColumnDialogComponent,
  CreateColumnDialogResult,
} from './create-column-dialog.component';
import {
  CreateTaskGroupDialogComponent,
  CreateTaskGroupDialogResult,
} from '../create-task-group-dialog/create-task-group-dialog.component';

import { KanbanColumnComponent } from '../kanban-column/kanban-column.component';
import {
  BoardToolbarComponent,
  ViewMode,
} from '../board-toolbar/board-toolbar.component';
import { TaskDetailComponent } from '../task-detail/task-detail.component';
import { ListViewComponent } from '../list-view/list-view.component';
import { CalendarViewComponent } from '../calendar-view/calendar-view.component';
import { GanttViewComponent } from '../gantt-view/gantt-view.component';
import { ReportsViewComponent } from '../reports-view/reports-view.component';
import { TimeReportComponent } from '../time-report/time-report.component';
import { BulkActionsBarComponent } from '../bulk-actions/bulk-actions-bar.component';
import { TaskGroupHeaderComponent } from '../task-group-header/task-group-header.component';
import { ShortcutHelpComponent } from '../../../shared/components/shortcut-help/shortcut-help.component';
import { ShortcutDiscoveryBannerComponent } from '../../../shared/components/shortcut-discovery-banner/shortcut-discovery-banner.component';
import { SwimlaneContainerComponent } from '../swimlane-container/swimlane-container.component';
import { SampleBoardBannerComponent } from '../sample-board-banner/sample-board-banner.component';
import { SpotlightOverlayComponent } from '../../../shared/components/spotlight-overlay/spotlight-overlay.component';
import { BOARD_SPOTLIGHT_STEPS } from './board-spotlight-steps';
import { ContextualHintComponent } from '../../../shared/components/contextual-hint/contextual-hint.component';
import { FeatureHintsService } from '../../../core/services/feature-hints.service';
import { BulkPreviewDialogComponent } from '../bulk-operations/bulk-preview-dialog.component';
import { UndoToastComponent } from '../bulk-operations/undo-toast.component';

import { BoardShortcutsService } from './board-shortcuts.service';
import { BoardBulkActionsService } from './board-bulk-actions.service';
import { BoardStateService } from './board-state.service';
import { BoardFilterService } from './board-filter.service';
import { BoardGroupingService } from './board-grouping.service';
import { BoardMutationsService } from './board-mutations.service';
import { BoardWebsocketHandler } from './board-websocket.handler';
import { BoardDragDropHandler } from './board-drag-drop.handler';
import { CardQuickEditService } from './card-quick-edit/card-quick-edit.service';
import { CardQuickEditPopoverComponent } from './card-quick-edit/card-quick-edit-popover.component';
import { BoardCardOperationsService } from './board-card-operations.service';
import { BoardBulkOperationsHandler } from './board-bulk-operations.handler';
import { BoardColumnDialogsComponent } from './board-column-dialogs.component';
import { BoardViewHeaderComponent } from './board-view-header.component';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-board-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CdkDrag,
    CdkDropList,
    CreateTaskDialogComponent,
    CreateColumnDialogComponent,
    CreateTaskGroupDialogComponent,
    KanbanColumnComponent,
    BoardToolbarComponent,
    TaskDetailComponent,
    ListViewComponent,
    CalendarViewComponent,
    GanttViewComponent,
    ReportsViewComponent,
    TimeReportComponent,
    BulkActionsBarComponent,
    TaskGroupHeaderComponent,
    ShortcutHelpComponent,
    ShortcutDiscoveryBannerComponent,
    SwimlaneContainerComponent,
    SampleBoardBannerComponent,
    SpotlightOverlayComponent,
    ContextualHintComponent,
    CardQuickEditPopoverComponent,
    BulkPreviewDialogComponent,
    UndoToastComponent,
    BoardColumnDialogsComponent,
    BoardViewHeaderComponent,
  ],
  providers: [
    BoardShortcutsService,
    BoardBulkActionsService,
    BoardFilterService,
    BoardGroupingService,
    BoardMutationsService,
    BoardStateService,
    BoardWebsocketHandler,
    BoardDragDropHandler,
    BoardCardOperationsService,
    BoardBulkOperationsHandler,
    CardQuickEditService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .board-root {
        height: calc(100vh - var(--nav-height));
        height: calc(100dvh - var(--nav-height));
      }
    `,
  ],
  template: `
    <div
      class="board-root flex flex-col transition-colors duration-300"
      [style.background]="
        state.board()?.background_color || 'var(--background)'
      "
    >
      <!-- Header -->
      <app-board-view-header
        [boardName]="state.board()?.name || ''"
        [boardDescription]="state.board()?.description ?? null"
        [workspaceId]="workspaceId"
        [boardId]="boardId"
        [menuItems]="columnDialogs()?.moreMenuItems ?? []"
        (createTask)="onCreateTask()"
        (createGroup)="onCreateGroup()"
      />

      <!-- Sample Board Banner -->
      @if (state.board()?.is_sample) {
        <app-sample-board-banner
          [boardId]="boardId"
          [workspaceId]="workspaceId"
          (deleted)="router.navigate(['/dashboard'])"
        />
      }

      <!-- Toolbar -->
      <app-board-toolbar
        [boardId]="boardId"
        [assignees]="state.allAssignees()"
        [labels]="state.allLabels()"
        [viewMode]="viewMode()"
        [density]="state.cardDensity()"
        [groupBy]="state.groupBy()"
        [cardFields]="state.cardFields()"
        (filtersChanged)="state.filters.set($event)"
        (viewModeChanged)="onViewModeChanged($event)"
        (densityChanged)="state.setCardDensity($event)"
        (groupByChanged)="state.setGroupBy($event, boardId)"
        (cardFieldChanged)="state.updateCardField($event.key, $event.value)"
        (cardFieldsReset)="state.resetCardFields()"
      ></app-board-toolbar>

      <!-- Shortcut Discovery Banner (first-visit only) -->
      <app-shortcut-discovery-banner />

      <!-- Task Group Headers -->
      @if (state.boardGroups().length > 1) {
        <div
          class="px-4 py-2 bg-[var(--card)] border-b border-[var(--border)] space-y-1"
        >
          @for (group of state.boardGroups(); track group.group.id) {
            <app-task-group-header
              [groupData]="group"
              (nameChange)="
                state.updateGroupName(boardId, group.group.id, $event)
              "
              (colorChange)="
                state.updateGroupColor(boardId, group.group.id, $event)
              "
              (toggleCollapse)="state.toggleGroupCollapse(group)"
              (delete)="state.deleteGroup(boardId, group.group.id)"
            />
          }
        </div>
      }

      <!-- Board Content -->
      @if (state.loading()) {
        <div class="flex-1 overflow-x-auto p-4">
          <div class="flex gap-2 h-full">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="flex-shrink-0 w-[272px]">
                <div class="widget-card p-3">
                  <div
                    class="skeleton skeleton-text w-24 mb-4"
                    style="height: 14px;"
                  ></div>
                  <div class="space-y-3">
                    @for (j of [1, 2, 3]; track j) {
                      <div
                        class="bg-[var(--muted)] rounded-lg p-3 border border-[var(--border)]"
                      >
                        <div class="skeleton skeleton-text w-full mb-2"></div>
                        <div class="skeleton skeleton-text w-3/4 mb-3"></div>
                        <div class="flex items-center gap-2">
                          <div class="skeleton w-16 h-5 rounded-full"></div>
                          <div class="flex-1"></div>
                          <div class="skeleton skeleton-circle w-6 h-6"></div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      } @else if (viewMode() === 'list') {
        <!-- List View -->
        <div class="flex-1 overflow-y-auto">
          @defer (when viewMode() === 'list') {
            <app-list-view
              [tasks]="state.flatTasks()"
              [loading]="state.listLoading()"
              (taskClicked)="router.navigate(['/task', $event])"
            ></app-list-view>
          } @placeholder {
            <div
              class="flex-1 flex items-center justify-center py-12 text-[var(--muted-foreground)]"
            >
              <i class="pi pi-spin pi-spinner text-xl"></i>
            </div>
          }
        </div>
      } @else if (viewMode() === 'calendar') {
        <!-- Calendar View -->
        <div class="flex-1 overflow-hidden">
          @defer (when viewMode() === 'calendar') {
            <app-calendar-view
              [boardId]="boardId"
              (taskClicked)="router.navigate(['/task', $event])"
            ></app-calendar-view>
          } @placeholder {
            <div
              class="flex-1 flex items-center justify-center py-12 text-[var(--muted-foreground)]"
            >
              <i class="pi pi-spin pi-spinner text-xl"></i>
            </div>
          }
        </div>
      } @else if (viewMode() === 'gantt') {
        <!-- Gantt Chart View -->
        <div class="flex-1 overflow-hidden">
          @defer (when viewMode() === 'gantt') {
            <app-gantt-view
              [tasks]="state.ganttTasks()"
              [dependencies]="state.boardDependencies()"
              (taskClicked)="router.navigate(['/task', $event])"
            ></app-gantt-view>
          } @placeholder {
            <div
              class="flex-1 flex items-center justify-center py-12 text-[var(--muted-foreground)]"
            >
              <i class="pi pi-spin pi-spinner text-xl"></i>
            </div>
          }
        </div>
      } @else if (viewMode() === 'reports') {
        <!-- Reports View -->
        <div class="flex-1 overflow-y-auto">
          @defer (when viewMode() === 'reports') {
            <app-reports-view [boardId]="boardId"></app-reports-view>
          } @placeholder {
            <div
              class="flex-1 flex items-center justify-center py-12 text-[var(--muted-foreground)]"
            >
              <i class="pi pi-spin pi-spinner text-xl"></i>
            </div>
          }
        </div>
      } @else if (viewMode() === 'time-report') {
        <!-- Time Report View -->
        <div class="flex-1 overflow-y-auto">
          @defer (when viewMode() === 'time-report') {
            <app-time-report [boardId]="boardId"></app-time-report>
          } @placeholder {
            <div
              class="flex-1 flex items-center justify-center py-12 text-[var(--muted-foreground)]"
            >
              <i class="pi pi-spin pi-spinner text-xl"></i>
            </div>
          }
        </div>
      } @else if (state.groupBy() !== 'none') {
        <!-- Swimlane View -->
        <div class="flex-1 overflow-auto">
          <app-swimlane-container
            [swimlaneGroups]="state.swimlaneGroups()"
            [swimlaneState]="state.swimlaneState()"
            [columns]="state.columns()"
            [boardPrefix]="state.board()?.prefix ?? null"
            [density]="state.cardDensity()"
            [cardFields]="state.cardFields()"
            [celebratingTaskId]="state.celebratingTaskId()"
            [focusedTaskId]="state.focusedTaskId()"
            [selectedTaskIds]="state.selectedTaskIds()"
            [allColumns]="state.columns()"
            [groupBy]="state.groupBy()"
            [collapsedSwimlaneIds]="state.collapsedSwimlaneIds()"
            (taskMoved)="dragDrop.onSwimlaneTaskMoved($event)"
            (taskClicked)="router.navigate(['/task', $event.id])"
            (addTaskClicked)="onAddTaskToColumn($event)"
            (selectionToggled)="onSelectionToggled($event)"
            (priorityChanged)="
              state.optimisticUpdateTask($event.taskId, {
                priority: $any($event.priority),
              })
            "
            (titleChanged)="
              state.optimisticUpdateTask($event.taskId, { title: $event.title })
            "
            (columnMoveRequested)="cardOps.onCardColumnMove($event, destroy$)"
            (duplicateRequested)="cardOps.onCardDuplicate($event, destroy$)"
            (deleteRequested)="state.deleteTask($event)"
            (swimlaneToggled)="state.toggleSwimlaneCollapse($event)"
          />
        </div>
      } @else {
        <!-- Kanban Board -->
        <div class="flex-1 overflow-x-auto p-4">
          @if (state.dragSimulationActive()) {
            <div
              class="fixed top-16 left-1/2 -translate-x-1/2 z-30 bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-full text-sm font-medium shadow-lg pointer-events-none"
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
            @for (column of state.columns(); track column.id) {
              <app-kanban-column
                cdkDrag
                [cdkDragData]="column"
                [attr.data-column-index]="$index"
                [column]="column"
                [dragSimActive]="state.dragSimulationActive()"
                [dragSimCurrentColId]="state.dragSimulationCurrentColumnId()"
                [tasks]="getFilteredTasksForColumn(column.id)"
                [connectedLists]="state.connectedColumnIds()"
                [celebratingTaskId]="state.celebratingTaskId()"
                [focusedTaskId]="state.focusedTaskId()"
                [selectedTaskIds]="state.selectedTaskIds()"
                [allColumns]="state.columns()"
                [boardPrefix]="state.board()?.prefix ?? null"
                [isCollapsed]="state.isColumnCollapsed(column.id)"
                [density]="state.cardDensity()"
                [cardFields]="state.cardFields()"
                (taskMoved)="dragDrop.onTaskMoved($event)"
                (taskClicked)="router.navigate(['/task', $event.id])"
                (addTaskClicked)="onAddTaskToColumn($event)"
                (selectionToggled)="onSelectionToggled($event)"
                (priorityChanged)="
                  state.optimisticUpdateTask($event.taskId, {
                    priority: $any($event.priority),
                  })
                "
                (titleChanged)="
                  state.optimisticUpdateTask($event.taskId, {
                    title: $event.title,
                  })
                "
                (columnMoveRequested)="
                  cardOps.onCardColumnMove($event, destroy$)
                "
                (duplicateRequested)="cardOps.onCardDuplicate($event, destroy$)"
                (deleteRequested)="state.deleteTask($event)"
                (quickTaskCreated)="onQuickTaskCreated($event)"
                (collapseToggled)="state.toggleColumnCollapse(boardId, $event)"
                (renameRequested)="columnDialogs()?.openRenameDialog($event)"
                (wipLimitRequested)="
                  columnDialogs()?.openWipLimitDialog($event)
                "
                (columnDeleteRequested)="
                  columnDialogs()?.confirmDeleteColumn($event)
                "
                (iconChangeRequested)="columnDialogs()?.openIconPicker($event)"
              ></app-kanban-column>
            }

            <!-- Add Column Button -->
            <div class="flex-shrink-0">
              <button
                (click)="onAddColumn()"
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
      }

      <!-- Task Detail Panel -->
      @if (state.selectedTaskId()) {
        <app-task-detail
          [taskId]="state.selectedTaskId()!"
          [workspaceId]="workspaceId"
          [boardId]="boardId"
          (closed)="state.selectedTaskId.set(null)"
          (taskUpdated)="state.updateTaskInState($event)"
        ></app-task-detail>
      }

      <!-- Bulk Actions Bar -->
      @if (state.selectedTaskIds().length > 0) {
        <app-bulk-actions-bar
          [selectedCount]="state.selectedTaskIds().length"
          [atLimit]="state.selectionAtLimit()"
          [columns]="state.columns()"
          [milestones]="state.boardMilestones()"
          [groups]="state.boardGroups()"
          (bulkAction)="bulkOps.onBulkAction($event)"
          (cancelSelection)="state.clearSelection()"
          (exportCsv)="bulkOps.onExportSelectedCsv()"
        ></app-bulk-actions-bar>
      }

      <!-- Bulk Preview Dialog -->
      <app-bulk-preview-dialog
        [visible]="bulkOps.showBulkPreview()"
        [data]="bulkOps.bulkPreviewData()"
        (confirmed)="onBulkPreviewConfirmed()"
        (cancelled)="bulkOps.onBulkPreviewCancelled()"
      />

      <!-- Undo Toast -->
      <app-undo-toast />

      <!-- Card Quick-Edit Popover -->
      @if (quickEditService.isOpen() && quickEditService.anchorRect()) {
        <div
          class="fixed inset-0 z-40"
          (click)="quickEditService.close()"
          aria-hidden="true"
        ></div>
        <div
          class="fixed z-50"
          [style.left.px]="quickEditService.anchorRect()!.left"
          [style.top.px]="quickEditService.anchorRect()!.bottom + 4"
        >
          <app-card-quick-edit-popover />
        </div>
      }

      <!-- Keyboard Shortcuts Help -->
      <app-shortcut-help></app-shortcut-help>

      <!-- Inline Create Task Dialog -->
      <app-create-task-dialog
        [(visible)]="showCreateTaskDialog"
        [boardId]="boardId"
        [columnId]="createTaskDialogColumnId"
        [columnName]="createTaskDialogColumnName"
        [members]="createTaskDialogMembers"
        [labels]="createTaskDialogLabels"
        [milestones]="createTaskDialogMilestones"
        [groups]="createTaskDialogGroups"
        (created)="onCreateTaskResult($event)"
      />

      <!-- Inline Create Column Dialog -->
      <app-create-column-dialog
        [(visible)]="showCreateColumnDialog"
        (created)="onCreateColumnResult($event)"
      />

      <!-- Inline Create Group Dialog -->
      <app-create-task-group-dialog
        [(visible)]="showCreateGroupDialog"
        (created)="onCreateGroupResult($event)"
      />

      <!-- Column Dialogs (rename, WIP, icon, duplicate, import/export, confirm) -->
      <app-board-column-dialogs
        [boardId]="boardId"
        [workspaceId]="workspaceId"
        [boardName]="state.board()?.name || ''"
        [destroy$]="destroy$"
        (columnUpdated)="onColumnUpdated($event)"
        (boardDuplicated)="onBoardDuplicated($event)"
      />

      <!-- Spotlight Overlay (first-run tour) -->
      <app-spotlight-overlay
        [steps]="spotlightSteps"
        [active]="spotlightActive()"
        (completed)="spotlightActive.set(false)"
        (skipped)="spotlightActive.set(false)"
      />

      <!-- Contextual Hints -->
      @if (
        hintsService.boardVisitCount() >= 2 &&
        !hintsService.isHintDismissed('board-shortcuts')
      ) {
        <app-contextual-hint
          hintId="board-shortcuts"
          message="Press ? to see all keyboard shortcuts. Navigate the board without touching your mouse!"
          shortcutKey="?"
          [delayMs]="3000"
        />
      }
      @if (
        hintsService.boardVisitCount() >= 3 &&
        !hintsService.isHintDismissed('board-cmd-k')
      ) {
        <app-contextual-hint
          hintId="board-cmd-k"
          message="Press Ctrl+K to open the command palette for quick actions and search."
          shortcutKey="Ctrl+K"
          [delayMs]="5000"
        />
      }

      <!-- ARIA live region for keyboard announcements -->
      <div aria-live="polite" class="sr-only" id="board-announcements"></div>

      <!-- Snackbar for errors -->
      @if (state.errorMessage()) {
        <div
          class="fixed bottom-4 right-4 bg-[var(--destructive)] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3"
        >
          <span>{{ state.errorMessage() }}</span>
          <button (click)="state.clearError()" class="hover:opacity-70">
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class BoardViewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private wsService = inject(WebSocketService);
  private shortcutsService = inject(BoardShortcutsService);
  private wsHandler = inject(BoardWebsocketHandler);
  readonly dragDrop = inject(BoardDragDropHandler);
  readonly cardOps = inject(BoardCardOperationsService);
  readonly bulkOps = inject(BoardBulkOperationsHandler);
  private presenceService = inject(PresenceService);
  private messageService = inject(MessageService);
  readonly state = inject(BoardStateService);
  readonly quickEditService = inject(CardQuickEditService);
  readonly hintsService = inject(FeatureHintsService);
  private undoToast = viewChild(UndoToastComponent);
  private bulkPreviewDialog = viewChild(BulkPreviewDialogComponent);
  readonly columnDialogs = viewChild(BoardColumnDialogsComponent);
  readonly destroy$ = new Subject<void>();

  workspaceId = '';
  boardId = '';

  spotlightActive = signal(false);
  readonly spotlightSteps = BOARD_SPOTLIGHT_STEPS;

  viewMode = signal<ViewMode>('kanban');
  boardToolbar = viewChild(BoardToolbarComponent);

  // Dialog visibility state
  showCreateTaskDialog = false;
  createTaskDialogColumnId = '';
  createTaskDialogColumnName = '';
  createTaskDialogMembers: { id: string; name: string; avatar_url?: string }[] =
    [];
  createTaskDialogLabels: { id: string; name: string; color: string }[] = [];
  createTaskDialogMilestones: { id: string; name: string; color: string }[] =
    [];
  createTaskDialogGroups: { id: string; name: string; color: string }[] = [];

  showCreateColumnDialog = false;
  showCreateGroupDialog = false;

  constructor() {
    effect(() => {
      this.quickEditService.setBoardMembers(this.state.boardMembers());
    });
    effect(() => {
      this.quickEditService.setAvailableLabels(this.state.allLabels());
    });
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.workspaceId = params['workspaceId'];
      this.boardId = params['boardId'];
      this.state.loadBoard(this.boardId, this.destroy$);
      this.presenceService.joinBoard(this.boardId);
      this.columnDialogs()?.buildMoreMenuItems();
    });

    this.wsService.connect();
    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        this.wsHandler.handleMessage(
          message as unknown as Record<string, unknown>,
        );
      });

    // Feature hints: track board visits and trigger spotlight
    this.hintsService.incrementBoardVisit();
    if (!this.hintsService.hasSeenSpotlight()) {
      // Delay to let the board render first
      setTimeout(() => this.spotlightActive.set(true), 500);
    }

    this.shortcutsService.setViewModeGetter(() => this.viewMode());
    this.shortcutsService.registerShortcuts({
      createTask: () => this.onCreateTask(),
      setViewMode: (mode) => this.viewMode.set(mode),
      onViewModeChanged: (mode) => this.onViewModeChanged(mode),
      focusFilter: () => this.boardToolbar()?.focusSearchInput(),
      clearFilters: () =>
        this.state.filters.set({
          search: '',
          priorities: [],
          assigneeIds: [],
          dueDateStart: null,
          dueDateEnd: null,
          labelIds: [],
          overdue: false,
        }),
      cycleDensity: () => {
        const densities: ('compact' | 'normal' | 'expanded')[] = [
          'compact',
          'normal',
          'expanded',
        ];
        const current = this.state.cardDensity();
        const next =
          densities[(densities.indexOf(current) + 1) % densities.length];
        this.state.setCardDensity(next);
      },
    });
  }

  ngOnDestroy(): void {
    this.presenceService.leaveBoard();
    this.destroy$.next();
    this.destroy$.complete();
    this.shortcutsService.unregister();
    this.wsService.send('unsubscribe', { channel: `board:${this.boardId}` });
  }

  getFilteredTasksForColumn(columnId: string): Task[] {
    return this.state.filteredBoardState()[columnId] || [];
  }

  onViewModeChanged(mode: ViewMode): void {
    this.viewMode.set(mode);
    if (mode === 'list') {
      this.state.loadFlatTasks(this.boardId, this.destroy$);
    } else if (mode === 'gantt') {
      this.state.loadGanttData(this.boardId);
    }
  }

  onCreateTask(): void {
    const firstColumn = this.state.columns()[0];
    if (firstColumn) {
      this.onAddTaskToColumn(firstColumn.id);
    }
  }

  onAddTaskToColumn(columnId: string): void {
    const column = this.state.columns().find((c) => c.id === columnId);
    if (!column) return;

    this.createTaskDialogColumnId = columnId;
    this.createTaskDialogColumnName = column.name;
    this.createTaskDialogMembers = this.state.boardMembers().map((m) => ({
      id: m.user_id,
      name: m.name || m.email || 'Unknown',
      avatar_url: m.avatar_url ?? undefined,
    }));
    this.createTaskDialogLabels = this.state.allLabels().map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
    }));
    this.createTaskDialogMilestones = this.state.boardMilestones().map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
    }));
    this.createTaskDialogGroups = this.state.boardGroups().map((g) => ({
      id: g.group.id,
      name: g.group.name,
      color: g.group.color,
    }));
    this.showCreateTaskDialog = true;
  }

  onCreateTaskResult(result: CreateTaskDialogResult): void {
    this.state.createTask(this.boardId, this.createTaskDialogColumnId, result);
  }

  // === Create Column Dialog ===

  onAddColumn(): void {
    this.showCreateColumnDialog = true;
  }

  onCreateColumnResult(result: CreateColumnDialogResult): void {
    this.state.createColumn(this.boardId, result);
  }

  onCreateGroup(): void {
    this.showCreateGroupDialog = true;
  }

  onCreateGroupResult(result: CreateTaskGroupDialogResult): void {
    this.state.createGroup(this.boardId, result);
  }

  onBulkPreviewConfirmed(): void {
    this.bulkOps.onBulkPreviewConfirmed(this.boardId, this.destroy$, {
      getUndoToast: () => this.undoToast(),
      resetPreviewDialog: () => this.bulkPreviewDialog()?.resetExecuting(),
    });
  }

  onSelectionToggled(taskId: string): void {
    const capReached = this.state.toggleTaskSelection(taskId);
    if (capReached) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Selection limit reached',
        detail: 'You can select up to 500 tasks at a time.',
        life: 3000,
      });
    }
  }

  onColumnUpdated(column: Column): void {
    this.state.columns.update((cols) =>
      cols.map((c) => (c.id === column.id ? column : c)),
    );
  }

  onBoardDuplicated(newBoard: { id: string }): void {
    this.router.navigate([
      '/workspace',
      this.workspaceId,
      'board',
      newBoard.id,
    ]);
  }

  onColumnDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.state.reorderColumn(event.previousIndex, event.currentIndex);
  }

  onQuickTaskCreated(event: { columnId: string; title: string }): void {
    this.state.createTask(this.boardId, event.columnId, {
      title: event.title,
      description: '',
      priority: 'medium',
    } as CreateTaskDialogResult);
  }

  // === Keyboard Navigation ===

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    this.shortcutsService.handleKeydown(event);
  }
}
