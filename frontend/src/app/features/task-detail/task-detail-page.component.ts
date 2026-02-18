import {
  Component,
  signal,
  computed,
  inject,
  Injector,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  afterNextRender,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin } from 'rxjs';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import {
  TaskService,
  Task,
  TaskPriority,
  Assignee,
  Label,
  UpdateTaskRequest,
} from '../../core/services/task.service';
import { BoardService, Board, Column } from '../../core/services/board.service';
import {
  WorkspaceService,
  Workspace,
  MemberSearchResult,
} from '../../core/services/workspace.service';
import {
  PRIORITY_COLORS,
  PRIORITY_COLORS_HEX,
  getPriorityLabel,
  isOverdue,
  isToday,
} from '../../shared/utils/task-colors';
import { SubtaskListComponent } from '../board/subtask-list/subtask-list.component';
import { CommentListComponent } from '../tasks/components/comment-list/comment-list.component';
import { ActivityTimelineComponent } from '../tasks/components/activity-timeline/activity-timeline.component';

@Component({
  selector: 'app-task-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    Select,
    DatePicker,
    InputTextModule,
    Textarea,
    ButtonModule,
    Tag,
    Tooltip,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    SubtaskListComponent,
    CommentListComponent,
    ActivityTimelineComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        overflow-y: auto;
        background: var(--surface-ground, #f8fafc);
      }
      .breadcrumb-link {
        color: var(--text-color-secondary, #64748b);
        transition: color 0.15s;
      }
      .breadcrumb-link:hover {
        color: var(--primary-color, #6366f1);
      }
      .field-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-color-secondary, #64748b);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.25rem;
      }
      .field-value {
        font-size: 0.875rem;
        color: var(--text-color, #1e293b);
      }
      .sidebar-card {
        background: var(--surface-card, white);
        border: 1px solid var(--surface-border, #e2e8f0);
        border-radius: 0.75rem;
        padding: 1.25rem;
      }
      .main-card {
        background: var(--surface-card, white);
        border: 1px solid var(--surface-border, #e2e8f0);
        border-radius: 0.75rem;
      }
      .assignee-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.625rem;
        background: var(--surface-100, #f1f5f9);
        border-radius: 9999px;
        font-size: 0.8125rem;
      }
      .label-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.625rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        font-weight: 500;
      }
      .field-editable {
        cursor: pointer;
        padding: 0.25rem 0.5rem;
        margin: 0 -0.5rem;
        border-radius: 0.375rem;
        transition: background 0.15s;
      }
      .field-editable:hover {
        background: var(--surface-hover, rgba(0, 0, 0, 0.04));
      }
    `,
  ],
  template: `
    <!-- Top Bar: Back + Breadcrumbs -->
    <div
      class="sticky top-0 z-10 border-b"
      style="
        background: var(--surface-card, white);
        border-color: var(--surface-border, #e2e8f0);
      "
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <button
          (click)="goBack()"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors"
          style="
            color: var(--text-color-secondary, #64748b);
            background: var(--surface-100, #f1f5f9);
          "
          pTooltip="Go back"
        >
          <i class="pi pi-arrow-left text-xs"></i>
          Back
        </button>

        @if (board() && workspace()) {
          <div
            class="flex items-center gap-1.5 text-sm"
            style="color: var(--text-color-secondary, #64748b)"
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
                'board',
                board()!.id,
              ]"
              class="breadcrumb-link"
              >{{ board()!.name }}</a
            >
            <i class="pi pi-chevron-right text-xs opacity-50"></i>
            <span style="color: var(--text-color, #1e293b)">{{
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
                style="background: var(--surface-200, #e2e8f0)"
              ></div>
              <div
                class="h-4 w-1/2 rounded animate-pulse"
                style="background: var(--surface-200, #e2e8f0)"
              ></div>
              <div
                class="h-32 w-full rounded animate-pulse"
                style="background: var(--surface-200, #e2e8f0)"
              ></div>
            </div>
          </div>
          <div class="space-y-4">
            <div class="sidebar-card space-y-3">
              @for (i of [1, 2, 3, 4, 5]; track i) {
                <div
                  class="h-6 rounded animate-pulse"
                  style="background: var(--surface-200, #e2e8f0)"
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
        <h2 class="text-lg font-semibold mb-2" style="color: var(--text-color)">
          Task not found
        </h2>
        <p class="text-sm mb-4" style="color: var(--text-color-secondary)">
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
            <!-- Title + Description Card -->
            <div class="main-card">
              <div class="p-5 pb-4">
                <!-- Title: Read/Edit -->
                @if (editingField() === 'title') {
                  <div data-edit-field="title">
                    <input
                      pInputText
                      type="text"
                      [ngModel]="editTitle()"
                      (ngModelChange)="editTitle.set($event)"
                      (blur)="saveTitle(); stopEditing()"
                      (keydown.escape)="cancelEditing('title')"
                      (keydown.enter)="$any($event.target).blur()"
                      class="w-full text-xl font-bold border-0 p-0"
                      style="
                        background: transparent;
                        color: var(--text-color, #1e293b);
                      "
                      placeholder="Task title"
                    />
                  </div>
                } @else {
                  <h1
                    (click)="startEditing('title')"
                    class="text-xl font-bold field-editable m-0"
                    style="color: var(--text-color, #1e293b)"
                  >
                    {{ editTitle() || 'Untitled' }}
                  </h1>
                }
              </div>

              <!-- Description: Read/Edit -->
              <div class="px-5 pb-5">
                <label class="field-label">Description</label>
                @if (editingField() === 'description') {
                  <div data-edit-field="description">
                    <textarea
                      pTextarea
                      [ngModel]="editDescription()"
                      (ngModelChange)="editDescription.set($event)"
                      (blur)="saveDescription(); stopEditing()"
                      (keydown.escape)="cancelEditing('description')"
                      rows="4"
                      class="w-full mt-1"
                      placeholder="Add a description..."
                      [autoResize]="true"
                    ></textarea>
                  </div>
                } @else {
                  <div
                    (click)="startEditing('description')"
                    class="field-editable mt-1 text-sm whitespace-pre-wrap"
                    style="color: var(--text-color, #1e293b); min-height: 2rem;"
                  >
                    @if (editDescription()) {
                      {{ editDescription() }}
                    } @else {
                      <span
                        style="
                          color: var(--text-color-secondary, #94a3b8);
                          font-style: italic;
                        "
                        >Click to add a description...</span
                      >
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Subtasks -->
            <div class="main-card p-5">
              <app-subtask-list [taskId]="taskId()" />
            </div>

            <!-- Comments / Activity Tabs -->
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
          </div>

          <!-- Sidebar (Right 1/3) -->
          <div class="space-y-5">
            <!-- Status & Priority -->
            <div class="sidebar-card space-y-4">
              <!-- Column / Status -->
              <div>
                <label class="field-label">Status</label>
                @if (column()) {
                  <div class="flex items-center gap-2 mt-1">
                    <span
                      class="w-3 h-3 rounded-full flex-shrink-0"
                      [style.background-color]="column()!.color || '#6366f1'"
                    ></span>
                    <span class="field-value">{{ column()!.name }}</span>
                    @if (column()!.status_mapping?.done) {
                      <p-tag value="Done" severity="success" />
                    }
                  </div>
                }
              </div>

              <!-- Priority: Read/Edit -->
              <div>
                <label class="field-label">Priority</label>
                @if (editingField() === 'priority') {
                  <div data-edit-field="priority">
                    <p-select
                      [ngModel]="task()!.priority"
                      (ngModelChange)="onPriorityChange($event); stopEditing()"
                      [options]="priorityOptions"
                      optionLabel="label"
                      optionValue="value"
                      styleClass="w-full mt-1"
                      [appendTo]="'body'"
                      (onHide)="stopEditing()"
                    >
                      <ng-template #selectedItem let-selected>
                        <div class="flex items-center gap-2" *ngIf="selected">
                          <span
                            class="w-2.5 h-2.5 rounded-full"
                            [style.background-color]="selected.color"
                          ></span>
                          {{ selected.label }}
                        </div>
                      </ng-template>
                      <ng-template #item let-priority>
                        <div class="flex items-center gap-2">
                          <span
                            class="w-2.5 h-2.5 rounded-full"
                            [style.background-color]="priority.color"
                          ></span>
                          {{ priority.label }}
                        </div>
                      </ng-template>
                    </p-select>
                  </div>
                } @else {
                  <div
                    (click)="startEditing('priority')"
                    class="field-editable mt-1 inline-flex items-center gap-2"
                  >
                    <span
                      class="w-2.5 h-2.5 rounded-full"
                      [style.background-color]="
                        getPriorityColor(task()!.priority)
                      "
                    ></span>
                    <span class="field-value">{{
                      getPriorityDisplayLabel(task()!.priority)
                    }}</span>
                  </div>
                }
              </div>

              <!-- Due Date: Read/Edit -->
              <div>
                <label class="field-label">Due Date</label>
                @if (editingField() === 'due_date') {
                  <div data-edit-field="due_date">
                    <p-datePicker
                      [ngModel]="dueDateValue()"
                      (ngModelChange)="onDueDateChange($event); stopEditing()"
                      dateFormat="yy-mm-dd"
                      [showIcon]="true"
                      [showClear]="true"
                      styleClass="w-full mt-1"
                      placeholder="No due date"
                      [appendTo]="'body'"
                      (onClose)="stopEditing()"
                    />
                  </div>
                } @else {
                  <div
                    (click)="startEditing('due_date')"
                    class="field-editable mt-1"
                  >
                    @if (task()!.due_date) {
                      <span
                        class="field-value"
                        [style.color]="
                          getDueDateDisplayColor(task()!.due_date!)
                        "
                        >{{ formatShortDate(task()!.due_date!) }}</span
                      >
                    } @else {
                      <span
                        style="
                          color: var(--text-color-secondary, #94a3b8);
                          font-style: italic;
                        "
                        >No due date</span
                      >
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Assignees -->
            <div class="sidebar-card group">
              <div class="flex items-center justify-between mb-3">
                <label class="field-label mb-0">Assignees</label>
                <button
                  (click)="toggleAssigneeSearch()"
                  class="text-xs px-2 py-1 rounded transition-all opacity-0 group-hover:opacity-100"
                  style="color: var(--primary-color, #6366f1)"
                >
                  <i class="pi pi-plus text-xs mr-1"></i>Add
                </button>
              </div>

              <div class="flex flex-wrap gap-2">
                @if (task()!.assignees && task()!.assignees!.length > 0) {
                  @for (assignee of task()!.assignees!; track assignee.id) {
                    <div class="assignee-chip">
                      <div
                        class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        [style.background]="
                          assignee.avatar_url
                            ? 'transparent'
                            : getAvatarColor(assignee.display_name)
                        "
                      >
                        @if (assignee.avatar_url) {
                          <img
                            [src]="assignee.avatar_url"
                            [alt]="assignee.display_name"
                            class="w-full h-full rounded-full object-cover"
                          />
                        } @else {
                          {{ getInitials(assignee.display_name) }}
                        }
                      </div>
                      <span>{{ assignee.display_name }}</span>
                      <button
                        (click)="onUnassign(assignee)"
                        class="ml-0.5 opacity-50 hover:opacity-100"
                      >
                        <i class="pi pi-times text-[10px]"></i>
                      </button>
                    </div>
                  }
                } @else {
                  <span
                    class="text-sm"
                    style="color: var(--text-color-secondary)"
                    >No assignees</span
                  >
                }
              </div>

              @if (showAssigneeSearch()) {
                <div
                  class="mt-3 border rounded-lg overflow-hidden"
                  style="border-color: var(--surface-border)"
                >
                  <input
                    pInputText
                    type="text"
                    [ngModel]="assigneeQuery()"
                    (ngModelChange)="onAssigneeSearch($event)"
                    placeholder="Search members..."
                    class="w-full border-0"
                    style="border-bottom: 1px solid var(--surface-border)"
                  />
                  <div class="max-h-40 overflow-y-auto p-1">
                    @for (member of assigneeResults(); track member.id) {
                      <button
                        (click)="onAssign(member)"
                        class="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors"
                        style="color: var(--text-color)"
                      >
                        <div
                          class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          [style.background]="
                            getAvatarColor(member.name || member.email)
                          "
                        >
                          {{ getInitials(member.name || member.email) }}
                        </div>
                        <span>{{ member.name || member.email }}</span>
                      </button>
                    }
                    @if (assigneeResults().length === 0 && assigneeQuery()) {
                      <div
                        class="px-2 py-3 text-sm text-center"
                        style="color: var(--text-color-secondary)"
                      >
                        No members found
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Labels -->
            <div class="sidebar-card">
              <label class="field-label">Labels</label>
              <div class="flex flex-wrap gap-2 mt-2">
                @if (task()!.labels && task()!.labels!.length > 0) {
                  @for (label of task()!.labels!; track label.id) {
                    <span
                      class="label-chip"
                      [style.background-color]="label.color + '20'"
                      [style.color]="label.color"
                    >
                      {{ label.name }}
                      <button
                        (click)="onRemoveLabel(label.id)"
                        class="ml-1 hover:opacity-70"
                      >
                        <i class="pi pi-times text-[10px]"></i>
                      </button>
                    </span>
                  }
                } @else {
                  <span
                    class="text-sm"
                    style="color: var(--text-color-secondary)"
                    >No labels</span
                  >
                }
              </div>
            </div>

            <!-- Metadata -->
            <div class="sidebar-card space-y-3">
              <div>
                <label class="field-label">Created</label>
                <p
                  class="field-value mt-0.5"
                  style="color: var(--text-color-secondary)"
                >
                  {{ formatDate(task()!.created_at) }}
                </p>
              </div>
              <div>
                <label class="field-label">Updated</label>
                <p
                  class="field-value mt-0.5"
                  style="color: var(--text-color-secondary)"
                >
                  {{ formatDate(task()!.updated_at) }}
                </p>
              </div>

              <!-- Delete -->
              <div
                class="pt-3 border-t"
                style="border-color: var(--surface-border)"
              >
                <button
                  pButton
                  label="Delete Task"
                  icon="pi pi-trash"
                  severity="danger"
                  [outlined]="true"
                  size="small"
                  (click)="onDelete()"
                  class="w-full"
                ></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class TaskDetailPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private injector = inject(Injector);
  private taskService = inject(TaskService);
  private boardService = inject(BoardService);
  private workspaceService = inject(WorkspaceService);
  private routeSub: Subscription | null = null;

  taskId = signal('');
  task = signal<Task | null>(null);
  board = signal<Board | null>(null);
  workspace = signal<Workspace | null>(null);
  columns = signal<Column[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  editTitle = signal('');
  editDescription = signal('');
  editingField = signal<string | null>(null);

  showAssigneeSearch = signal(false);
  assigneeQuery = signal('');
  assigneeResults = signal<MemberSearchResult[]>([]);

  column = computed(() => {
    const t = this.task();
    const cols = this.columns();
    if (!t || !cols.length) return null;
    return cols.find((c) => c.id === t.column_id) ?? null;
  });

  dueDateValue = computed(() => {
    const t = this.task();
    if (!t?.due_date) return null;
    return new Date(t.due_date);
  });

  readonly priorityOptions = [
    { label: 'Urgent', value: 'urgent', color: PRIORITY_COLORS.urgent },
    { label: 'High', value: 'high', color: PRIORITY_COLORS.high },
    { label: 'Medium', value: 'medium', color: PRIORITY_COLORS.medium },
    { label: 'Low', value: 'low', color: PRIORITY_COLORS.low },
  ];

  private readonly avatarColors = [
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#f43f5e',
    '#f97316',
    '#22c55e',
    '#06b6d4',
    '#3b82f6',
  ];

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe((params) => {
      const id = params['taskId'];
      if (id && id !== this.taskId()) {
        this.taskId.set(id);
        this.loadTask(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  // --- Data Loading ---

  private loadTask(taskId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.taskService.getTask(taskId).subscribe({
      next: (task) => {
        this.task.set(task);
        this.editTitle.set(task.title);
        this.editDescription.set(task.description ?? '');

        // Load board + columns for breadcrumbs and status
        const boardId = (task as unknown as { board_id?: string }).board_id;
        if (boardId) {
          this.loadBoardContext(boardId);
        }

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

  private loadBoardContext(boardId: string): void {
    forkJoin({
      board: this.boardService.getBoard(boardId),
      columns: this.boardService.listColumns(boardId),
    }).subscribe({
      next: ({ board, columns }) => {
        this.board.set(board);
        this.columns.set(columns);

        // Load workspace
        this.workspaceService.get(board.workspace_id).subscribe({
          next: (ws) => this.workspace.set(ws),
          error: () => {
            // Non-critical — breadcrumbs just won't show workspace
          },
        });
      },
      error: () => {
        // Non-critical — breadcrumbs just won't show
      },
    });
  }

  // --- Inline Editing ---

  startEditing(field: string): void {
    this.editingField.set(field);
    afterNextRender(
      () => {
        const wrapper = document.querySelector(`[data-edit-field="${field}"]`);
        if (!wrapper) return;

        if (field === 'title' || field === 'description') {
          const input = wrapper.querySelector('input, textarea') as HTMLElement;
          input?.focus();
        } else if (field === 'priority') {
          const selectEl = wrapper.querySelector('.p-select') as HTMLElement;
          selectEl?.click();
        } else if (field === 'due_date') {
          const input = wrapper.querySelector('input') as HTMLElement;
          input?.focus();
          input?.click();
        }
      },
      { injector: this.injector },
    );
  }

  stopEditing(): void {
    this.editingField.set(null);
  }

  cancelEditing(field: string): void {
    const t = this.task();
    if (t) {
      if (field === 'title') this.editTitle.set(t.title);
      if (field === 'description')
        this.editDescription.set(t.description ?? '');
    }
    this.editingField.set(null);
  }

  // --- Saving ---

  saveTitle(): void {
    const t = this.task();
    if (!t || this.editTitle() === t.title) return;
    this.updateTask({ title: this.editTitle() });
  }

  saveDescription(): void {
    const t = this.task();
    if (!t) return;
    const newDesc = this.editDescription() || null;
    if (newDesc === (t.description ?? null)) return;
    this.updateTask({ description: newDesc });
  }

  onPriorityChange(priority: TaskPriority): void {
    this.updateTask({ priority } as UpdateTaskRequest);
  }

  onDueDateChange(date: Date | null): void {
    const due_date = date ? date.toISOString().split('T')[0] : null;
    this.updateTask({ due_date } as UpdateTaskRequest);
  }

  private updateTask(updates: UpdateTaskRequest): void {
    const t = this.task();
    if (!t) return;

    this.taskService.updateTask(t.id, updates).subscribe({
      next: (updated) => {
        // Merge updates while preserving assignees/labels from current state
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
        // Revert edits on failure
        this.editTitle.set(t.title);
        this.editDescription.set(t.description ?? '');
      },
    });
  }

  // --- Assignees ---

  toggleAssigneeSearch(): void {
    this.showAssigneeSearch.update((v) => !v);
    if (!this.showAssigneeSearch()) {
      this.assigneeQuery.set('');
      this.assigneeResults.set([]);
    }
  }

  onAssigneeSearch(query: string): void {
    this.assigneeQuery.set(query);
    if (!query || query.length < 2) {
      this.assigneeResults.set([]);
      return;
    }
    const board = this.board();
    if (!board) return;

    this.workspaceService.searchMembers(board.workspace_id, query).subscribe({
      next: (results) => this.assigneeResults.set(results),
      error: () => this.assigneeResults.set([]),
    });
  }

  onAssign(member: MemberSearchResult): void {
    const t = this.task();
    if (!t) return;
    this.taskService.assignUser(t.id, member.id).subscribe({
      next: () => {
        const newAssignee: Assignee = {
          id: member.id,
          display_name: member.name || member.email,
          avatar_url: null,
        };
        this.task.set({
          ...t,
          assignees: [...(t.assignees ?? []), newAssignee],
        });
        this.showAssigneeSearch.set(false);
        this.assigneeQuery.set('');
        this.assigneeResults.set([]);
      },
    });
  }

  onUnassign(assignee: Assignee): void {
    const t = this.task();
    if (!t) return;
    this.taskService.unassignUser(t.id, assignee.id).subscribe({
      next: () => {
        this.task.set({
          ...t,
          assignees: (t.assignees ?? []).filter((a) => a.id !== assignee.id),
        });
      },
    });
  }

  // --- Labels ---

  onRemoveLabel(labelId: string): void {
    const t = this.task();
    if (!t) return;
    this.taskService.removeLabel(t.id, labelId).subscribe({
      next: () => {
        this.task.set({
          ...t,
          labels: (t.labels ?? []).filter((l) => l.id !== labelId),
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
    });
  }

  // --- Helpers ---

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getAvatarColor(name: string): string {
    const code = name.charCodeAt(0) || 0;
    return this.avatarColors[code % this.avatarColors.length];
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatShortDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  getPriorityColor(priority: TaskPriority): string {
    return PRIORITY_COLORS_HEX[priority]?.bg ?? '#94a3b8';
  }

  getPriorityDisplayLabel(priority: TaskPriority): string {
    return getPriorityLabel(priority);
  }

  getDueDateDisplayColor(dateStr: string): string {
    if (isOverdue(dateStr)) return '#dc2626';
    if (isToday(dateStr)) return '#d97706';
    return 'var(--text-color, #1e293b)';
  }
}
