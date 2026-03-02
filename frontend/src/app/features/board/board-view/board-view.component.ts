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
import { Subject, takeUntil, switchMap } from 'rxjs';
import {
  CdkDrag,
  CdkDropList,
  CdkDragDrop,
} from '@angular/cdk/drag-drop';

import { Task, TaskService } from '../../../core/services/task.service';
import { BoardService } from '../../../core/services/board.service';
import { TaskGroupWithStats } from '../../../core/services/task-group.service';
import { WebSocketService } from '../../../core/services/websocket.service';

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

import {
  KanbanColumnComponent,
  TaskMoveEvent,
} from '../kanban-column/kanban-column.component';
import {
  BoardToolbarComponent,
  TaskFilters,
  ViewMode,
} from '../board-toolbar/board-toolbar.component';
import { TaskDetailComponent } from '../task-detail/task-detail.component';
import { ListViewComponent } from '../list-view/list-view.component';
import { CalendarViewComponent } from '../calendar-view/calendar-view.component';
import { GanttViewComponent } from '../gantt-view/gantt-view.component';
import { ReportsViewComponent } from '../reports-view/reports-view.component';
import { TimeReportComponent } from '../time-report/time-report.component';
import {
  BulkActionsBarComponent,
  BulkAction,
} from '../bulk-actions/bulk-actions-bar.component';
import { TaskGroupHeaderComponent } from '../task-group-header/task-group-header.component';
import { ShortcutHelpComponent } from '../../../shared/components/shortcut-help/shortcut-help.component';
import { SwimlaneContainerComponent } from '../swimlane-container/swimlane-container.component';
import { GroupByMode, SwimlaneTaskMoveEvent } from './swimlane.types';

