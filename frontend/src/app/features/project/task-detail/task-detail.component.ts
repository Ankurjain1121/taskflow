import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { Popover } from 'primeng/popover';
import { DatePicker } from 'primeng/datepicker';
import { TaskService, TaskPriority } from '../../../core/services/task.service';
import { LabelService } from '../../../core/services/label.service';
import { AuthService } from '../../../core/services/auth.service';
import { TaskCard, TaskWithDetails } from '../../../shared/types/task.types';
import { ProjectColumn } from '../../../shared/types/project.types';
import { WorkspaceMemberInfo } from '../../../shared/types/workspace.types';
import { MemberSearchResult } from '../../../core/services/workspace.service';
import { CommentsSectionComponent } from './comments-section.component';
import { AttachmentsSectionComponent } from './attachments-section.component';
import { SubtasksSectionComponent } from './subtasks-section.component';
import { MemberPickerComponent } from '../../../shared/components/member-picker/member-picker.component';
import { LabelPickerComponent } from '../../../shared/components/label-picker/label-picker.component';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    Popover,
    DatePicker,
    CommentsSectionComponent,
    AttachmentsSectionComponent,
    SubtasksSectionComponent,
    MemberPickerComponent,
    LabelPickerComponent,
  ],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-40 transition-opacity duration-300"
      [class]="
        visible()
          ? 'bg-black/40 backdrop-blur-[2px]'
          : 'bg-transparent pointer-events-none'
      "
      (click)="close()"
    ></div>

    <!-- Slide-over panel -->
    <div
      class="fixed inset-y-0 right-0 w-full max-w-xl z-50 bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ease-out"
      [class.translate-x-0]="visible()"
      [class.translate-x-full]="!visible()"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80"
      >
        <div class="flex items-center gap-2 min-w-0">
          <!-- Breadcrumb -->
          <div class="flex items-center gap-1.5 text-xs text-gray-400 truncate">
            @if (projectName()) {
              <span class="truncate max-w-[100px]">{{ projectName() }}</span>
              <i class="pi pi-chevron-right !text-[12px] text-gray-300"></i>
            }
            @if (currentColumnName()) {
              <span class="truncate max-w-[80px]">{{
                currentColumnName()
              }}</span>
              <i class="pi pi-chevron-right !text-[12px] text-gray-300"></i>
            }
            @if (taskData()?.task?.display_id) {
              <span
                class="font-mono font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded"
              >
                {{ taskData()!.task.display_id }}
              </span>
            }
          </div>
        </div>
        <div class="flex items-center gap-1">
          <!-- Delete button with inline confirm -->
          @if (!confirmingDelete()) {
            <button
              pButton
              [rounded]="true"
              [text]="true"
              severity="secondary"
              (click)="startDelete()"
              pTooltip="Delete task"
              class="!text-gray-400 hover:!text-red-500 transition-colors"
            >
              <i class="pi pi-trash !text-[20px]"></i>
            </button>
          } @else {
            <p-button
              severity="danger"
              size="small"
              class="animate-pulse"
              (onClick)="confirmDelete()"
            >
              <i class="pi pi-exclamation-triangle !text-[16px] mr-1"></i>
              Click to confirm delete
            </p-button>
            <button
              pButton
              [rounded]="true"
              [text]="true"
              severity="secondary"
              class="!w-7 !h-7"
              (click)="cancelDelete()"
            >
              <i class="pi pi-times !text-[16px] text-gray-400"></i>
            </button>
          }
          <button
            pButton
            [rounded]="true"
            [text]="true"
            severity="secondary"
            (click)="close()"
            pTooltip="Close panel"
          >
            <i class="pi pi-times !text-[20px]"></i>
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="flex-1 flex flex-col items-center justify-center gap-3">
          <div
            class="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"
          ></div>
          <p class="text-sm text-gray-400">Loading task...</p>
        </div>
      }

      @if (!loading() && taskData()) {
        <div class="flex-1 overflow-y-auto">
          <!-- Title section -->
          <div class="px-5 pt-5 pb-3 group/title">
            <div class="relative">
              <input
                class="w-full text-2xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-0 border-b-2 border-transparent rounded-md px-2 py-1.5 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 focus:shadow-sm focus:outline-none transition-all"
                [value]="taskData()!.task.title"
                (blur)="updateTitle($event)"
                (keydown.enter)="$any($event.target).blur()"
              />
              <i
                class="pi pi-pencil absolute right-2 top-1/2 -translate-y-1/2 !text-[16px] text-gray-300 opacity-0 group-hover/title:opacity-100 transition-opacity pointer-events-none"
              ></i>
            </div>
          </div>

          <div class="px-5 pb-5 space-y-5">
            <!-- Priority & Column chips row -->
            <div class="flex flex-wrap gap-3">
              <!-- Priority chip -->
              <div class="flex flex-col gap-1.5">
                <span
                  class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider"
                  >Priority</span
                >
                <button
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border-0"
                  [class]="priorityChipClass(taskData()!.task.priority)"
                  (click)="priorityOp.toggle($event)"
                >
                  <span
                    class="w-2 h-2 rounded-full"
                    [class]="priorityDotClass(taskData()!.task.priority)"
                  ></span>
                  {{ priorityLabel(taskData()!.task.priority) }}
                  <i class="pi pi-chevron-down !text-[14px] opacity-60"></i>
                </button>
                <p-popover #priorityOp>
                  <div class="flex flex-col py-1">
                    @for (p of priorities; track p.value) {
                      <button
                        class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full text-left"
                        (click)="updatePriority(p.value); priorityOp.hide()"
                      >
                        <span
                          class="w-2 h-2 rounded-full"
                          [class]="priorityDotClass(p.value)"
                        ></span>
                        <span>{{ p.label }}</span>
                        @if (p.value === taskData()!.task.priority) {
                          <i
                            class="pi pi-check !text-[16px] ml-auto text-indigo-500"
                          ></i>
                        }
                      </button>
                    }
                  </div>
                </p-popover>
              </div>

              <!-- Column/Status chip -->
              <div class="flex flex-col gap-1.5">
                <span
                  class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider"
                  >Status</span
                >
                <button
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border"
                  [style.background-color]="currentColumnColor() + '15'"
                  [style.border-color]="currentColumnColor() + '40'"
                  [style.color]="currentColumnColor()"
                  (click)="columnOp.toggle($event)"
                >
                  <span
                    class="w-2 h-2 rounded-full"
                    [style.background-color]="currentColumnColor()"
                  ></span>
                  {{ currentColumnName() || 'Unknown' }}
                  <i class="pi pi-chevron-down !text-[14px] opacity-60"></i>
                </button>
                <p-popover #columnOp>
                  <div class="flex flex-col py-1">
                    @for (col of columns(); track col.id) {
                      <button
                        class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full text-left"
                        (click)="moveToColumn(col.id); columnOp.hide()"
                      >
                        <span
                          class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          [style.background-color]="col.color || '#6366f1'"
                        ></span>
                        <span>{{ col.name }}</span>
                        @if (col.id === taskData()!.task.column_id) {
                          <i
                            class="pi pi-check !text-[16px] ml-auto text-indigo-500"
                          ></i>
                        }
                      </button>
                    }
                  </div>
                </p-popover>
              </div>

              <!-- Due date chip -->
              <div class="flex flex-col gap-1.5">
                <span
                  class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider"
                  >Due date</span
                >
                <div class="flex items-center gap-1.5">
                  <button
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border"
                    [class]="dueDateChipClass()"
                    (click)="dueDateOp.toggle($event)"
                  >
                    <i class="pi pi-calendar !text-[14px]"></i>
                    @if (taskData()!.task.due_date) {
                      <span>{{
                        formatDueDate(taskData()!.task.due_date!)
                      }}</span>
                    } @else {
                      <span class="text-gray-400">Set date</span>
                    }
                  </button>
                  @if (taskData()!.task.due_date) {
                    <span
                      class="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      [class]="dueDateRelativeClass()"
                    >
                      {{ dueDateRelativeText() }}
                    </span>
                    <button
                      class="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      (click)="clearDueDate()"
                      pTooltip="Clear due date"
                    >
                      <i class="pi pi-times !text-[12px] text-gray-400"></i>
                    </button>
                  }
                  <p-popover #dueDateOp>
                    <p-datepicker
                      [inline]="true"
                      [ngModel]="dueDateValue()"
                      (ngModelChange)="updateDueDate($event); dueDateOp.hide()"
                    />
                  </p-popover>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div class="group/desc">
              <label
                class="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2"
              >
                <i class="pi pi-align-left !text-[14px]"></i>
                Description
              </label>
              <textarea
                class="w-full min-h-[140px] p-4 text-sm leading-relaxed text-gray-900 dark:text-gray-100 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white dark:focus:bg-gray-800 focus:outline-none resize-y transition-all"
                [value]="taskData()!.task.description || ''"
                placeholder="Add a description to provide more context..."
                (blur)="updateDescription($event)"
              ></textarea>
            </div>

            <!-- Assignees -->
            <div>
              <label
                class="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5"
              >
                <i class="pi pi-users !text-[14px]"></i>
                Assignees
                <span
                  class="text-gray-300 font-normal normal-case tracking-normal"
                  >({{ taskData()!.assignees.length }})</span
                >
              </label>
              <div class="space-y-2 mb-3">
                @for (
                  assignee of taskData()!.assignees;
                  track assignee.user_id
                ) {
                  <div
                    class="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group/assignee"
                  >
                    <!-- Avatar -->
                    @if (assignee.avatar_url) {
                      <img
                        [src]="assignee.avatar_url"
                        [alt]="assignee.name"
                        class="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-gray-900"
                      />
                    } @else {
                      <div
                        class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white ring-2 ring-white dark:ring-gray-900"
                        [style.background-color]="getAvatarColor(assignee.name)"
                      >
                        {{ assignee.name.charAt(0).toUpperCase() }}
                      </div>
                    }
                    <div class="flex-1 min-w-0">
                      <span
                        class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block"
                      >
                        {{ assignee.name }}
                      </span>
                    </div>
                    <button
                      class="w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover/assignee:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                      (click)="removeAssignee(assignee.user_id)"
                      pTooltip="Remove assignee"
                    >
                      <i
                        class="pi pi-times !text-[14px] text-gray-400 hover:text-red-500"
                      ></i>
                    </button>
                  </div>
                }

                @if (taskData()!.assignees.length === 0) {
                  <div
                    class="flex items-center gap-2 px-3 py-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-700"
                  >
                    <i class="pi pi-user-plus !text-[18px] text-gray-300"></i>
                    <span class="text-sm text-gray-400"
                      >No one assigned yet</span
                    >
                  </div>
                }
              </div>
              @if (workspaceId()) {
                <app-member-picker
                  [workspaceId]="workspaceId()"
                  [excludeUserIds]="assigneeUserIds()"
                  label="Add assignee"
                  placeholder="Search by name or email..."
                  (memberSelected)="addAssignee($event)"
                />
              }
            </div>

            <!-- Labels -->
            <div>
              <label
                class="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5"
              >
                <i class="pi pi-tag !text-[14px]"></i>
                Labels
              </label>
              <div class="flex flex-wrap gap-2 mb-3">
                @for (label of taskData()!.labels; track label.id) {
                  <div
                    class="group/label inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold shadow-sm transition-all hover:shadow-md"
                    [style.background-color]="label.color + '20'"
                    [style.color]="label.color"
                    [style.border]="'1px solid ' + label.color + '40'"
                  >
                    <span
                      class="w-2 h-2 rounded-full"
                      [style.background-color]="label.color"
                    ></span>
                    <span>{{ label.name }}</span>
                    <button
                      class="w-4 h-4 flex items-center justify-center rounded-full opacity-0 group-hover/label:opacity-100 transition-opacity"
                      [style.background-color]="label.color + '30'"
                      (click)="removeLabel(label.id)"
                    >
                      <i class="pi pi-times !text-[10px]"></i>
                    </button>
                  </div>
                }

                @if (taskData()!.labels.length === 0) {
                  <span class="text-sm text-gray-400 italic">No labels</span>
                }
              </div>
              <app-label-picker
                [projectId]="projectId()"
                [selectedLabelIds]="selectedLabelIds()"
                (labelToggled)="onLabelToggled($event)"
              />
            </div>

            <!-- Subtasks -->
            <div class="border-t border-gray-100 dark:border-gray-800 pt-5">
              <h4
                class="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3"
              >
                <i class="pi pi-list-check !text-[14px]"></i>
                Subtasks
              </h4>
              <app-subtasks-section [taskId]="taskId()" />
            </div>

            <!-- Comments -->
            <div class="border-t border-gray-100 dark:border-gray-800 pt-5">
              <app-comments-section [taskId]="taskId()" />
            </div>

            <!-- Attachments -->
            <div class="border-t border-gray-100 dark:border-gray-800 pt-5">
              <app-attachments-section [taskId]="taskId()" />
            </div>
          </div>
        </div>
      }

      <!-- Footer with metadata -->
      @if (!loading() && taskData()) {
        <div
          class="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50"
        >
          <div
            class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400"
          >
            @if (taskData()!.task.display_id) {
              <div class="flex items-center gap-1">
                <i class="pi pi-hashtag !text-[12px]"></i>
                <span class="font-mono">{{ taskData()!.task.display_id }}</span>
              </div>
            }
            @if (createdByName()) {
              <div class="flex items-center gap-1">
                <i class="pi pi-user !text-[12px]"></i>
                <span>Created by {{ createdByName() }}</span>
              </div>
            }
            <div class="flex items-center gap-1">
              <i class="pi pi-clock !text-[12px]"></i>
              <span
                >Created
                {{ formatRelativeTime(taskData()!.task.created_at) }}</span
              >
            </div>
            <div class="flex items-center gap-1">
              <i class="pi pi-history !text-[12px]"></i>
              <span
                >Updated
                {{ formatRelativeTime(taskData()!.task.updated_at) }}</span
              >
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class TaskDetailComponent implements OnInit {
  private taskService = inject(TaskService);
  private labelService = inject(LabelService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  taskId = input.required<string>();
  projectId = input.required<string>();
  workspaceId = input<string>('');
  columns = input<ProjectColumn[]>([]);
  projectName = input<string>('');
  closed = output<void>();
  taskUpdated = output<TaskCard>();

  taskData = signal<TaskWithDetails | null>(null);
  loading = signal(true);
  visible = signal(false);
  confirmingDelete = signal(false);
  private deleteTimeout: ReturnType<typeof setTimeout> | null = null;

  priorities = [
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  dueDateValue = computed(() => {
    const due = this.taskData()?.task.due_date;
    return due ? new Date(due) : null;
  });

  assigneeUserIds = computed(
    () => this.taskData()?.assignees.map((a) => a.user_id) ?? [],
  );

  selectedLabelIds = computed(
    () => this.taskData()?.labels.map((l) => l.id) ?? [],
  );

  currentColumnName = computed(() => {
    const colId = this.taskData()?.task.column_id;
    if (!colId) return '';
    return this.columns().find((c) => c.id === colId)?.name ?? '';
  });

  currentColumnColor = computed(() => {
    const colId = this.taskData()?.task.column_id;
    if (!colId) return '#6366f1';
    return this.columns().find((c) => c.id === colId)?.color ?? '#6366f1';
  });

  createdByName = computed(() => {
    const user = this.authService.currentUser();
    const createdById = this.taskData()?.task.created_by_id;
    if (user && createdById === user.id) {
      return user.name;
    }
    return '';
  });

  ngOnInit(): void {
    this.loadTask();
    requestAnimationFrame(() => this.visible.set(true));
  }

  close(): void {
    this.visible.set(false);
    setTimeout(() => this.closed.emit(), 300);
  }

  // --- Title ---
  updateTitle(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newTitle = input.value.trim();
    const current = this.taskData();
    if (!current || !newTitle || newTitle === current.task.title) return;

    this.taskService.updateTask(this.taskId(), { title: newTitle }).subscribe({
      next: () => {
        this.updateLocalTask({ title: newTitle });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to update title.',
          life: 3000,
        });
        input.value = current.task.title;
      },
    });
  }

  // --- Priority ---
  updatePriority(priority: string): void {
    if (priority === this.taskData()?.task.priority) return;
    this.taskService
      .updateTask(this.taskId(), {
        priority: priority as TaskPriority,
      })
      .subscribe({
        next: () => {
          this.updateLocalTask({ priority: priority as any });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update priority.',
            life: 3000,
          });
        },
      });
  }

  priorityChipClass(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
      case 'medium':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      case 'low':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  priorityDotClass(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-amber-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  }

  priorityLabel(priority: string): string {
    return this.priorities.find((p) => p.value === priority)?.label ?? priority;
  }

  // --- Due date ---
  updateDueDate(date: Date | null): void {
    const due_date = date ? date.toISOString().split('T')[0] : null;
    this.taskService.updateTask(this.taskId(), { due_date }).subscribe({
      next: () => {
        this.updateLocalTask({ due_date });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to update due date.',
          life: 3000,
        });
      },
    });
  }

  clearDueDate(): void {
    this.updateDueDate(null);
  }

  formatDueDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  dueDateRelativeText(): string {
    const due = this.taskData()?.task.due_date;
    if (!due) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(due + 'T00:00:00');
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < -1) return `Overdue by ${Math.abs(diffDays)} days`;
    if (diffDays === -1) return 'Overdue by 1 day';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    if (diffDays <= 14) return 'Due in ~2 weeks';
    return '';
  }

  dueDateRelativeClass(): string {
    const due = this.taskData()?.task.due_date;
    if (!due) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(due + 'T00:00:00');
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0)
      return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30';
    if (diffDays === 0)
      return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30';
    if (diffDays <= 3)
      return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30';
    return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30';
  }

  dueDateChipClass(): string {
    const due = this.taskData()?.task.due_date;
    if (!due)
      return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(due + 'T00:00:00');
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0)
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300';
    if (diffDays <= 1)
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    if (diffDays <= 3)
      return 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300';
  }

  // --- Description ---
  updateDescription(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const description = textarea.value.trim() || undefined;
    const current = this.taskData();
    if (!current) return;
    if (description === (current.task.description || '')) return;

    this.taskService.updateTask(this.taskId(), { description }).subscribe({
      next: () => {
        this.updateLocalTask({ description: description || null });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to update description.',
          life: 3000,
        });
      },
    });
  }

  // --- Column ---
  moveToColumn(columnId: string): void {
    const current = this.taskData();
    if (!current || columnId === current.task.column_id) return;

    this.taskService
      .moveTaskPosition(this.taskId(), { target_column_id: columnId })
      .subscribe({
        next: () => {
          this.updateLocalTask({ column_id: columnId });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to move task.',
            life: 3000,
          });
        },
      });
  }

  // --- Assignees ---
  removeAssignee(userId: string): void {
    this.taskService.unassignUser(this.taskId(), userId).subscribe({
      next: () => {
        const current = this.taskData();
        if (current) {
          this.taskData.set({
            ...current,
            assignees: current.assignees.filter((a) => a.user_id !== userId),
          });
          this.emitTaskCard();
        }
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to remove assignee.',
          life: 3000,
        });
      },
    });
  }

  addAssignee(member: MemberSearchResult): void {
    this.taskService.assignUser(this.taskId(), member.id).subscribe({
      next: () => {
        const current = this.taskData();
        if (current) {
          this.taskData.set({
            ...current,
            assignees: [
              ...current.assignees,
              {
                user_id: member.id,
                name: member.name,
                avatar_url: member.avatar_url,
              },
            ],
          });
          this.emitTaskCard();
        }
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to add assignee.',
          life: 3000,
        });
      },
    });
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#6366f1',
      '#8b5cf6',
      '#ec4899',
      '#f43f5e',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#06b6d4',
      '#3b82f6',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  // --- Labels ---
  onLabelToggled(event: { labelId: string; action: 'add' | 'remove' }): void {
    const { labelId, action } = event;
    if (action === 'add') {
      this.labelService.addToTask(this.taskId(), labelId).subscribe({
        next: () => {
          this.taskService.getTaskDetails(this.taskId()).subscribe({
            next: (data) => {
              this.taskData.set(data);
              this.emitTaskCard();
            },
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to add label.',
            life: 3000,
          });
        },
      });
    } else {
      this.removeLabel(labelId);
    }
  }

  removeLabel(labelId: string): void {
    this.labelService.removeFromTask(this.taskId(), labelId).subscribe({
      next: () => {
        const current = this.taskData();
        if (current) {
          this.taskData.set({
            ...current,
            labels: current.labels.filter((l) => l.id !== labelId),
          });
          this.emitTaskCard();
        }
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to remove label.',
          life: 3000,
        });
      },
    });
  }

  // --- Delete ---
  startDelete(): void {
    this.confirmingDelete.set(true);
    this.deleteTimeout = setTimeout(() => {
      this.confirmingDelete.set(false);
    }, 4000);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
    if (this.deleteTimeout) {
      clearTimeout(this.deleteTimeout);
      this.deleteTimeout = null;
    }
  }

  confirmDelete(): void {
    if (this.deleteTimeout) {
      clearTimeout(this.deleteTimeout);
      this.deleteTimeout = null;
    }
    this.taskService.deleteTask(this.taskId()).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Task deleted.',
          life: 2000,
        });
        this.close();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete task.',
          life: 3000,
        });
        this.confirmingDelete.set(false);
      },
    });
  }

  // --- Utilities ---
  formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private loadTask(): void {
    this.loading.set(true);
    this.taskService.getTaskDetails(this.taskId()).subscribe({
      next: (data) => {
        this.taskData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load task details.',
          life: 3000,
        });
        this.loading.set(false);
        this.close();
      },
    });
  }

  private updateLocalTask(partial: Partial<TaskWithDetails['task']>): void {
    const current = this.taskData();
    if (!current) return;
    this.taskData.set({
      ...current,
      task: { ...current.task, ...partial },
    });
    this.emitTaskCard();
  }

  private emitTaskCard(): void {
    const data = this.taskData();
    if (!data) return;
    this.taskUpdated.emit({
      id: data.task.id,
      title: data.task.title,
      description: data.task.description,
      priority: data.task.priority,
      due_date: data.task.due_date,
      column_id: data.task.column_id,
      position: data.task.position,
      display_id: data.task.display_id,
      assignees: data.assignees,
      labels: data.labels,
      comments_count: data.comments_count,
      attachments_count: data.attachments_count,
    });
  }
}
