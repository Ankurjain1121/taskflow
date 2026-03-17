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
import { Column } from '../../../core/services/project.service';
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

import { ProjectKanbanBoardComponent } from './project-kanban-board.component';
import {
  ProjectToolbarComponent,
  ViewMode,
} from '../project-toolbar/project-toolbar.component';
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
import { SampleProjectBannerComponent } from '../sample-project-banner/sample-board-banner.component';
import { PROJECT_SPOTLIGHT_STEPS } from './project-spotlight-steps';
import { FeatureHintsService } from '../../../core/services/feature-hints.service';
import { BulkPreviewDialogComponent } from '../bulk-operations/bulk-preview-dialog.component';
import { UndoToastComponent } from '../bulk-operations/undo-toast.component';

import { ProjectShortcutsService } from './project-shortcuts.service';
import { ProjectBulkActionsService } from './project-bulk-actions.service';
import { ProjectStateService } from './project-state.service';
import { ProjectFilterService } from './project-filter.service';
import { ProjectGroupingService } from './project-grouping.service';
import { ProjectMutationsService } from './project-mutations.service';
import { ProjectWebsocketHandler } from './project-websocket.handler';
import { ProjectDragDropHandler } from './project-drag-drop.handler';
import { ProjectListEditHandler } from './project-list-edit.handler';
import { CardQuickEditService } from './card-quick-edit/card-quick-edit.service';
import { ProjectCardOperationsService } from './project-card-operations.service';
import { ProjectBulkOperationsHandler } from './project-bulk-operations.handler';
import { ProjectColumnDialogsComponent } from './project-column-dialogs.component';
import { ProjectViewHeaderComponent } from './project-view-header.component';
import { ProjectViewOverlaysComponent } from './project-view-overlays.component';
import { ProjectLoadingSkeletonComponent } from './project-loading-skeleton.component';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-project-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CreateTaskDialogComponent,
    CreateColumnDialogComponent,
    CreateTaskGroupDialogComponent,
    ProjectKanbanBoardComponent,
    ProjectToolbarComponent,
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
    SampleProjectBannerComponent,
    SpotlightOverlayComponent,
    ContextualHintComponent,
    CardQuickEditPopoverComponent,
    BulkPreviewDialogComponent,
    UndoToastComponent,
    ProjectColumnDialogsComponent,
    ProjectViewHeaderComponent,
    ProjectLoadingSkeletonComponent,
    ProjectViewOverlaysComponent,
  ],
  providers: [
    ProjectShortcutsService,
    ProjectBulkActionsService,
    ProjectFilterService,
    ProjectGroupingService,
    ProjectMutationsService,
    ProjectStateService,
    ProjectWebsocketHandler,
    ProjectDragDropHandler,
    ProjectListEditHandler,
    ProjectCardOperationsService,
    ProjectBulkOperationsHandler,
    CardQuickEditService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .project-root {
        height: calc(100vh - var(--nav-height));
        height: calc(100dvh - var(--nav-height));
      }
    `,
  ],
  template: `
    <div
      class="project-root flex flex-col transition-colors duration-300"
      [style.background]="
        state.board()?.background_color || 'var(--background)'
      "
    >
      <!-- Header -->
      <app-project-view-header
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
        <app-sample-project-banner
          [boardId]="boardId"
          [workspaceId]="workspaceId"
          (deleted)="router.navigate(['/dashboard'])"
        />
      }

      <!-- Toolbar -->
      <app-project-toolbar
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
      ></app-project-toolbar>

      <!-- Shortcut Discovery Banner (first-visit only) -->
      <app-shortcut-discovery-banner />

      <!-- Task Group Headers (kanban/other views only, not list view) -->
      @if (state.boardGroups().length > 1 && viewMode() !== 'list') {
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
        <app-project-loading-skeleton />
      } @else if (viewMode() === 'list') {
        <!-- List View -->
        <div class="flex-1 overflow-y-auto">
          @defer (when viewMode() === 'list') {
            <app-list-view
              [tasks]="state.flatTasks()"
              [groups]="state.boardGroups()"
              [loading]="state.listLoading()"
              [columns]="state.columns()"
              [projectId]="boardId"
              (taskClicked)="state.selectedTaskId.set($event)"
              (titleChanged)="listEdit.onTitleChanged($event, boardId, destroy$)"
              (priorityChanged)="listEdit.onPriorityChanged($event, boardId, destroy$)"
              (statusChanged)="listEdit.onStatusChanged($event, boardId, destroy$)"
              (dueDateChanged)="listEdit.onDueDateChanged($event, boardId, destroy$)"
              (groupToggled)="state.toggleGroupCollapse($event)"
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
              (taskClicked)="state.selectedTaskId.set($event)"
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
              (taskClicked)="state.selectedTaskId.set($event)"
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
      } @else if (viewMode() === 'kanban' && state.groupBy() !== 'none') {
        <!-- Swimlane View (kanban with grouping) -->
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
            [statusTransitions]="state.statusTransitions()"
            [groupBy]="state.groupBy()"
            [collapsedSwimlaneIds]="state.collapsedSwimlaneIds()"
            (taskMoved)="dragDrop.onSwimlaneTaskMoved($event)"
            (taskClicked)="state.selectedTaskId.set($event.id)"
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
      } @else if (viewMode() === 'kanban') {
        <!-- Kanban Board -->
        <app-project-kanban-board
          [columns]="state.columns()"
          [filteredBoardState]="state.filteredBoardState()"
          [dragSimulationActive]="state.dragSimulationActive()"
          [dragSimulationCurrentColumnId]="state.dragSimulationCurrentColumnId()"
          [celebratingTaskId]="state.celebratingTaskId()"
          [focusedTaskId]="state.focusedTaskId()"
          [selectedTaskIds]="state.selectedTaskIds()"
          [connectedColumnIds]="state.connectedColumnIds()"
          [statusTransitions]="state.statusTransitions()"
          [boardPrefix]="state.board()?.prefix ?? null"
          [collapsedColumnIds]="state.collapsedColumnIds()"
          [density]="state.cardDensity()"
          [cardFields]="state.cardFields()"
          (taskMoved)="dragDrop.onTaskMoved($event)"
          (taskClicked)="state.selectedTaskId.set($event.id)"
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
          (columnMoveRequested)="cardOps.onCardColumnMove($event, destroy$)"
          (duplicateRequested)="cardOps.onCardDuplicate($event, destroy$)"
          (deleteRequested)="state.deleteTask($event)"
          (quickTaskCreated)="onQuickTaskCreated($event)"
          (collapseToggled)="state.toggleColumnCollapse(boardId, $event)"
          (renameRequested)="columnDialogs()?.openRenameDialog($event)"
          (wipLimitRequested)="columnDialogs()?.openWipLimitDialog($event)"
          (columnDeleteRequested)="columnDialogs()?.confirmDeleteColumn($event)"
          (iconChangeRequested)="columnDialogs()?.openIconPicker($event)"
          (columnDrop)="onColumnDrop($event)"
          (addColumn)="onAddColumn()"
        />
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
      <app-project-column-dialogs
        [boardId]="boardId"
        [workspaceId]="workspaceId"
        [boardName]="state.board()?.name || ''"
        [destroy$]="destroy$"
        (columnUpdated)="onColumnUpdated($event)"
        (boardDuplicated)="onBoardDuplicated($event)"
      />

      <!-- Overlays: Quick-edit, Spotlight, Hints, Error Snackbar -->
      <app-project-view-overlays
        [spotlightSteps]="spotlightSteps"
        [spotlightActive]="spotlightActive()"
        (spotlightDone)="spotlightActive.set(false)"
      />
    </div>
  `,
})
export class ProjectViewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private wsService = inject(WebSocketService);
  private shortcutsService = inject(ProjectShortcutsService);
  private wsHandler = inject(ProjectWebsocketHandler);
  readonly dragDrop = inject(ProjectDragDropHandler);
  readonly listEdit = inject(ProjectListEditHandler);
  readonly cardOps = inject(ProjectCardOperationsService);
  readonly bulkOps = inject(ProjectBulkOperationsHandler);
  private presenceService = inject(PresenceService);
  private messageService = inject(MessageService);
  readonly state = inject(ProjectStateService);
  readonly quickEditService = inject(CardQuickEditService);
  readonly hintsService = inject(FeatureHintsService);
  private undoToast = viewChild(UndoToastComponent);
  private bulkPreviewDialog = viewChild(BulkPreviewDialogComponent);
  readonly columnDialogs = viewChild(ProjectColumnDialogsComponent);
  readonly destroy$ = new Subject<void>();

  workspaceId = '';
  boardId = '';

  spotlightActive = signal(false);
  readonly spotlightSteps = PROJECT_SPOTLIGHT_STEPS;

  viewMode = signal<ViewMode>('list');
  boardToolbar = viewChild(ProjectToolbarComponent);

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
      this.quickEditService.setProjectMembers(this.state.projectMembers());
    });
    effect(() => {
      this.quickEditService.setAvailableLabels(this.state.allLabels());
    });
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.workspaceId = params['workspaceId'];
      this.boardId = params['projectId'];

      // Restore viewMode from query params or localStorage
      const qp = this.route.snapshot.queryParams;
      const savedView = qp['view'] || localStorage.getItem(`taskflow_view_${this.boardId}`);
      if (savedView && ['kanban', 'list', 'calendar', 'gantt', 'reports', 'time-report'].includes(savedView)) {
        this.viewMode.set(savedView as ViewMode);
      }

      this.state.loadBoard(this.boardId, this.destroy$);
      this.presenceService.joinBoard(this.boardId);
      this.columnDialogs()?.buildMoreMenuItems();

      // Load flat tasks if starting in list view
      if (this.viewMode() === 'list') {
        this.state.loadFlatTasks(this.boardId, this.destroy$);
      }
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
    this.wsService.send('unsubscribe', { channel: `project:${this.boardId}` });
  }

  onViewModeChanged(mode: ViewMode): void {
    this.viewMode.set(mode);

    // Persist viewMode to localStorage and URL
    localStorage.setItem(`taskflow_view_${this.boardId}`, mode);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: mode },
      queryParamsHandling: 'merge',
    });

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
    this.createTaskDialogMembers = this.state.projectMembers().map((m) => ({
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
      'project',
      newBoard.id,
    ]);
  }

  onColumnDrop(event: { previousIndex: number; currentIndex: number }): void {
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
