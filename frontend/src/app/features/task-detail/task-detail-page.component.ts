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
} from '../../core/services/task.service';
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
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <i
          class="pi pi-exclamation-circle text-4xl mb-4"
          style="color: var(--red-500)"
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

            <!-- Comments / Activity Tabs -->
            @defer (on viewport) {
            <div class="main-card">
              <p-tabs value="0">
                <p-tablist>
                  <p-tab value="0">
                    <i class="pi pi-comments mr-1.5"></i>
                    Comments
                  </p-tab>
                  <p-tab value="1">
                    <i class="pi pi-history mr-1.5"></i>
                    Activity
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
  private projectService = inject(ProjectService);
  private workspaceService = inject(WorkspaceService);
  private authService = inject(AuthService);
  private recentItemsService = inject(RecentItemsService);
  private wsContext = inject(WorkspaceContextService);
  private messageService = inject(MessageService);

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