import { BoardShortcutsService } from './board-shortcuts.service';
import { BoardBulkActionsService } from './board-bulk-actions.service';
import { BoardStateService } from './board-state.service';
import { BoardWebsocketHandler } from './board-websocket.handler';
import { BoardDragDropHandler } from './board-drag-drop.handler';
import { CardQuickEditService } from './card-quick-edit/card-quick-edit.service';
import { CardQuickEditPopoverComponent } from './card-quick-edit/card-quick-edit-popover.component';
import { UndoService } from '../../../shared/services/undo.service';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { ImportDialogComponent } from '../import-export/import-dialog.component';
import { ExportDialogComponent } from '../import-export/export-dialog.component';
import { Dialog } from 'primeng/dialog';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-board-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
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
    SwimlaneContainerComponent,
    CardQuickEditPopoverComponent,
    Menu,
    ImportDialogComponent,
    ExportDialogComponent,
    Dialog,
    ConfirmDialog,
    InputTextModule,
    InputNumber,
    ButtonModule,
  ],
  providers: [
    BoardShortcutsService,
    BoardBulkActionsService,
    BoardStateService,
    BoardWebsocketHandler,
    BoardDragDropHandler,
    CardQuickEditService,
    ConfirmationService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .board-root {
      height: calc(100vh - var(--nav-height));
      height: calc(100dvh - var(--nav-height));
    }
  `],
  template: `
    <div class="board-root flex flex-col bg-[var(--background)]">
      <!-- Header -->
      <div class="bg-[var(--card)] border-b border-[var(--border)] px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-[var(--foreground)]">
              {{ state.board()?.name || 'Loading...' }}
            </h1>
            @if (state.board()?.description) {
              <p class="text-sm text-[var(--muted-foreground)] mt-1">
                {{ state.board()?.description }}
              </p>
            }
          </div>
          <div class="flex items-center gap-3">
            <!-- Settings Button -->
            <a
              [routerLink]="[
                '/workspace',
                workspaceId,
                'board',
                boardId,
                'settings',
              ]"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)]"
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Settings
            </a>

            <!-- More Menu -->
            <button
              (click)="moreMenu.toggle($event)"
              class="inline-flex items-center justify-center w-9 h-9 text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)]"
            >
              <i class="pi pi-ellipsis-v text-sm"></i>
            </button>
            <p-menu #moreMenu [popup]="true" [model]="moreMenuItems" />

            <!-- Add Group Button -->
            <button
              (click)="onCreateGroup()"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)]"
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Add Group
            </button>

            <!-- New Task Button -->
            <button
              (click)="onCreateTask()"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] bg-[var(--primary)] rounded-md hover:opacity-90"
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
              New Task
            </button>
          </div>
        </div>
      </div>

      <!-- Toolbar -->
      <app-board-toolbar
        [boardId]="boardId"
        [assignees]="state.allAssignees()"
        [labels]="state.allLabels()"
        [viewMode]="viewMode()"
        [density]="state.cardDensity()"
        [groupBy]="state.groupBy()"
        (filtersChanged)="onFiltersChanged($event)"
        (viewModeChanged)="onViewModeChanged($event)"
        (densityChanged)="onDensityChanged($event)"
        (groupByChanged)="onGroupByChanged($event)"
      ></app-board-toolbar>

      <!-- Task Group Headers -->
      @if (state.boardGroups().length > 1) {
        <div
          class="px-4 py-2 bg-[var(--card)] border-b border-[var(--border)] space-y-1"
        >
          @for (group of state.boardGroups(); track group.group.id) {
            <app-task-group-header
              [groupData]="group"
              (nameChange)="onGroupNameChange(group.group.id, $event)"
              (colorChange)="onGroupColorChange(group.group.id, $event)"
              (toggleCollapse)="onGroupToggleCollapse(group)"
              (delete)="onGroupDelete(group.group.id)"
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
          <app-list-view
            [tasks]="state.flatTasks()"
            [loading]="state.listLoading()"
            (taskClicked)="onListTaskClicked($event)"
          ></app-list-view>
        </div>
      } @else if (viewMode() === 'calendar') {
        <!-- Calendar View -->
        <div class="flex-1 overflow-hidden">
          <app-calendar-view
            [boardId]="boardId"
            (taskClicked)="onListTaskClicked($event)"
          ></app-calendar-view>
        </div>
      } @else if (viewMode() === 'gantt') {
        <!-- Gantt Chart View -->
        <div class="flex-1 overflow-hidden">
          <app-gantt-view
            [tasks]="state.ganttTasks()"
            [dependencies]="state.boardDependencies()"
            (taskClicked)="onListTaskClicked($event)"
          ></app-gantt-view>
        </div>
      } @else if (viewMode() === 'reports') {
        <!-- Reports View -->
        <div class="flex-1 overflow-y-auto">
          <app-reports-view [boardId]="boardId"></app-reports-view>
        </div>
      } @else if (viewMode() === 'time-report') {
        <!-- Time Report View -->
        <div class="flex-1 overflow-y-auto">
          <app-time-report [boardId]="boardId"></app-time-report>
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
            [celebratingTaskId]="state.celebratingTaskId()"
            [focusedTaskId]="state.focusedTaskId()"
            [selectedTaskIds]="state.selectedTaskIds()"
            [allColumns]="state.columns()"
            [groupBy]="state.groupBy()"
            [collapsedSwimlaneIds]="state.collapsedSwimlaneIds()"
            (taskMoved)="onSwimlaneTaskMoved($event)"
            (taskClicked)="onTaskClicked($event)"
            (addTaskClicked)="onAddTaskToColumn($event)"
            (selectionToggled)="onSelectionToggled($event)"
            (priorityChanged)="onCardPriorityChanged($event)"
            (titleChanged)="onCardTitleChanged($event)"
            (columnMoveRequested)="onCardColumnMove($event)"
            (duplicateRequested)="onCardDuplicate($event)"
            (deleteRequested)="onCardDelete($event)"
            (swimlaneToggled)="onSwimlaneToggled($event)"
          />
        </div>
      } @else {
        <!-- Kanban Board -->
        <div class="flex-1 overflow-x-auto p-4">
          @if (state.dragSimulationActive()) {
            <div class="fixed top-16 left-1/2 -translate-x-1/2 z-30 bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-full text-sm font-medium shadow-lg pointer-events-none">
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
                (taskMoved)="onTaskMoved($event)"
                (taskClicked)="onTaskClicked($event)"
                (addTaskClicked)="onAddTaskToColumn($event)"
                (selectionToggled)="onSelectionToggled($event)"
                (priorityChanged)="onCardPriorityChanged($event)"
                (titleChanged)="onCardTitleChanged($event)"
                (columnMoveRequested)="onCardColumnMove($event)"
                (duplicateRequested)="onCardDuplicate($event)"
                (deleteRequested)="onCardDelete($event)"
                (quickTaskCreated)="onQuickTaskCreated($event)"
                (collapseToggled)="onColumnCollapseToggled($event)"
                (renameRequested)="onColumnRenameRequested($event)"
                (wipLimitRequested)="onColumnWipLimitRequested($event)"
                (columnDeleteRequested)="onColumnDeleteRequested($event)"
                (iconChangeRequested)="onColumnIconChangeRequested($event)"
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
          (closed)="closeTaskDetail()"
          (taskUpdated)="onTaskUpdated($event)"
        ></app-task-detail>
      }

      <!-- Bulk Actions Bar -->
      @if (state.selectedTaskIds().length > 0) {
        <app-bulk-actions-bar
          [selectedCount]="state.selectedTaskIds().length"
          [columns]="state.columns()"
          [milestones]="state.boardMilestones()"
          [groups]="state.boardGroups()"
          (bulkAction)="onBulkAction($event)"
          (cancelSelection)="clearSelection()"
        ></app-bulk-actions-bar>
      }

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

      <!-- Column Rename Dialog -->
      <p-dialog
        header="Rename Column"
        [(visible)]="showRenameDialog"
        [modal]="true"
        [style]="{ width: '400px' }"
      >
        <div class="flex flex-col gap-3">
          <label class="text-sm font-medium text-[var(--foreground)]"
            >Column name</label
          >
          <input
            pInputText
            [(ngModel)]="renameDialogValue"
            placeholder="Column name"
            class="w-full"
            (keydown.enter)="confirmRename()"
          />
        </div>
        <ng-template #footer>
          <p-button
            label="Cancel"
            severity="secondary"
            [text]="true"
            (onClick)="showRenameDialog = false"
          />
          <p-button
            label="Rename"
            icon="pi pi-check"
            (onClick)="confirmRename()"
            [disabled]="!renameDialogValue.trim()"
          />
        </ng-template>
      </p-dialog>

      <!-- WIP Limit Dialog -->
      <p-dialog
        header="Set WIP Limit"
        [(visible)]="showWipLimitDialog"
        [modal]="true"
        [style]="{ width: '400px' }"
      >
        <div class="flex flex-col gap-3">
          <label class="text-sm font-medium text-[var(--foreground)]">
            Maximum tasks in this column (0 = no limit)
          </label>
          <p-inputNumber
            [(ngModel)]="wipLimitDialogValue"
            [min]="0"
            [max]="999"
            [showButtons]="true"
            placeholder="No limit"
            inputStyleClass="w-full"
          />
        </div>
        <ng-template #footer>
          <p-button
            label="Cancel"
            severity="secondary"
            [text]="true"
            (onClick)="showWipLimitDialog = false"
          />
          <p-button
            label="Save"
            icon="pi pi-check"
            (onClick)="confirmWipLimit()"
          />
        </ng-template>
      </p-dialog>

      <!-- Column Icon Picker Dialog -->
      <p-dialog
        header="Choose Column Icon"
        [(visible)]="showIconPicker"
        [modal]="true"
        [style]="{ width: '320px' }"
      >
        <div class="flex flex-col gap-3">
          <p class="text-sm text-[var(--muted-foreground)]">Select an emoji for this column, or clear to remove it.</p>
          <div class="grid grid-cols-6 gap-2">
            @for (emoji of columnIconOptions; track emoji) {
              <button
                (click)="selectColumnIcon(emoji)"
                class="text-2xl p-2 rounded hover:bg-[var(--muted)] transition-colors text-center"
                [class.ring-2]="iconPickerCurrentIcon === emoji"
                [title]="emoji"
              >{{ emoji }}</button>
            }
          </div>
          <div class="border-t border-[var(--border)] pt-2">
            <button
              (click)="selectColumnIcon(null)"
              class="w-full px-3 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded transition-colors"
            >
              Clear icon
            </button>
          </div>
        </div>
      </p-dialog>

      <!-- Import/Export Dialogs -->
      <app-import-dialog
        [(visible)]="showImportDialog"
        [boardId]="boardId"
        [boardName]="state.board()?.name || ''"
      />
      <app-export-dialog
        [(visible)]="showExportDialog"
        [boardId]="boardId"
        [boardName]="state.board()?.name || ''"
      />

      <!-- Column Delete Confirmation -->
      <p-confirmDialog />

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
  private router = inject(Router);
  private wsService = inject(WebSocketService);
  private shortcutsService = inject(BoardShortcutsService);
  private bulkActionsService = inject(BoardBulkActionsService);
  private wsHandler = inject(BoardWebsocketHandler);
  private dragDrop = inject(BoardDragDropHandler);
  private taskService = inject(TaskService);
  private boardService = inject(BoardService);
  private undoService = inject(UndoService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  readonly state = inject(BoardStateService);
  readonly quickEditService = inject(CardQuickEditService);
  private destroy$ = new Subject<void>();

  workspaceId = '';
  boardId = '';

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

  // Column operation dialogs
  showRenameDialog = false;
  renameDialogColumnId = '';
  renameDialogValue = '';

  showWipLimitDialog = false;
  wipLimitDialogColumnId = '';
  wipLimitDialogValue: number | null = null;

  // Column icon picker
  showIconPicker = false;
  iconPickerColumnId = '';
  iconPickerCurrentIcon: string | null = null;
  readonly columnIconOptions = ['📋', '✅', '🚀', '🐛', '📌', '🎯', '💡', '🔥', '⚡', '🏗️', '🧪', '📦'];

  // Import/Export dialogs
  showImportDialog = false;
  showExportDialog = false;

  // More menu items
  moreMenuItems: MenuItem[] = [];

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
    });

    this.wsService.connect();
    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        this.wsHandler.handleMessage(message);
      });

    this.buildMoreMenuItems();

    this.shortcutsService.registerShortcuts({
      createTask: () => this.onCreateTask(),
      closePanel: () => this.closeTaskDetail(),
      clearSelection: () => this.clearSelection(),
      closeTaskDetail: () => this.closeTaskDetail(),
      getFocusedTaskId: () => this.state.focusedTaskId(),
      setFocusedTaskId: (id) => this.state.focusedTaskId.set(id),
      getSelectedTaskIds: () => this.state.selectedTaskIds(),
      getSelectedTaskId: () => this.state.selectedTaskId(),
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
        const next = densities[(densities.indexOf(current) + 1) % densities.length];
        this.state.setCardDensity(next);
      },
      navigateCardColumn: (dir: -1 | 1) => this.dragDrop.navigateCardColumn(dir),
      pickUpCard: () => this.dragDrop.pickUpCard(),
      moveCardToAdjacentColumn: (dir: -1 | 1) => this.dragDrop.moveCardToAdjacentColumn(dir),
      dropCard: () => this.dragDrop.dropCard(),
      cancelDrag: () => this.dragDrop.cancelDrag(),
      scrollToColumn: (i: number) => this.dragDrop.scrollToColumn(i),
      editFocusedTaskTitle: () => {
        const id = this.state.focusedTaskId();
        if (!id) return;
        const el = document.querySelector<HTMLElement>(`[data-task-id="${id}"] [data-title-edit]`);
        el?.click();
      },
      deleteFocusedTask: () => {
        const id = this.state.focusedTaskId();
        if (id) this.state.deleteTask(id);
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.shortcutsService.unregister();
    this.wsService.send('unsubscribe', { channel: `board:${this.boardId}` });
  }

  getFilteredTasksForColumn(columnId: string): Task[] {
    return this.state.filteredBoardState()[columnId] || [];
  }

  onFiltersChanged(filters: TaskFilters): void {
    this.state.filters.set(filters);
  }

  onDensityChanged(density: 'compact' | 'normal' | 'expanded'): void {
    this.state.setCardDensity(density);
  }

  onViewModeChanged(mode: ViewMode): void {
    this.viewMode.set(mode);
    if (mode === 'list') {
      this.state.loadFlatTasks(this.boardId, this.destroy$);
    } else if (mode === 'gantt') {
      this.state.loadGanttData(this.boardId);
    }
  }

  onListTaskClicked(taskId: string): void {
    this.router.navigate(['/task', taskId]);
  }

  onTaskMoved(event: TaskMoveEvent): void {
    this.dragDrop.onTaskMoved(event);
  }

  onSwimlaneTaskMoved(event: SwimlaneTaskMoveEvent): void {
    this.dragDrop.onSwimlaneTaskMoved(event);
  }

  onGroupByChanged(mode: GroupByMode): void {
    this.state.setGroupBy(mode, this.boardId);
  }

  onSwimlaneToggled(groupKey: string): void {
    this.state.toggleSwimlaneCollapse(groupKey);
  }

  onTaskClicked(task: Task): void {
    this.router.navigate(['/task', task.id]);
  }

  closeTaskDetail(): void {
    this.state.selectedTaskId.set(null);
  }

  onTaskUpdated(task: Task): void {
    this.state.updateTaskInState(task);
  }

  // === Create Task Dialog ===

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

  // === Task Group Operations ===

  onCreateGroup(): void {
    this.showCreateGroupDialog = true;
  }

  onCreateGroupResult(result: CreateTaskGroupDialogResult): void {
    this.state.createGroup(this.boardId, result);
  }

  onGroupNameChange(groupId: string, name: string): void {
    this.state.updateGroupName(this.boardId, groupId, name);
  }

  onGroupColorChange(groupId: string, color: string): void {
    this.state.updateGroupColor(this.boardId, groupId, color);
  }

  onGroupToggleCollapse(group: TaskGroupWithStats): void {
    this.state.toggleGroupCollapse(group);
  }

  onGroupDelete(groupId: string): void {
    this.state.deleteGroup(this.boardId, groupId);
  }

  // === Bulk Operations ===

  clearSelection(): void {
    this.state.clearSelection();
  }

  onBulkAction(action: BulkAction): void {
    this.bulkActionsService.executeBulkAction(
      this.boardId,
      action,
      this.state.selectedTaskIds(),
      {
        onSuccess: () => {
          this.state.clearSelection();
          this.state.loadBoard(this.boardId, this.destroy$);
        },
        onError: (message) => this.state.showError(message),
      },
    );
  }

  // === Card Context Menu Actions ===

  onSelectionToggled(taskId: string): void {
    this.state.toggleTaskSelection(taskId);
  }

  onCardPriorityChanged(event: { taskId: string; priority: string }): void {
    this.state.optimisticUpdateTask(event.taskId, {
      priority: event.priority as Task['priority'],
    });
  }

  onCardTitleChanged(event: { taskId: string; title: string }): void {
    this.state.optimisticUpdateTask(event.taskId, { title: event.title });
  }

  onCardColumnMove(event: { taskId: string; columnId: string }): void {
    const snapshot = structuredClone(this.state.boardState());

    // Optimistic: remove from old column, add to new column
    this.state.boardState.update((state) => {
      const newState: Record<string, Task[]> = {};
      let movedTask: Task | null = null;
      for (const [colId, tasks] of Object.entries(state)) {
        const found = tasks.find((t) => t.id === event.taskId);
        if (found)
          movedTask = { ...found, column_id: event.columnId, position: 'a0' };
        newState[colId] = tasks.filter((t) => t.id !== event.taskId);
      }
      if (movedTask) {
        newState[event.columnId] = [
          ...(newState[event.columnId] || []),
          movedTask,
        ].sort((a, b) => a.position.localeCompare(b.position));
      }
      return newState;
    });

    this.taskService
      .moveTask(event.taskId, { column_id: event.columnId, position: 'a0' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: () => {
          this.state.boardState.set(snapshot);
          this.state.showError('Failed to move task');
        },
      });
  }

  onCardDuplicate(taskId: string): void {
    // Find the task to duplicate
    let originalTask: Task | null = null;
    const currentState = this.state.boardState();
    for (const tasks of Object.values(currentState)) {
      const found = tasks.find((t) => t.id === taskId);
      if (found) {
        originalTask = found;
        break;
      }
    }
    if (!originalTask) return;

    // Optimistic: insert temp duplicate
    const tempId = crypto.randomUUID();
    const tempTask: Task = {
      ...originalTask,
      id: tempId,
      title: `${originalTask.title} (copy)`,
      position: 'zzzzzz',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const snapshot = structuredClone(currentState);
    const origColumnId = originalTask.column_id;
    this.state.boardState.update((state) => {
      const newState = { ...state };
      newState[origColumnId] = [...(newState[origColumnId] || []), tempTask];
      return newState;
    });

    this.taskService
      .duplicateTask(taskId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (realTask) => {
          // Replace temp with real
          this.state.boardState.update((state) => {
            const newState = { ...state };
            const col = newState[realTask.column_id] || [];
            newState[realTask.column_id] = col
              .map((t) => (t.id === tempId ? realTask : t))
              .sort((a, b) => a.position.localeCompare(b.position));
            return newState;
          });
          this.undoService.setMessageService(this.messageService);
          this.undoService.schedule({
            id: `dup-${realTask.id}`,
            summary: 'Task duplicated',
            execute: () => {},
            rollback: () => {
              this.state.deleteTask(realTask.id);
            },
          });
        },
        error: () => {
          this.state.boardState.set(snapshot);
          this.state.showError('Failed to duplicate task');
        },
      });
  }

  onCardDelete(taskId: string): void {
    this.state.deleteTask(taskId);
  }

  onColumnCollapseToggled(columnId: string): void {
    this.state.toggleColumnCollapse(this.boardId, columnId);
  }

  // === Column Operations (PrimeNG Dialogs) ===

  onColumnRenameRequested(columnId: string): void {
    const column = this.state.columns().find((c) => c.id === columnId);
    if (!column) return;
    this.renameDialogColumnId = columnId;
    this.renameDialogValue = column.name;
    this.showRenameDialog = true;
  }

  confirmRename(): void {
    const name = this.renameDialogValue.trim();
    if (!name) return;

    this.boardService
      .updateColumn(this.renameDialogColumnId, { name })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedColumn) => {
          this.state.columns.update((cols) =>
            cols.map((c) => (c.id === updatedColumn.id ? updatedColumn : c)),
          );
        },
        error: () => this.state.showError('Failed to rename column'),
      });

    this.showRenameDialog = false;
  }

  onColumnWipLimitRequested(columnId: string): void {
    const column = this.state.columns().find((c) => c.id === columnId);
    if (!column) return;
    this.wipLimitDialogColumnId = columnId;
    this.wipLimitDialogValue = column.wip_limit;
    this.showWipLimitDialog = true;
  }

  onColumnIconChangeRequested(event: { columnId: string; currentIcon: string | null }): void {
    this.iconPickerColumnId = event.columnId;
    this.iconPickerCurrentIcon = event.currentIcon;
    this.showIconPicker = true;
  }

  selectColumnIcon(icon: string | null): void {
    this.boardService
      .updateColumnIcon(this.iconPickerColumnId, icon)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedColumn) => {
          this.state.columns.update((cols) =>
            cols.map((c) => (c.id === updatedColumn.id ? updatedColumn : c)),
          );
          this.showIconPicker = false;
        },
        error: () => this.state.showError('Failed to update column icon'),
      });
  }

  confirmWipLimit(): void {
    const wipLimit =
      this.wipLimitDialogValue && this.wipLimitDialogValue > 0
        ? this.wipLimitDialogValue
        : null;

    this.boardService
      .updateColumnWipLimit(this.wipLimitDialogColumnId, wipLimit)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedColumn) => {
          this.state.columns.update((cols) =>
            cols.map((c) => (c.id === updatedColumn.id ? updatedColumn : c)),
          );
        },
        error: () => this.state.showError('Failed to update WIP limit'),
      });

    this.showWipLimitDialog = false;
  }

  onColumnDeleteRequested(columnId: string): void {
    const column = this.state.columns().find((c) => c.id === columnId);
    if (!column) return;

    this.confirmationService.confirm({
      message: `Delete column "${column.name}"? Tasks in this column must be moved first.`,
      header: 'Delete Column',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.state.deleteColumn(this.boardId, columnId);
      },
    });
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

  // === More Menu ===

  private buildMoreMenuItems(): void {
    this.moreMenuItems = [
      {
        label: 'Settings',
        icon: 'pi pi-cog',
        command: () =>
          this.router.navigate([
            '/workspace',
            this.workspaceId,
            'board',
            this.boardId,
            'settings',
          ]),
      },
      {
        label: 'Import',
        icon: 'pi pi-upload',
        command: () => (this.showImportDialog = true),
      },
      {
        label: 'Export',
        icon: 'pi pi-download',
        command: () => (this.showExportDialog = true),
      },
      {
        label: 'Share',
        icon: 'pi pi-share-alt',
        command: () =>
          this.router.navigate(
            ['/workspace', this.workspaceId, 'board', this.boardId, 'settings'],
            { queryParams: { tab: 6 } },
          ),
      },
    ];
  }

  // === Card Keyboard Navigation (J/K/Enter) ===

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    this.shortcutsService.handleKeydown(
      event,
      this.viewMode(),
      this.state.focusedTaskId(),
      {
        navigateCard: (direction) => this.dragDrop.navigateCard(direction),
        openFocusedTask: () => this.dragDrop.openFocusedTask(),
        cancelDrag: () => this.dragDrop.cancelDrag(),
      },
    );
  }
}
