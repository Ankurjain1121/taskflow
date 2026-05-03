import {
  Component,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
  HostListener,
  effect,
  ViewChild,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, switchMap, of, catchError, EMPTY } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import {
  TaskService,
  Task,
  TaskPriority,
  Assignee,
  Watcher,
  TaskReminder,
  UpdateTaskRequest,
  MoveTaskRequest,
} from '../../core/services/task.service';
import { TaskCompletionService } from '../../core/services/task-completion.service';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService, Board, Column } from '../../core/services/project.service';
import {
  WorkspaceService,
  Workspace,
  MemberSearchResult,
} from '../../core/services/workspace.service';
import { SubtaskListComponent } from '../project/subtask-list/subtask-list.component';
import { CommentListComponent } from '../tasks/components/comment-list/comment-list.component';
import { ActivityTimelineComponent } from '../tasks/components/activity-timeline/activity-timeline.component';
import { TaskDetailSidebarComponent } from './task-detail-sidebar.component';
import { TaskDetailHeaderComponent } from './task-detail-header.component';
import { RecentItemsService } from '../../core/services/recent-items.service';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import {
  CrmService,
  CrmLinksForTask,
  CrmLinkedEntity,
  CrmEntityType,
} from '../../core/services/crm.service';
import {
  CrmEntityPickerComponent,
  CrmLinkedEvent,
} from '../../shared/components/crm-entity-picker/crm-entity-picker.component';

