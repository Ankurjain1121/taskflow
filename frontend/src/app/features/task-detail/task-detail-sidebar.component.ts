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
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { Tag } from 'primeng/tag';
import {
  Task,
  TaskPriority,
  Assignee,
  Watcher,
  TaskReminder,
} from '../../core/services/task.service';
import { RouterModule } from '@angular/router';
import { Column } from '../../core/services/board.service';
import {
  MemberSearchResult,
  WorkspaceService,
} from '../../core/services/workspace.service';
import { PRIORITY_COLORS } from '../../shared/utils/task-colors';
import {
  formatDate,
  formatShortDate,
  getInitials,
  getAvatarColor,
  getPriorityColor,
  getDueDateDisplayColor,
} from './task-detail-helpers';
import { getPriorityLabel } from '../../shared/utils/task-colors';

@Component({
  selector: 'app-task-detail-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    Select,
    DatePicker,
    InputTextModule,
    ButtonModule,
    Tag,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .field-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--muted-foreground);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.25rem;
      }
      .field-value {
        font-size: 0.875rem;
        color: var(--foreground);
      }
      .sidebar-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        padding: 1.25rem;
      }
      .assignee-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.625rem;
        background: var(--muted);
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
      .reminder-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.15s;
        border: 1px solid var(--border);
      }
      .reminder-chip:hover {
        border-color: var(--primary);
        color: var(--primary);
      }
      .reminder-chip.active {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
      }
    `,
  ],
  template: `
    <div class="space-y-5">
      <!-- Status & Priority -->
      <div class="sidebar-card space-y-4">
        <!-- Column / Status -->
        <div>
          <label class="field-label">Status</label>
          @if (currentColumn()) {
            <div class="flex items-center gap-2 mt-1">
              <span
                class="w-3 h-3 rounded-full flex-shrink-0"
                [style.background-color]="currentColumn()!.color || '#6366f1'"
              ></span>
              <span class="field-value">{{ currentColumn()!.name }}</span>
              @if (currentColumn()!.status_mapping?.done) {
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
                (ngModelChange)="priorityChanged.emit($event); stopEditing()"
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
                [style.background-color]="getPriorityColor(task()!.priority)"
              ></span>
              <span class="field-value">{{
                getPriorityDisplayLabel(task()!.priority)
              }}</span>
            </div>
          }
        </div>

        <!-- Due Date: Read/Edit with Time -->
        <div>
          <label class="field-label">Due Date</label>
          @if (editingField() === 'due_date') {
            <div data-edit-field="due_date">
              <p-datePicker
                [ngModel]="dueDateValue()"
                (ngModelChange)="dueDateChanged.emit($event); stopEditing()"
                dateFormat="yy-mm-dd"
                [showTime]="true"
                [hourFormat]="'12'"
                [showIcon]="true"
                [showClear]="true"
                styleClass="w-full mt-1"
                placeholder="No due date"
                [appendTo]="'body'"
                (onClose)="stopEditing()"
              />
            </div>
          } @else {
            <div (click)="startEditing('due_date')" class="field-editable mt-1">
              @if (task()!.due_date) {
                <span
                  class="field-value"
                  [style.color]="getDueDateDisplayColor(task()!.due_date!)"
                  >{{ formatShortDate(task()!.due_date!) }}</span
                >
              } @else {
                <span
                  style="
                    color: var(--muted-foreground);
                    font-style: italic;
                  "
                  >No due date</span
                >
              }
            </div>
          }
        </div>

        <!-- Reminders (only shown when task has a due date) -->
        @if (task()!.due_date) {
          <div>
            <label class="field-label">Reminders</label>
            <div class="flex flex-wrap gap-1.5 mt-1.5">
              @for (preset of reminderPresets; track preset.minutes) {
                <button
                  class="reminder-chip"
                  [class.active]="isReminderActive(preset.minutes)"
                  (click)="toggleReminder(preset.minutes)"
                >
                  <i class="pi pi-bell text-[10px]"></i>
                  {{ preset.label }}
                </button>
              }
            </div>
            @if (reminders().length > 0) {
              <div class="mt-2 space-y-1">
                @for (reminder of reminders(); track reminder.id) {
                  <div
                    class="flex items-center justify-between text-xs px-2 py-1 rounded"
                    style="background: var(--muted)"
                  >
                    <span style="color: var(--muted-foreground)">
                      <i class="pi pi-bell mr-1 text-[10px]"></i>
                      {{ getReminderLabel(reminder.remind_before_minutes) }}
                      @if (reminder.is_sent) {
                        <span style="color: var(--green-500)"> (sent)</span>
                      }
                    </span>
                    <button
                      (click)="reminderRemoved.emit(reminder.id)"
                      class="opacity-50 hover:opacity-100"
                    >
                      <i class="pi pi-times text-[10px]"></i>
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Assignees -->
      <div class="sidebar-card group">
        <div class="flex items-center justify-between mb-3">
          <label class="field-label mb-0">Assignees</label>
          <button
            (click)="toggleAssigneeSearch()"
            class="text-xs px-2 py-1 rounded transition-all opacity-0 group-hover:opacity-100"
            style="color: var(--primary)"
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
                  (click)="assigneeRemoved.emit(assignee)"
                  class="ml-0.5 opacity-50 hover:opacity-100"
                >
                  <i class="pi pi-times text-[10px]"></i>
                </button>
              </div>
            }
          } @else {
            <span class="text-sm" style="color: var(--muted-foreground)"
              >No assignees</span
            >
          }
        </div>

        @if (showAssigneeSearch()) {
          <div
            class="mt-3 border rounded-lg overflow-hidden"
            style="border-color: var(--border)"
          >
            <input
              pInputText
              type="text"
              [ngModel]="assigneeQuery()"
              (ngModelChange)="onAssigneeSearch($event)"
              placeholder="Search members..."
              class="w-full border-0"
              style="border-bottom: 1px solid var(--border)"
            />
            <div class="max-h-40 overflow-y-auto p-1">
              @for (member of assigneeResults(); track member.id) {
                <button
                  (click)="assigneeAdded.emit(member)"
                  class="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors"
                  style="color: var(--foreground)"
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
                  style="color: var(--muted-foreground)"
                >
                  No members found
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Watchers -->
      <div class="sidebar-card group">
        <div class="flex items-center justify-between mb-3">
          <label class="field-label mb-0">Watchers</label>
          <div
            class="flex gap-1 opacity-0 group-hover:opacity-100 transition-all"
          >
            <button
              (click)="watchSelf.emit()"
              class="text-xs px-2 py-1 rounded"
              style="color: var(--primary)"
              title="Watch this task"
            >
              <i class="pi pi-eye text-xs mr-1"></i>Watch
            </button>
            <button
              (click)="toggleWatcherSearch()"
              class="text-xs px-2 py-1 rounded"
              style="color: var(--primary)"
            >
              <i class="pi pi-plus text-xs mr-1"></i>Add
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          @if (task()!.watchers && task()!.watchers!.length > 0) {
            @for (watcher of task()!.watchers!; track watcher.user_id) {
              <div class="assignee-chip">
                <div
                  class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  [style.background]="
                    watcher.avatar_url
                      ? 'transparent'
                      : getAvatarColor(watcher.name)
                  "
                >
                  @if (watcher.avatar_url) {
                    <img
                      [src]="watcher.avatar_url"
                      [alt]="watcher.name"
                      class="w-full h-full rounded-full object-cover"
                    />
                  } @else {
                    {{ getInitials(watcher.name) }}
                  }
                </div>
                <span>{{ watcher.name }}</span>
                <button
                  (click)="watcherRemoved.emit(watcher)"
                  class="ml-0.5 opacity-50 hover:opacity-100"
                >
                  <i class="pi pi-times text-[10px]"></i>
                </button>
              </div>
            }
          } @else {
            <span class="text-sm" style="color: var(--muted-foreground)"
              >No watchers</span
            >
          }
        </div>

        @if (showWatcherSearch()) {
          <div
            class="mt-3 border rounded-lg overflow-hidden"
            style="border-color: var(--border)"
          >
            <input
              pInputText
              type="text"
              [ngModel]="watcherQuery()"
              (ngModelChange)="onWatcherSearch($event)"
              placeholder="Search members..."
              class="w-full border-0"
              style="border-bottom: 1px solid var(--border)"
            />
            <div class="max-h-40 overflow-y-auto p-1">
              @for (member of watcherResults(); track member.id) {
                <button
                  (click)="watcherAdded.emit(member)"
                  class="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors"
                  style="color: var(--foreground)"
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
              @if (watcherResults().length === 0 && watcherQuery()) {
                <div
                  class="px-2 py-3 text-sm text-center"
                  style="color: var(--muted-foreground)"
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
                  (click)="labelRemoved.emit(label.id)"
                  class="ml-1 hover:opacity-70"
                >
                  <i class="pi pi-times text-[10px]"></i>
                </button>
              </span>
            }
          } @else {
            <span class="text-sm" style="color: var(--muted-foreground)"
              >No labels</span
            >
          }
        </div>
      </div>

      <!-- Parent task -->
      @if (parentTask()) {
        <div class="sidebar-card">
          <label class="field-label">Parent Task</label>
          <a
            [routerLink]="['/task', parentTask()!.id]"
            class="flex items-center gap-2 mt-1.5 text-sm hover:underline"
            style="color: var(--primary)"
          >
            <i class="pi pi-arrow-up-right text-xs"></i>
            {{ parentTask()!.title }}
          </a>
        </div>
      }

      <!-- Child tasks -->
      @if (childrenCount() > 0) {
        <div class="sidebar-card">
          <label class="field-label">Child Tasks</label>
          <div
            class="flex items-center gap-2 mt-1.5 text-sm"
            style="color: var(--muted-foreground)"
          >
            <i class="pi pi-sitemap text-xs"></i>
            <span>{{ childrenCount() }} child task{{ childrenCount() > 1 ? 's' : '' }}</span>
          </div>
        </div>
      }

      <!-- Metadata -->
      <div class="sidebar-card space-y-3">
        <div>
          <label class="field-label">Created</label>
          <p
            class="field-value mt-0.5"
            style="color: var(--muted-foreground)"
          >
            {{ formatDate(task()!.created_at) }}
          </p>
        </div>
        <div>
          <label class="field-label">Updated</label>
          <p
            class="field-value mt-0.5"
            style="color: var(--muted-foreground)"
          >
            {{ formatDate(task()!.updated_at) }}
          </p>
        </div>

        <!-- Delete -->
        <div class="pt-3 border-t" style="border-color: var(--border)">
          <button
            pButton
            label="Delete Task"
            icon="pi pi-trash"
            severity="danger"
            [outlined]="true"
            size="small"
            (click)="deleteRequested.emit()"
            class="w-full"
          ></button>
        </div>
      </div>
    </div>
  `,
})
export class TaskDetailSidebarComponent {
  private workspaceService = inject(WorkspaceService);

  task = input.required<Task>();
  columns = input<Column[]>([]);
  workspaceId = input<string>('');
  reminders = input<TaskReminder[]>([]);
  parentTask = input<Task | null>(null);
  childrenCount = input<number>(0);

  priorityChanged = output<TaskPriority>();
  dueDateChanged = output<Date | null>();
  assigneeAdded = output<MemberSearchResult>();
  assigneeRemoved = output<Assignee>();
  watcherAdded = output<MemberSearchResult>();
  watcherRemoved = output<Watcher>();
  watchSelf = output<void>();
  labelRemoved = output<string>();
  deleteRequested = output<void>();
  reminderSet = output<number>();
  reminderRemoved = output<string>();

  editingField = signal<string | null>(null);
  showAssigneeSearch = signal(false);
  assigneeQuery = signal('');
  assigneeResults = signal<MemberSearchResult[]>([]);
  showWatcherSearch = signal(false);
  watcherQuery = signal('');
  watcherResults = signal<MemberSearchResult[]>([]);

  currentColumn = computed(() => {
    const t = this.task();
    const cols = this.columns();
    if (!t || !cols.length) return null;
    return cols.find((c) => c.id === (t.status_id ?? t.column_id)) ?? null;
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

  readonly reminderPresets = [
    { minutes: 15, label: '15 min' },
    { minutes: 30, label: '30 min' },
    { minutes: 60, label: '1 hour' },
    { minutes: 1440, label: '1 day' },
  ];

  formatDate = formatDate;
  formatShortDate = formatShortDate;
  getInitials = getInitials;
  getAvatarColor = getAvatarColor;
  getPriorityColor = getPriorityColor;
  getDueDateDisplayColor = getDueDateDisplayColor;

  getPriorityDisplayLabel(priority: TaskPriority): string {
    return getPriorityLabel(priority);
  }

  isReminderActive(minutes: number): boolean {
    return this.reminders().some((r) => r.remind_before_minutes === minutes);
  }

  getReminderLabel(minutes: number): string {
    const preset = this.reminderPresets.find((p) => p.minutes === minutes);
    if (preset) return preset.label + ' before';
    if (minutes < 60) return minutes + ' min before';
    if (minutes < 1440) return Math.round(minutes / 60) + ' hr before';
    return Math.round(minutes / 1440) + ' day before';
  }

  toggleReminder(minutes: number): void {
    if (this.isReminderActive(minutes)) {
      const reminder = this.reminders().find(
        (r) => r.remind_before_minutes === minutes,
      );
      if (reminder) {
        this.reminderRemoved.emit(reminder.id);
      }
    } else {
      this.reminderSet.emit(minutes);
    }
  }

  startEditing(field: string): void {
    this.editingField.set(field);
  }

  stopEditing(): void {
    this.editingField.set(null);
  }

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

    this.workspaceService.searchMembers(this.workspaceId(), query).subscribe({
      next: (results) => this.assigneeResults.set(results),
      error: () => this.assigneeResults.set([]),
    });
  }

  toggleWatcherSearch(): void {
    this.showWatcherSearch.update((v) => !v);
    if (!this.showWatcherSearch()) {
      this.watcherQuery.set('');
      this.watcherResults.set([]);
    }
  }

  onWatcherSearch(query: string): void {
    this.watcherQuery.set(query);
    if (!query || query.length < 2) {
      this.watcherResults.set([]);
      return;
    }

    this.workspaceService.searchMembers(this.workspaceId(), query).subscribe({
      next: (results) => this.watcherResults.set(results),
      error: () => this.watcherResults.set([]),
    });
  }
}
