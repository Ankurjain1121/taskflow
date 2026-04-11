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
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

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
import { ActivityFeedComponent } from '../activity-feed/activity-feed.component';
import { MoveToProjectDialogComponent } from './move-to-project-dialog.component';

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
    BulkPreviewDialogComponent,
    UndoToastComponent,
    ProjectColumnDialogsComponent,
    ProjectViewHeaderComponent,
    ProjectLoadingSkeletonComponent,
    ProjectViewOverlaysComponent,
    ActivityFeedComponent,
    MoveToProjectDialogComponent,
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
  styleUrl: './project-view.component.css',
  templateUrl: './project-view.component.html',
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
  private wsContext = inject(WorkspaceContextService);
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

  showCreateColumnDialog = false;
  showCreateGroupDialog = false;

  // Signal used to tell ListViewComponent which task row should open in inline title edit mode.
  inlineEditTaskId = signal<string | null>(null);

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
      const savedView = qp['view'] || localStorage.getItem(`taskbolt_view_${this.boardId}`);
      if (savedView && ['kanban', 'list', 'calendar', 'gantt', 'reports', 'time-report', 'activity'].includes(savedView)) {
        this.viewMode.set(savedView as ViewMode);
      }

      this.state.loadBoard(this.boardId, this.destroy$);
      this.presenceService.joinBoard(this.boardId);
      this.columnDialogs()?.buildMoreMenuItems();

      // Load view-specific data on init
      if (this.viewMode() === 'list') {
        this.state.loadFlatTasks(this.boardId, this.destroy$);
      } else if (this.viewMode() === 'gantt') {
        this.state.loadGanttData(this.boardId);
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

    // Feature hints: track board visits
    this.hintsService.incrementBoardVisit();

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

  navigateToDashboard(): void {
    const wsId = this.wsContext.activeWorkspaceId();
    if (wsId) {
      this.router.navigate(['/workspace', wsId, 'dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  onViewModeChanged(mode: ViewMode): void {
    this.viewMode.set(mode);

    // Persist viewMode to localStorage and URL
    localStorage.setItem(`taskbolt_view_${this.boardId}`, mode);
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
    this.showCreateTaskDialog = true;
  }

  onCreateTaskResult(result: CreateTaskDialogResult): void {
    this.state.createTask(this.boardId, this.createTaskDialogColumnId, result);
  }

  // === Create Column Dialog ===

  navigateToTask(taskId: string): void {
    this.router.navigate([
      '/workspace',
      this.workspaceId,
      'project',
      this.boardId,
      'task',
      taskId,
    ]);
  }

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

  /** Ctrl+Shift+ArrowUp / ArrowDown handler from ListViewComponent. */
  onCreateTaskRelative(focusedTaskId: string, direction: 'above' | 'below'): void {
    const newId = this.listEdit.createTaskRelative(
      focusedTaskId,
      direction,
      this.boardId,
      this.destroy$,
    );
    if (newId) {
      this.inlineEditTaskId.set(newId);
    }
  }

  onInlineEditCancelled(taskId: string): void {
    // Clear the parent-side signal so future edits on the same id re-trigger the effect.
    if (this.inlineEditTaskId() === taskId) {
      this.inlineEditTaskId.set(null);
    }
    this.listEdit.onInlineEditCancelled(taskId, this.boardId, this.destroy$);
  }

  // === Keyboard Navigation ===

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    this.shortcutsService.handleKeydown(event);
  }
}
