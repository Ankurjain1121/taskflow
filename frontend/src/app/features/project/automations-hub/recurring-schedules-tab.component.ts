import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { MultiSelect } from 'primeng/multiselect';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';

import {
  RecurringService,
  RecurringConfigWithTask,
  RecurrencePattern,
  CreationMode,
  TaskTemplateData,
  CreateTemplateRecurringRequest,
} from '../../../core/services/recurring.service';
import { TaskPriority } from '../../../core/services/task.service';
import {
  ProjectService,
  ProjectMember,
} from '../../../core/services/project.service';
import { PRIORITY_COLORS } from '../../../shared/constants/priority-colors';

interface TimelineDot {
  configId: string;
  taskTitle: string;
  color: string;
}

interface TimelineDay {
  date: Date;
  label: string;
  isToday: boolean;
  isWeekend: boolean;
  dots: TimelineDot[];
}

@Component({
  selector: 'app-recurring-schedules-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    Dialog,
    Select,
    MultiSelect,
    DatePicker,
    InputNumber,
    InputTextModule,
    TextareaModule,
    ToggleSwitch,
    DatePipe,
  ],
  template: `
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-semibold font-display text-[var(--foreground)]">
          Recurring Schedules
        </h2>
        <p class="text-sm text-[var(--muted-foreground)] mt-1">
          Automated task creation on a schedule
        </p>
      </div>
      @if (configs().length > 0) {
        <button
          pButton
          label="Create Scheduled Task"
          icon="pi pi-plus"
          (click)="showCreateDialog.set(true)"
        ></button>
      }
    </div>

    <!-- Loading -->
    @if (loading()) {
      <div class="flex items-center justify-center py-16">
        <i class="pi pi-spin pi-spinner text-2xl text-[var(--muted-foreground)]"></i>
      </div>
    }

    <!-- Empty State -->
    @if (!loading() && configs().length === 0) {
      <div
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <i
          class="pi pi-calendar text-4xl text-[var(--muted-foreground)] opacity-40 mb-4"
        ></i>
        <h3 class="text-lg font-medium text-[var(--foreground)] mb-2">
          No recurring schedules yet
        </h3>
        <p class="text-sm text-[var(--muted-foreground)] mb-6">
          Create automated task schedules to stay on top of recurring work.
        </p>
        <button
          pButton
          label="Create Scheduled Task"
          icon="pi pi-plus"
          (click)="showCreateDialog.set(true)"
        ></button>
      </div>
    }

    <!-- Card List -->
    @if (!loading() && configs().length > 0) {
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        @for (config of configs(); track config.id) {
          <div
            class="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 hover:shadow-md transition-shadow"
          >
            <!-- Header: task title + active badge -->
            <div class="flex items-center justify-between mb-3">
              @if (config.task_id) {
                <a
                  [routerLink]="[
                    '/workspace',
                    workspaceId(),
                    'project',
                    projectId(),
                    'task',
                    config.task_id
                  ]"
                  class="text-sm font-medium text-[var(--foreground)] hover:text-[var(--primary)] transition-colors truncate mr-2"
                >
                  {{ config.task_title }}
                </a>
              } @else {
                <span class="text-sm font-medium text-[var(--foreground)] truncate mr-2">
                  {{ config.task_title }}
                  <span class="text-xs text-[var(--muted-foreground)] ml-1">(template)</span>
                </span>
              }
              <span
                class="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
                [class]="
                  config.is_active
                    ? 'bg-[var(--success)]/15 text-[var(--success)]'
                    : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                "
              >
                {{ config.is_active ? 'Active' : 'Paused' }}
              </span>
            </div>
            <!-- Details grid -->
            <div
              class="grid grid-cols-2 gap-2 text-xs text-[var(--muted-foreground)]"
            >
              <div>
                <i class="pi pi-refresh mr-1"></i
                >{{ getPatternLabel(config.pattern) }}
              </div>
              <div>
                <i class="pi pi-calendar mr-1"></i>Next:
                {{ config.next_run_at | date: 'mediumDate' }}
              </div>
              <div>
                <i class="pi pi-clock mr-1"></i>Last:
                {{
                  config.last_run_at
                    ? (config.last_run_at | date: 'mediumDate')
                    : 'Never'
                }}
              </div>
              <div>
                <i class="pi pi-chart-bar mr-1"></i
                >{{ config.occurrences_created }} created
              </div>
              @if (config.task_template?.subtasks?.length) {
                <div>
                  <i class="pi pi-list mr-1"></i>{{ config.task_template!.subtasks.length }} subtasks
                </div>
              }
            </div>
            <!-- Actions -->
            <div
              class="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-[var(--border)]"
            >
              <p-toggleSwitch
                [ngModel]="config.is_active"
                (onChange)="toggleActive(config)"
              />
              <button
                pButton
                icon="pi pi-trash"
                severity="danger"
                [text]="true"
                size="small"
                (click)="deleteConfig(config)"
              ></button>
            </div>
          </div>
        }
      </div>

      <!-- 30-Day Timeline -->
      @if (timelineDays().length > 0) {
        <div class="mt-8">
          <h3
            class="text-sm font-semibold font-display text-[var(--foreground)] mb-4"
          >
            Upcoming Schedule (30 days)
          </h3>
          <div
            class="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div class="flex gap-1" style="min-width: max-content">
              @for (day of timelineDays(); track day.label) {
                <div
                  class="flex flex-col items-center w-8"
                  [class.opacity-40]="day.isWeekend"
                >
                  <span
                    class="text-[10px] text-[var(--muted-foreground)] mb-1"
                    >{{ day.label }}</span
                  >
                  <div
                    class="w-7 h-7 rounded flex items-center justify-center text-[10px]"
                    [class]="
                      day.isToday
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-bold'
                        : 'bg-[var(--secondary)]'
                    "
                  >
                    {{ day.date.getDate() }}
                  </div>
                  <div class="flex flex-col gap-0.5 mt-1 min-h-[12px]">
                    @for (dot of day.dots; track dot.configId) {
                      <div
                        class="w-2.5 h-2.5 rounded-full"
                        [style.background-color]="dot.color"
                        [title]="dot.taskTitle"
                      ></div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }
    }

    <!-- Create Dialog -->
    <p-dialog
      header="Create Scheduled Task"
      [(visible)]="showCreateDialogVisible"
      [modal]="true"
      [style]="{ width: '720px' }"
      [breakpoints]="{ '767px': '95vw' }"
      [contentStyle]="{ overflow: 'auto', 'max-height': '70vh' }"
      [closable]="true"
      [draggable]="false"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- LEFT COLUMN: Task Details -->
        <div class="flex flex-col gap-4">
          <!-- Title -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-[var(--foreground)]"
              >Title <span class="text-red-400">*</span></label
            >
            <input
              pInputText
              [(ngModel)]="newTitle"
              placeholder="What needs to be done?"
              class="w-full"
            />
          </div>

          <!-- Description -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-[var(--foreground)]"
              >Description</label
            >
            <textarea
              pTextarea
              [(ngModel)]="newDescription"
              placeholder="Add details..."
              [rows]="3"
              class="w-full"
            ></textarea>
          </div>

          <!-- Priority + Estimated Hours -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--foreground)]"
                >Priority</label
              >
              <p-select
                [(ngModel)]="newPriority"
                [options]="priorities"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full"
                appendTo="body"
              >
                <ng-template #selectedItem let-selected>
                  @if (selected) {
                    <div class="flex items-center gap-2">
                      <span
                        class="w-2 h-2 rounded-full inline-block"
                        [style.background-color]="selected.color"
                      ></span>
                      {{ selected.label }}
                    </div>
                  }
                </ng-template>
                <ng-template #item let-priority>
                  <div class="flex items-center gap-2">
                    <span
                      class="w-2 h-2 rounded-full inline-block"
                      [style.background-color]="priority.color"
                    ></span>
                    {{ priority.label }}
                  </div>
                </ng-template>
              </p-select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--foreground)]"
                >Est. Hours</label
              >
              <p-inputNumber
                [(ngModel)]="newEstimatedHours"
                [min]="0"
                [maxFractionDigits]="1"
                placeholder="e.g. 4"
                styleClass="w-full"
              />
            </div>
          </div>

          <!-- Dates -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--foreground)]"
                >Start Date</label
              >
              <p-datePicker
                [(ngModel)]="newStartDate"
                placeholder="Select date"
                [showIcon]="true"
                dateFormat="yy-mm-dd"
                styleClass="w-full"
                appendTo="body"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--foreground)]"
                >Due Date</label
              >
              <p-datePicker
                [(ngModel)]="newDueDate"
                placeholder="Select date"
                [showIcon]="true"
                dateFormat="yy-mm-dd"
                styleClass="w-full"
                appendTo="body"
              />
            </div>
          </div>

          <!-- Recurrence Pattern -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-[var(--foreground)]"
              >Recurrence Pattern</label
            >
            <p-select
              [(ngModel)]="newPattern"
              [options]="patternOptions"
              optionLabel="label"
              optionValue="value"
              styleClass="w-full"
              appendTo="body"
            />
          </div>

          <!-- Day of Month (conditional) -->
          @if (newPattern === 'monthly') {
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--foreground)]"
                >Day of Month</label
              >
              <p-inputNumber
                [(ngModel)]="newDayOfMonth"
                [min]="1"
                [max]="31"
                placeholder="e.g. 15"
                styleClass="w-full"
              />
            </div>
          }

          <!-- Creation Mode -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-[var(--foreground)]"
              >Creation Mode</label
            >
            <p-select
              [(ngModel)]="newCreationMode"
              [options]="creationModeOptions"
              optionLabel="label"
              optionValue="value"
              styleClass="w-full"
              appendTo="body"
            />
          </div>

          <!-- Subtasks -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-[var(--foreground)]">Subtasks</label>
            @for (subtask of newSubtasks; track $index) {
              <div class="flex items-center gap-2">
                <input
                  pInputText
                  [(ngModel)]="subtask.title"
                  placeholder="Subtask title"
                  class="flex-1"
                />
                @if (members().length > 0) {
                  <p-select
                    [(ngModel)]="subtask.assigned_to_id"
                    [options]="members()"
                    optionLabel="name"
                    optionValue="user_id"
                    placeholder="Assign"
                    [showClear]="true"
                    styleClass="w-36"
                    appendTo="body"
                  />
                }
                <button
                  pButton
                  icon="pi pi-times"
                  severity="danger"
                  [text]="true"
                  size="small"
                  (click)="removeSubtask($index)"
                ></button>
              </div>
            }
            <button
              pButton
              label="Add Subtask"
              icon="pi pi-plus"
              [text]="true"
              size="small"
              severity="secondary"
              (click)="addSubtask()"
              class="self-start"
            ></button>
          </div>
        </div>

        <!-- RIGHT COLUMN: People -->
        <div class="flex flex-col gap-4">
          @if (members().length > 0) {
            <!-- Assignees -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--foreground)]"
                >Assignees</label
              >
              <p-multiSelect
                [(ngModel)]="newAssigneeIds"
                [options]="members()"
                optionLabel="name"
                optionValue="user_id"
                placeholder="Select assignees"
                styleClass="w-full"
                [showClear]="true"
                appendTo="body"
              >
                <ng-template #item let-member>
                  <div class="flex items-center gap-2">
                    <div
                      class="w-6 h-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center text-xs font-medium"
                    >
                      {{ member.name.charAt(0).toUpperCase() }}
                    </div>
                    {{ member.name }}
                  </div>
                </ng-template>
              </p-multiSelect>
            </div>

            <!-- Reporting To -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--foreground)]"
                >Reporting To</label
              >
              <p-select
                [(ngModel)]="newReportingPersonId"
                [options]="members()"
                optionLabel="name"
                optionValue="user_id"
                placeholder="Select reporting person"
                styleClass="w-full"
                [showClear]="true"
                appendTo="body"
              />
            </div>

            <!-- Watchers -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[var(--foreground)]"
                >Watchers</label
              >
              <p-multiSelect
                [(ngModel)]="newWatcherIds"
                [options]="members()"
                optionLabel="name"
                optionValue="user_id"
                placeholder="Who should watch this task?"
                styleClass="w-full"
                [showClear]="true"
                appendTo="body"
              >
                <ng-template #item let-member>
                  <div class="flex items-center gap-2">
                    <div
                      class="w-6 h-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center text-xs font-medium"
                    >
                      {{ member.name.charAt(0).toUpperCase() }}
                    </div>
                    {{ member.name }}
                  </div>
                </ng-template>
              </p-multiSelect>
            </div>
          } @else {
            <div class="flex flex-col items-center justify-center py-8 text-center">
              <i class="pi pi-users text-2xl text-[var(--muted-foreground)] opacity-40 mb-2"></i>
              <p class="text-sm text-[var(--muted-foreground)]">No project members yet</p>
              <p class="text-xs text-[var(--muted-foreground)] opacity-70 mt-1">Add members in project settings to assign tasks</p>
            </div>
          }
        </div>
      </div>

      <ng-template #footer>
        <div class="flex items-center justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="showCreateDialog.set(false)"
          />
          <p-button
            label="Create"
            icon="pi pi-plus"
            (onClick)="onCreateScheduledTask()"
            [disabled]="!newTitle.trim() || saving()"
            [loading]="saving()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class RecurringSchedulesTabComponent implements OnInit {
  projectId = input.required<string>();
  workspaceId = input.required<string>();

  private recurringService = inject(RecurringService);
  private projectService = inject(ProjectService);
  private messageService = inject(MessageService);

  configs = signal<RecurringConfigWithTask[]>([]);
  loading = signal(true);
  showCreateDialog = signal(false);
  saving = signal(false);
  timelineDays = signal<TimelineDay[]>([]);
  members = signal<ProjectMember[]>([]);

  // Create dialog form state
  newTitle = '';
  newDescription = '';
  newPriority: TaskPriority = 'medium';
  newEstimatedHours: number | null = null;
  newStartDate: Date | null = null;
  newDueDate: Date | null = null;
  newPattern: RecurrencePattern = 'weekly';
  newCreationMode: CreationMode = 'on_schedule';
  newDayOfMonth: number | null = null;
  newAssigneeIds: string[] = [];
  newReportingPersonId: string | null = null;
  newWatcherIds: string[] = [];
  newSubtasks: { title: string; assigned_to_id: string | null }[] = [];

  priorities = [
    { value: 'low', label: 'Low', color: PRIORITY_COLORS['low'] },
    { value: 'medium', label: 'Medium', color: PRIORITY_COLORS['medium'] },
    { value: 'high', label: 'High', color: PRIORITY_COLORS['high'] },
    { value: 'urgent', label: 'Urgent', color: PRIORITY_COLORS['urgent'] },
  ];

  patternOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Biweekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  creationModeOptions = [
    { value: 'on_schedule', label: 'On schedule' },
    { value: 'on_completion', label: 'When completed' },
  ];

  private readonly patternLabels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Biweekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
    weekdays: 'Weekdays',
    custom_weekly: 'Custom Weekly',
    custom: 'Custom',
  };

  private readonly dotColors = [
    '#60a5fa', '#f97316', '#a78bfa', '#34d399',
    '#fb7185', '#fbbf24', '#38bdf8', '#c084fc',
  ];

  get showCreateDialogVisible(): boolean {
    return this.showCreateDialog();
  }

  set showCreateDialogVisible(val: boolean) {
    this.showCreateDialog.set(val);
    if (val) {
      this.resetCreateForm();
    }
  }

  ngOnInit(): void {
    this.loadConfigs();
    this.loadMembers();
  }

  getPatternLabel(pattern: string): string {
    return this.patternLabels[pattern] ?? pattern;
  }

  toggleActive(config: RecurringConfigWithTask): void {
    this.recurringService
      .updateConfig(config.id, { is_active: !config.is_active })
      .subscribe({
        next: (updated) => {
          this.configs.update((list) =>
            list.map((c) =>
              c.id === config.id
                ? { ...c, is_active: updated.is_active }
                : c,
            ),
          );
          this.buildTimeline();
          this.messageService.add({
            severity: 'success',
            summary: updated.is_active ? 'Activated' : 'Paused',
            detail: `Schedule "${config.task_title}" ${updated.is_active ? 'activated' : 'paused'}`,
            life: 3000,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update schedule',
            life: 4000,
          });
        },
      });
  }

  deleteConfig(config: RecurringConfigWithTask): void {
    if (!confirm(`Delete recurring schedule for "${config.task_title}"?`)) {
      return;
    }
    this.recurringService.deleteConfig(config.id).subscribe({
      next: () => {
        this.configs.update((list) =>
          list.filter((c) => c.id !== config.id),
        );
        this.buildTimeline();
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Recurring schedule removed',
          life: 3000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete schedule',
          life: 4000,
        });
      },
    });
  }

  onCreateScheduledTask(): void {
    const title = this.newTitle.trim();
    if (!title || this.saving()) return;

    this.saving.set(true);

    const template: TaskTemplateData = {
      title,
      description: this.newDescription.trim() || undefined,
      priority: this.newPriority,
      estimated_hours: this.newEstimatedHours ?? undefined,
      assignee_ids: this.newAssigneeIds,
      reporting_person_id: this.newReportingPersonId ?? undefined,
      watcher_ids: this.newWatcherIds,
      label_ids: [],
      subtasks: this.newSubtasks
        .filter((s) => s.title.trim())
        .map((s) => ({
          title: s.title.trim(),
          assigned_to_id: s.assigned_to_id ?? undefined,
        })),
    };

    const startDate = this.newStartDate
      ? this.newStartDate.toISOString()
      : new Date(Date.now() + 86400000).toISOString();

    const req: CreateTemplateRecurringRequest = {
      template,
      pattern: this.newPattern,
      start_date: startDate,
      creation_mode: this.newCreationMode,
      day_of_month:
        this.newPattern === 'monthly'
          ? (this.newDayOfMonth ?? undefined)
          : undefined,
    };

    this.recurringService.createTemplateConfig(this.projectId(), req).subscribe({
      next: () => {
        this.saving.set(false);
        this.showCreateDialog.set(false);
        this.loadConfigs();
        this.messageService.add({
          severity: 'success',
          summary: 'Created',
          detail: `Scheduled task "${title}" created`,
          life: 3000,
        });
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to create scheduled task',
          life: 4000,
        });
      },
    });
  }

  addSubtask(): void {
    this.newSubtasks = [...this.newSubtasks, { title: '', assigned_to_id: null }];
  }

  removeSubtask(index: number): void {
    this.newSubtasks = this.newSubtasks.filter((_, i) => i !== index);
  }

  private loadConfigs(): void {
    this.loading.set(true);
    this.recurringService.listByProject(this.projectId()).subscribe({
      next: (data) => {
        this.configs.set(data);
        this.loading.set(false);
        this.buildTimeline();
      },
      error: () => {
        this.configs.set([]);
        this.loading.set(false);
      },
    });
  }

  private loadMembers(): void {
    this.projectService.getProjectMembers(this.projectId()).subscribe({
      next: (data) => this.members.set(data),
      error: () => this.members.set([]),
    });
  }

  private resetCreateForm(): void {
    this.newTitle = '';
    this.newDescription = '';
    this.newPriority = 'medium';
    this.newEstimatedHours = null;
    this.newStartDate = null;
    this.newDueDate = null;
    this.newPattern = 'weekly';
    this.newCreationMode = 'on_schedule';
    this.newDayOfMonth = null;
    this.newAssigneeIds = [];
    this.newReportingPersonId = null;
    this.newWatcherIds = [];
    this.newSubtasks = [];
  }

  private buildTimeline(): void {
    const activeConfigs = this.configs().filter((c) => c.is_active);
    if (activeConfigs.length === 0) {
      this.timelineDays.set([]);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: TimelineDay[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      days.push({
        date,
        label: dayNames[date.getDay()],
        isToday: i === 0,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        dots: [],
      });
    }

    activeConfigs.forEach((config, idx) => {
      const color = this.dotColors[idx % this.dotColors.length];
      const nextRun = new Date(config.next_run_at);
      nextRun.setHours(0, 0, 0, 0);
      const intervalDays = this.getIntervalForPattern(config.pattern, config.interval_days);

      if (intervalDays <= 0) {
        // For patterns we can't easily calculate, just show next_run_at
        days.forEach((day) => {
          if (day.date.getTime() === nextRun.getTime()) {
            day.dots.push({
              configId: config.id,
              taskTitle: config.task_title,
              color,
            });
          }
        });
        return;
      }

      let cursor = new Date(nextRun);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 30);

      while (cursor <= endDate) {
        if (cursor >= today) {
          const dayIndex = Math.round(
            (cursor.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (dayIndex >= 0 && dayIndex < 30) {
            days[dayIndex].dots.push({
              configId: config.id,
              taskTitle: config.task_title,
              color,
            });
          }
        }
        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() + intervalDays);
      }
    });

    this.timelineDays.set(days);
  }

  private getIntervalForPattern(
    pattern: RecurrencePattern,
    intervalDays: number | null,
  ): number {
    switch (pattern) {
      case 'daily':
      case 'weekdays':
        return 1;
      case 'weekly':
        return 7;
      case 'biweekly':
        return 14;
      case 'monthly':
        return 30;
      case 'yearly':
        return 365;
      case 'custom':
        return intervalDays ?? 0;
      default:
        return 0;
    }
  }
}