@Component({
  selector: 'app-task-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    Tooltip,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    SubtaskListComponent,
    CommentListComponent,
    ActivityTimelineComponent,
    TaskDetailSidebarComponent,
    TaskDetailHeaderComponent,
    CrmEntityPickerComponent,
    Toast,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        overflow-y: auto;
        background: var(--background);
      }
      .breadcrumb-link {
        color: var(--muted-foreground);
        transition: color 0.15s;
      }
      .breadcrumb-link:hover {
        color: var(--primary);
      }
      .main-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
      }
      .crm-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.625rem;
        border-radius: 9999px;
        font-size: 0.8125rem;
        background: color-mix(in srgb, var(--primary) 10%, transparent);
        color: var(--foreground);
        border: 1px solid transparent;
      }
    `,
  ],
  template: `
    <p-toast />
    <!-- Top Bar: Back + Breadcrumbs -->
    <div
      class="sticky top-0 z-10 border-b"
      style="
        background: var(--card);
        border-color: var(--border);
      "
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <button
          (click)="goBack()"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors"
          style="
            color: var(--muted-foreground);
            background: var(--muted);
          "
          pTooltip="Go back"
          aria-label="Go back"
        >
          <i class="pi pi-arrow-left text-xs"></i>
          Back
          <kbd class="ml-1.5 px-1.5 py-0.5 text-[0.625rem] font-mono rounded" style="background: var(--border); color: var(--muted-foreground)">Esc</kbd>
        </button>

        @if (board() && workspace()) {
          <div
            class="flex items-center gap-1.5 text-sm"
            style="color: var(--muted-foreground)"
          >
            <a
              [routerLink]="['/workspace', workspace()!.id]"
              class="breadcrumb-link"
              >{{ workspace()!.name }}</a
            >
            <i class="pi pi-chevron-right text-xs opacity-50"></i>
            <a
              [routerLink]="[
                '/workspace',
                workspace()!.id,
                'project',
                board()!.id,
              ]"
              class="breadcrumb-link"
              >{{ board()!.name }}</a
            >
            @if (parentTask()) {
              <i class="pi pi-chevron-right text-xs opacity-50"></i>
              <a
                [routerLink]="[
                  '/workspace',
                  workspace()!.id,
                  'project',
                  board()!.id,
                  'task',
                  parentTask()!.id,
                ]"
                class="breadcrumb-link"
                >{{ parentTask()!.title }}</a
              >
            }
            <i class="pi pi-chevron-right text-xs opacity-50"></i>
            <span style="color: var(--foreground)">{{
              task()?.title || 'Task'
            }}</span>
          </div>
        }
      </div>
    </div>

    @if (loading()) {
      <!-- Loading skeleton -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-4">
            <div class="main-card p-6 space-y-4">
              <div
                class="h-8 w-2/3 rounded animate-pulse"
                style="background: var(--border)"
              ></div>
              <div
                class="h-4 w-1/2 rounded animate-pulse"
                style="background: var(--border)"
              ></div>
              <div
                class="h-32 w-full rounded animate-pulse"
                style="background: var(--border)"
              ></div>
            </div>
          </div>
          <div class="space-y-4">
            <div
              class="rounded-xl p-5 space-y-3"
              style="
                background: var(--card);
                border: 1px solid var(--border);
              "
            >
              @for (i of [1, 2, 3, 4, 5]; track i) {
                <div
                  class="h-6 rounded animate-pulse"
                  style="background: var(--border)"
                ></div>
              }
            </div>
          </div>
        </div>
      </div>
    } @else if (error()) {
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center" role="alert">
        <i
          class="pi pi-exclamation-circle text-4xl mb-4"
          style="color: var(--destructive)"
        ></i>
        <h2 class="text-lg font-semibold mb-2" style="color: var(--foreground)">
          Task not found
        </h2>
        <p class="text-sm mb-4" style="color: var(--muted-foreground)">
          {{ error() }}
        </p>
        <button
          pButton
          label="Go Back"
          (click)="goBack()"
          severity="secondary"
        ></button>
      </div>
    } @else if (task()) {
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Main Content (Left 2/3) -->
          <div class="lg:col-span-2 space-y-5">
            @if (parentTask()) {
              <div
                class="flex items-center gap-1.5 text-sm px-1 py-1"
                style="color: var(--muted-foreground)"
              >
                <i class="pi pi-arrow-up-right text-xs"></i>
                <span>Child of</span>
                <a
                  [routerLink]="['/task', parentTask()!.id]"
                  class="breadcrumb-link font-medium"
                  style="color: var(--primary)"
                  >{{ parentTask()!.title }}</a
                >
              </div>
            }

            <!-- Title + Description Card -->
            <div class="main-card">
              <app-task-detail-header
                [title]="editTitle()"
                [description]="editDescription()"
                (titleSaved)="onTitleSaved($event)"
                (descriptionSaved)="onDescriptionSaved($event)"
              />
            </div>

            <!-- Subtasks -->
            <div class="main-card p-5">
              <app-subtask-list
                [taskId]="taskId()"
                [boardColumns]="columns()"
                [projectId]="board()?.id || ''"
                [workspaceId]="workspace()?.id || ''"
                (childrenLoaded)="childrenCount.set($event)"
              />
            </div>

            <!-- Linked CRM -->
            <div class="main-card p-5">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-xs font-semibold uppercase tracking-wide" style="color: var(--muted-foreground)">
                  <i class="pi pi-link mr-1.5"></i>Linked CRM
                </h3>
                @if (!crmLoading() && !showCrmSearch()) {
                  <button
                    (click)="showCrmSearch.set(true)"
                    class="text-xs px-2 py-1 rounded transition-colors"
                    style="color: var(--primary)"
                    type="button"
                  >
                    <i class="pi pi-plus text-xs mr-1"></i>Search
                  </button>
                }
                @if (showCrmSearch()) {
                  <button
                    (click)="showCrmSearch.set(false)"
                    class="text-xs px-2 py-1 rounded transition-colors"
                    style="color: var(--muted-foreground)"
                    type="button"
                  >
                    <i class="pi pi-times text-xs"></i>
                  </button>
                }
              </div>

              @if (showCrmSearch()) {
                <div class="mb-3">
                  <app-crm-entity-picker (linked)="onCrmLink($event)" />
                </div>
              }

              @if (crmLoading()) {
                <div class="flex flex-wrap gap-2">
                  @for (i of [1, 2]; track i) {
                    <div class="h-7 w-32 rounded-full animate-pulse" style="background: var(--border)"></div>
                  }
                </div>
              } @else if (crmError()) {
                <p class="text-sm" style="color: var(--muted-foreground)">
                  <i class="pi pi-wifi text-xs mr-1" style="color: var(--destructive)"></i>
                  Couldn't reach CRM.
                  @if (crmCachedAt()) {
                    Showing cached results from {{ crmCachedMinutesAgo() }} min ago.
                  }
                </p>
              } @else if (allCrmLinks().length === 0) {
                <div class="flex items-center gap-3">
                  <p class="text-sm" style="color: var(--muted-foreground)">
                    No CRM links — search contacts, companies, or deals
                  </p>
                  @if (!showCrmSearch()) {
                    <button
                      (click)="showCrmSearch.set(true)"
                      class="text-xs px-2.5 py-1 rounded-md border transition-colors flex-shrink-0"
                      style="border-color: var(--border); color: var(--muted-foreground)"
                      type="button"
                    >
                      Search
                    </button>
                  }
                </div>
              } @else {
                @if (crmPartialFailed() > 0) {
                  <div
                    class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full mb-2"
                    style="background: color-mix(in srgb, var(--destructive) 10%, transparent); color: var(--destructive)"
                  >
                    <i class="pi pi-exclamation-triangle text-xs"></i>
                    {{ crmPartialFailed() }} of {{ allCrmLinks().length + crmPartialFailed() }} failed to load —
                    <button (click)="loadCrmLinks()" class="underline font-medium" type="button">Retry</button>
                  </div>
                }
                <div class="flex flex-wrap gap-1.5">
                  @for (link of allCrmLinks(); track link.entity_id) {
                    <span class="crm-pill">
                      <i [class]="crmEntityIcon(link.entity_type)" style="font-size: 0.7rem; opacity: 0.7"></i>
                      <span>{{ link.name }}</span>
                      <span style="opacity: 0.4; font-size: 0.75rem">·</span>
                      <span style="font-size: 0.6875rem; opacity: 0.65; text-transform: capitalize">{{ link.entity_type }}</span>
                      @if (link.stage) {
                        <span style="opacity: 0.4; font-size: 0.75rem">·</span>
                        <span style="font-size: 0.6875rem; opacity: 0.65">{{ link.stage }}</span>
                      }
                      <button
                        (click)="onCrmUnlink(link)"
                        class="ml-0.5 opacity-40 hover:opacity-100 transition-opacity"
                        type="button"
                        aria-label="Unlink"
                      >
                        <i class="pi pi-times" style="font-size: 0.6rem"></i>
                      </button>
                    </span>
                  }
                </div>
              }
            </div>

            <!-- Comments / Activity Tabs -->
            @defer (on viewport) {
            <div class="main-card">
              <p-tabs value="0">
                <p-tablist>
                  <p-tab value="0">
                    <span class="uppercase tracking-wider text-xs font-semibold"><i class="pi pi-comments mr-1.5"></i>
                    Comments</span>
                  </p-tab>
                  <p-tab value="1">
                    <span class="uppercase tracking-wider text-xs font-semibold"><i class="pi pi-history mr-1.5"></i>
                    Activity</span>
                  </p-tab>
                </p-tablist>
                <p-tabpanels>
                  <p-tabpanel value="0">
                    <div class="p-4">
                      @if (board() && workspace()) {
                        <app-comment-list
                          [taskId]="taskId()"
                          [boardId]="board()!.id"
                          [workspaceId]="workspace()!.id"
                        />
                      }
                    </div>
                  </p-tabpanel>
                  <p-tabpanel value="1">
                    <div class="p-4">
                      <app-activity-timeline [taskId]="taskId()" />
                    </div>
                  </p-tabpanel>
                </p-tabpanels>
              </p-tabs>
            </div>
            } @placeholder {
              <div class="h-48"></div>
            }
          </div>

          <!-- Sidebar (Right 1/3) -->
          <app-task-detail-sidebar
            [task]="task()!"
            [columns]="columns()"
            [workspaceId]="workspace()?.id || ''"
            [reminders]="reminders()"
            [parentTask]="parentTask()"
            [childrenCount]="childrenCount()"
            (statusChanged)="onStatusChange($event)"
            (priorityChanged)="onPriorityChange($event)"
            (dueDateChanged)="onDueDateChange($event)"
            (assigneeAdded)="onAssign($event)"
            (assigneeRemoved)="onUnassign($event)"
            (watcherAdded)="onWatch($event)"
            (watcherRemoved)="onUnwatch($event)"
            (watchSelf)="onWatchSelf()"
            (labelRemoved)="onRemoveLabel($event)"
            (deleteRequested)="onDelete()"
            (reminderSet)="onSetReminder($event)"
            (reminderRemoved)="onRemoveReminder($event)"
            (estimatedHoursChanged)="onEstimatedHoursChange($event)"
            (budgetFieldChanged)="onBudgetFieldChange($event)"
          />
        </div>
      </div>
    }
  `,
})
export class TaskDetailPageComponent {
  @ViewChild(TaskDetailHeaderComponent)
  private headerComponent?: TaskDetailHeaderComponent;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private taskService = inject(TaskService);
  private taskCompletion = inject(TaskCompletionService);
  private projectService = inject(ProjectService);
  private workspaceService = inject(WorkspaceService);
  private authService = inject(AuthService);
  private recentItemsService = inject(RecentItemsService);
  private wsContext = inject(WorkspaceContextService);
  private messageService = inject(MessageService);
  private crmService = inject(CrmService);

  private params = toSignal(this.route.params);
  readonly taskId = computed(() => this.params()?.['taskId'] ?? '');
  task = signal<Task | null>(null);
  board = signal<Board | null>(null);
  workspace = signal<Workspace | null>(null);
  columns = signal<Column[]>([]);
  reminders = signal<TaskReminder[]>([]);
  parentTask = signal<Task | null>(null);
  childrenCount = signal(0);
  loading = signal(true);
  error = signal<string | null>(null);

  editTitle = signal('');
  editDescription = signal('');

  crmLinks = signal<CrmLinksForTask | null>(null);
  crmLoading = signal(false);
  crmError = signal(false);
  crmCachedAt = signal<string | null>(null);
  showCrmSearch = signal(false);

  allCrmLinks = computed<CrmLinkedEntity[]>(() => {
    const links = this.crmLinks();
    if (!links) return [];
    return [
      ...links.contacts,
      ...links.companies,
      ...links.deals,
    ];
  });

  crmPartialFailed = computed(() => this.crmLinks()?.failed_count ?? 0);

  constructor() {
    effect(() => {
      const id = this.taskId();
      if (id) {
        this.loadTask(id);
      }
    });
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.headerComponent?.isEditing) return;
    event.preventDefault();
    this.goBack();
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      const wsId = this.wsContext.activeWorkspaceId();
      if (wsId) {
        this.router.navigate(['/workspace', wsId, 'dashboard']);
      } else {
        this.router.navigate(['/dashboard']);
      }
    }
  }

  // --- Data Loading (Item 13: nested subscribe replaced with switchMap/pipe) ---

  private loadTask(taskId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.taskService.getTask(taskId).subscribe({
      next: (task) => {
        this.task.set(task);
        this.editTitle.set(task.title);
        this.editDescription.set(task.description ?? '');

        const boardId = task.project_id ?? (task as unknown as { board_id?: string }).board_id;
        if (boardId) {
          this.loadBoardContext(boardId);
        }

        this.loadReminders(taskId);
        this.loadParentTask(task);
        this.loadCrmLinks();
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          err.status === 404
            ? 'This task does not exist or has been deleted.'
            : 'Failed to load task. Please try again.',
        );
        this.loading.set(false);
      },
    });
  }

  /**
   * Loads board, columns, and workspace in a flat RxJS pipeline
   * instead of nesting .subscribe() calls.
   */
  private loadBoardContext(boardId: string): void {
    forkJoin({
      board: this.projectService.getBoard(boardId),
      columns: this.projectService.listColumns(boardId),
    })
      .pipe(
        switchMap(({ board, columns }) => {
          this.board.set(board);
          this.columns.set(columns);

          return this.workspaceService.get(board.workspace_id).pipe(
            switchMap((ws) => {
              this.workspace.set(ws);
              // Record task view for recent items
              const t = this.task();
              if (t) {
                this.recentItemsService.recordTaskView({
                  id: t.id,
                  title: t.title,
                  boardName: board.name,
                  workspaceId: board.workspace_id,
                  workspaceName: ws.name,
                  boardId: board.id,
                });
              }
              return of(undefined);
            }),
            catchError(() => {
              // Non-critical: workspace load failure
              return EMPTY;
            }),
          );
        }),
        catchError(() => {
          // Non-critical: board context load failure
          return EMPTY;
        }),
      )
      .subscribe();
  }

  private loadParentTask(task: Task): void {
    if (task.parent_task_id) {
      this.taskService.getTask(task.parent_task_id).subscribe({
        next: (parent) => this.parentTask.set(parent),
        error: () => this.parentTask.set(null),
      });
    } else {
      this.parentTask.set(null);
    }
  }

  // --- Title / Description save handlers ---

  onTitleSaved(title: string): void {
    this.editTitle.set(title);
    this.updateTask({ title });
  }

  onDescriptionSaved(desc: string): void {
    this.editDescription.set(desc);
    const description = desc || null;
    this.updateTask({ description });
  }

  // --- Field updates ---

  onPriorityChange(priority: TaskPriority): void {
    this.updateTask({ priority } as UpdateTaskRequest);
  }

  onStatusChange(statusId: string): void {
    const t = this.task();
    if (!t) return;

    const snapshot = { ...t };
    const newCol = this.columns().find((c) => c.id === statusId);
    const isDone = newCol?.status_mapping?.done === true;
    this.task.set({
      ...t,
      status_id: statusId,
      status_name: newCol?.name ?? t.status_name,
      status_color: newCol?.color ?? t.status_color,
    });

    this.taskCompletion
      .moveToStatus(t.id, statusId, 'a0', { isDone, silent: true })
      .subscribe({
        next: (updated) => {
          this.task.set({
            ...this.task()!,
            ...updated,
            assignees: updated.assignees ?? t.assignees,
            labels: updated.labels ?? t.labels,
          });
        },
        error: () => {
          this.task.set(snapshot);
          this.messageService.add({
            severity: 'error',
            summary: 'Update failed',
            detail: 'Could not change task status.',
            life: 4000,
          });
        },
      });
  }

  onDueDateChange(date: Date | null): void {
    const due_date = date ? date.toISOString() : null;
    this.updateTask({ due_date } as UpdateTaskRequest);
  }

  onEstimatedHoursChange(hours: number | null): void {
    if (hours === null) {
      this.updateTask({ clear_estimated_hours: true } as UpdateTaskRequest);
    } else {
      this.updateTask({ estimated_hours: hours } as UpdateTaskRequest);
    }
  }

  onBudgetFieldChange(change: {
    key:
      | 'rate_per_hour'
      | 'budgeted_hours'
      | 'budgeted_hours_threshold'
      | 'cost_budget'
      | 'cost_budget_threshold'
      | 'cost_per_hour'
      | 'revenue_budget';
    value: number | null;
  }): void {
    // v1: only "set to a value" is wired — null means "skip this update"
    // rather than "clear", because the backend UpdateTaskRequest doesn't
    // distinguish absent from explicit-null yet.
    if (change.value === null) return;
    const patch = { [change.key]: change.value } as unknown as UpdateTaskRequest;
    this.updateTask(patch);
  }

  private updateTask(updates: UpdateTaskRequest): void {
    const t = this.task();
    if (!t) return;

    const optimistic = { ...t, ...updates } as Task;
    this.task.set(optimistic);

    this.taskService.updateTask(t.id, updates).subscribe({
      next: (updated) => {
        this.task.set({
          ...t,
          ...updated,
          assignees: updated.assignees ?? t.assignees,
          labels: updated.labels ?? t.labels,
        });
        if (updated.title) this.editTitle.set(updated.title);
        if (updated.description !== undefined)
          this.editDescription.set(updated.description ?? '');
      },
      error: () => {
        this.task.set(t);
        this.editTitle.set(t.title);
        this.editDescription.set(t.description ?? '');
      },
    });
  }

  // --- Assignees ---

  onAssign(member: MemberSearchResult): void {
    const t = this.task();
    if (!t) return;

    const snapshot = t;
    const newAssignee: Assignee = {
      id: member.id,
      display_name: member.name || member.email,
      avatar_url: null,
    };
    this.task.set({
      ...t,
      assignees: [...(t.assignees ?? []), newAssignee],
    });

    this.taskService.assignUser(t.id, member.id).subscribe({
      next: () => {
        /* already applied */
      },
      error: () => {
        this.task.set(snapshot);
        this.messageService.add({
          severity: 'error',
          summary: 'Update failed',
          detail: 'Could not assign member.',
          life: 4000,
        });
      },
    });
  }

  onUnassign(assignee: Assignee): void {
    const t = this.task();
    if (!t) return;

    const snapshot = t;
    this.task.set({
      ...t,
      assignees: (t.assignees ?? []).filter((a) => a.id !== assignee.id),
    });

    this.taskService.unassignUser(t.id, assignee.id).subscribe({
      next: () => {
        /* already applied */
      },
      error: () => {
        this.task.set(snapshot);
        this.messageService.add({
          severity: 'error',
          summary: 'Update failed',
          detail: 'Could not unassign member.',
          life: 4000,
        });
      },
    });
  }

  // --- Labels ---

  onRemoveLabel(labelId: string): void {
    const t = this.task();
    if (!t) return;

    const snapshot = t;
    this.task.set({
      ...t,
      labels: (t.labels ?? []).filter((l) => l.id !== labelId),
    });

    this.taskService.removeLabel(t.id, labelId).subscribe({
      next: () => {
        /* already applied */
      },
      error: () => {
        this.task.set(snapshot);
        this.messageService.add({
          severity: 'error',
          summary: 'Update failed',
          detail: 'Could not remove label.',
          life: 4000,
        });
      },
    });
  }

  // --- Watchers ---

  onWatch(member: MemberSearchResult): void {
    const t = this.task();
    if (!t) return;
    this.taskService.addWatcher(t.id, member.id).subscribe({
      next: () => {
        const newWatcher: Watcher = {
          user_id: member.id,
          name: member.name || member.email,
          avatar_url: null,
          watched_at: new Date().toISOString(),
        };
        this.task.set({
          ...t,
          watchers: [...(t.watchers ?? []), newWatcher],
        });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to add watcher' });
      },
    });
  }

  onUnwatch(watcher: Watcher): void {
    const t = this.task();
    if (!t) return;
    this.taskService.removeWatcher(t.id, watcher.user_id).subscribe({
      next: () => {
        this.task.set({
          ...t,
          watchers: (t.watchers ?? []).filter(
            (w) => w.user_id !== watcher.user_id,
          ),
        });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to remove watcher' });
      },
    });
  }

  onWatchSelf(): void {
    const user = this.authService.currentUser();
    if (!user) return;
    this.onWatch({
      id: user.id,
      name: user.name,
      email: user.email,
    } as MemberSearchResult);
  }

  // --- Reminders ---

  private loadReminders(taskId: string): void {
    this.taskService.listReminders(taskId).subscribe({
      next: (reminders) => this.reminders.set(reminders),
      error: () => this.reminders.set([]),
    });
  }

  onSetReminder(minutes: number): void {
    const t = this.task();
    if (!t) return;
    this.taskService.setReminder(t.id, minutes).subscribe({
      next: (resp) => {
        const newReminder: TaskReminder = {
          id: resp.id,
          task_id: t.id,
          remind_before_minutes: minutes,
          is_sent: false,
          created_at: new Date().toISOString(),
        };
        this.reminders.set([...this.reminders(), newReminder]);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to set reminder' });
      },
    });
  }

  onRemoveReminder(reminderId: string): void {
    const t = this.task();
    if (!t) return;
    this.taskService.removeReminder(t.id, reminderId).subscribe({
      next: () => {
        this.reminders.set(this.reminders().filter((r) => r.id !== reminderId));
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to remove reminder' });
      },
    });
  }

  // --- CRM ---

  loadCrmLinks(): void {
    const taskId = this.taskId();
    if (!taskId) return;
    this.crmLoading.set(true);
    this.crmError.set(false);
    this.crmService.getAllLinksForTask(taskId).subscribe({
      next: (links) => {
        this.crmLinks.set(links);
        this.crmCachedAt.set(links.cached_at ?? null);
        this.crmLoading.set(false);
      },
      error: () => {
        this.crmError.set(true);
        this.crmLoading.set(false);
      },
    });
  }

  crmCachedMinutesAgo(): number {
    const cachedAt = this.crmCachedAt();
    if (!cachedAt) return 0;
    return Math.round((Date.now() - new Date(cachedAt).getTime()) / 60000);
  }

  crmEntityIcon(type: CrmEntityType): string {
    switch (type) {
      case 'contact': return 'pi pi-user';
      case 'company': return 'pi pi-building';
      case 'deal': return 'pi pi-briefcase';
    }
  }

  onCrmLink(event: CrmLinkedEvent): void {
    const taskId = this.taskId();
    if (!taskId) return;

    let link$;
    if (event.entity_type === 'contact') {
      link$ = this.crmService.linkContactToTask(taskId, event.entity_id, event.twenty_workspace_id);
    } else if (event.entity_type === 'company') {
      link$ = this.crmService.linkCompanyToTask(taskId, event.entity_id, event.twenty_workspace_id);
    } else {
      link$ = this.crmService.linkDealToTask(taskId, event.entity_id, event.twenty_workspace_id);
    }

    link$.subscribe({
      next: () => this.loadCrmLinks(),
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Could not link CRM entity.',
          life: 4000,
        });
      },
    });
  }

  onCrmUnlink(link: CrmLinkedEntity): void {
    const taskId = this.taskId();
    if (!taskId) return;
    this.crmService.unlinkFromTask(taskId, link.entity_type, link.entity_id).subscribe({
      next: () => this.loadCrmLinks(),
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Could not unlink CRM entity.',
          life: 4000,
        });
      },
    });
  }

  // --- Delete ---

  onDelete(): void {
    const t = this.task();
    if (!t) return;
    if (!confirm('Are you sure you want to delete this task?')) return;

    this.taskService.deleteTask(t.id).subscribe({
      next: () => this.goBack(),
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete task' });
      },
    });
  }
}
