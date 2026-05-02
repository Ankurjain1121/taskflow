import {
  Component,
  DestroyRef,
  inject,
  input,
  signal,
  computed,
  model,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  FormsModule,
  Validators,
} from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { MultiSelect } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';
import {
  TaskService,
  TaskPriority,
  CreateTaskRequest,
} from '../../../core/services/task.service';
import {
  ProjectService,
  ProjectMember,
  ProjectStatus,
} from '../../../core/services/project.service';
import { RecurrencePattern } from '../../../core/services/recurring.service';
import { PRIORITY_COLORS } from '../../constants/priority-colors';

@Component({
  selector: 'app-quick-create-task-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    Dialog,
    InputTextModule,
    Textarea,
    Select,
    DatePicker,
    InputNumber,
    MultiSelect,
    ButtonModule,
    Checkbox,
  ],
  template: `
    <p-dialog
      header="Create Task"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '780px' }"
      [breakpoints]="{ '899px': '95vw' }"
      [contentStyle]="{ 'max-height': '75vh', 'overflow-y': 'auto' }"
      [closable]="true"
      [draggable]="false"
      (onShow)="onDialogShow()"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <!-- Project + Status row -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label
              for="qcProject"
              class="text-sm font-medium text-[var(--foreground)]"
              >Project <span class="text-[var(--destructive)]">*</span></label
            >
            <p-select
              inputId="qcProject"
              formControlName="projectId"
              [options]="projectOptions()"
              optionLabel="name"
              optionValue="id"
              placeholder="Select a project"
              [filter]="projectOptions().length > 5"
              filterPlaceholder="Search projects..."
              class="w-full"
              styleClass="w-full"
              appendTo="body"
            />
            @if (
              form.controls.projectId.hasError('required') &&
              form.controls.projectId.touched
            ) {
              <small class="text-[var(--destructive)]"
                >Project is required</small
              >
            }
          </div>

          <div class="flex flex-col gap-1">
            <label
              for="qcStatus"
              class="text-sm font-medium text-[var(--foreground)]"
              >Status</label
            >
            <p-select
              inputId="qcStatus"
              formControlName="statusId"
              [options]="statuses()"
              optionLabel="name"
              optionValue="id"
              placeholder="Default status"
              class="w-full"
              styleClass="w-full"
              [disabled]="!form.controls.projectId.value || loadingMeta()"
              appendTo="body"
            >
              <ng-template #selectedItem let-selected>
                @if (selected) {
                  <div class="flex items-center gap-2">
                    <span
                      class="w-2.5 h-2.5 rounded-full inline-block"
                      [style.background-color]="selected.color"
                    ></span>
                    {{ selected.name }}
                  </div>
                }
              </ng-template>
              <ng-template #item let-status>
                <div class="flex items-center gap-2">
                  <span
                    class="w-2.5 h-2.5 rounded-full inline-block"
                    [style.background-color]="status.color"
                  ></span>
                  {{ status.name }}
                </div>
              </ng-template>
            </p-select>
          </div>
        </div>

        <!-- Title -->
        <div class="flex flex-col gap-1">
          <label
            for="qcTitle"
            class="text-sm font-medium text-[var(--foreground)]"
            >Title <span class="text-[var(--destructive)]">*</span></label
          >
          <input
            pInputText
            id="qcTitle"
            formControlName="title"
            placeholder="What needs to be done?"
            class="w-full"
          />
          @if (
            form.controls.title.hasError('required') &&
            form.controls.title.touched
          ) {
            <small class="text-[var(--destructive)]">Title is required</small>
          }
          @if (form.controls.title.hasError('maxlength')) {
            <small class="text-[var(--destructive)]"
              >Max 200 characters</small
            >
          }
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-1">
          <label
            for="qcDesc"
            class="text-sm font-medium text-[var(--foreground)]"
            >Description</label
          >
          <textarea
            pTextarea
            id="qcDesc"
            formControlName="description"
            placeholder="Add details (optional)"
            rows="2"
            class="w-full"
          ></textarea>
        </div>

        <!-- Two-column layout: Details + People -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <!-- LEFT: Task details -->
          <div class="flex flex-col gap-4">
            <!-- Priority + Estimated Hours -->
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1">
                <label
                  for="qcPriority"
                  class="text-sm font-medium text-[var(--foreground)]"
                  >Priority</label
                >
                <p-select
                  inputId="qcPriority"
                  formControlName="priority"
                  [options]="priorities"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full"
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
                <label
                  for="qcEstHours"
                  class="text-sm font-medium text-[var(--foreground)]"
                  >Est. Hours</label
                >
                <p-inputNumber
                  inputId="qcEstHours"
                  formControlName="estimatedHours"
                  placeholder="e.g., 4"
                  [min]="0"
                  [max]="9999"
                  [step]="0.5"
                  suffix=" hrs"
                  [minFractionDigits]="0"
                  [maxFractionDigits]="1"
                  styleClass="w-full"
                />
              </div>
            </div>

            <!-- Start Date + Due Date -->
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1">
                <label
                  for="qcStartDate"
                  class="text-sm font-medium text-[var(--foreground)]"
                  >Start Date</label
                >
                <p-datePicker
                  inputId="qcStartDate"
                  formControlName="startDate"
                  placeholder="Select date"
                  [showIcon]="true"
                  dateFormat="yy-mm-dd"
                  styleClass="w-full"
                  appendTo="body"
                />
              </div>

              <div class="flex flex-col gap-1">
                <label
                  for="qcDueDate"
                  class="text-sm font-medium text-[var(--foreground)]"
                  >Due Date</label
                >
                <p-datePicker
                  inputId="qcDueDate"
                  formControlName="dueDate"
                  placeholder="Select date"
                  [showIcon]="true"
                  dateFormat="yy-mm-dd"
                  styleClass="w-full"
                  appendTo="body"
                />
              </div>
            </div>

            <!-- Time toggle + time inputs -->
            <button
              type="button"
              (click)="toggleTime()"
              class="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline -mt-2"
            >
              <i class="pi pi-clock text-xs"></i>
              {{ showTimeInputs() ? 'Remove time' : 'Add time' }}
            </button>

            @if (showTimeInputs()) {
              <div class="grid grid-cols-2 gap-4 -mt-2">
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--muted-foreground)]"
                    >Start Time</label
                  >
                  <p-datePicker
                    formControlName="startTime"
                    [timeOnly]="true"
                    [hourFormat]="'12'"
                    placeholder="HH:MM"
                    styleClass="w-full"
                    appendTo="body"
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--muted-foreground)]"
                    >Due Time</label
                  >
                  <p-datePicker
                    formControlName="dueTime"
                    [timeOnly]="true"
                    [hourFormat]="'12'"
                    placeholder="HH:MM"
                    styleClass="w-full"
                    appendTo="body"
                  />
                </div>
              </div>
            }

            <!-- Recurring Task -->
            <div class="flex items-center gap-3">
              <p-checkbox
                inputId="qcIsRecurring"
                formControlName="isRecurring"
                [binary]="true"
              />
              <label
                for="qcIsRecurring"
                class="text-sm font-medium text-[var(--foreground)]"
                >Recurring task</label
              >
              @if (isRecurringChecked()) {
                <div class="flex-1">
                  <p-select
                    formControlName="recurrencePattern"
                    [options]="recurrenceOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                    styleClass="w-full"
                    appendTo="body"
                  />
                </div>
              }
            </div>
          </div>

          <!-- RIGHT: People -->
          <div class="flex flex-col gap-4">
            @if (loadingMeta()) {
              <div
                class="flex items-center justify-center py-6 text-sm text-[var(--muted-foreground)]"
              >
                <i class="pi pi-spinner pi-spin mr-2"></i>
                Loading project details...
              </div>
            } @else if (!form.controls.projectId.value) {
              <div
                class="flex flex-col items-center justify-center h-full text-center py-6"
              >
                <i
                  class="pi pi-arrow-left text-2xl text-[var(--muted-foreground)] opacity-40 mb-2"
                ></i>
                <p class="text-sm text-[var(--muted-foreground)]">
                  Select a project first
                </p>
                <p
                  class="text-xs text-[var(--muted-foreground)] opacity-70 mt-1"
                >
                  Members and statuses load from the selected project
                </p>
              </div>
            } @else if (members().length > 0) {
              <!-- Assignees -->
              <div class="flex flex-col gap-1">
                <label
                  for="qcAssignees"
                  class="text-sm font-medium text-[var(--foreground)]"
                  >Assignees</label
                >
                <p-multiSelect
                  inputId="qcAssignees"
                  formControlName="assigneeIds"
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
                        {{
                          (member.name || member.email || '?')
                            .charAt(0)
                            .toUpperCase()
                        }}
                      </div>
                      {{ member.name || member.email }}
                    </div>
                  </ng-template>
                </p-multiSelect>
              </div>

              <!-- Reporting To -->
              <div class="flex flex-col gap-1">
                <label
                  for="qcReportingTo"
                  class="text-sm font-medium text-[var(--foreground)]"
                  >Reporting To</label
                >
                <p-select
                  inputId="qcReportingTo"
                  formControlName="reportingPersonId"
                  [options]="members()"
                  optionLabel="name"
                  optionValue="user_id"
                  placeholder="Select reporting person"
                  class="w-full"
                  styleClass="w-full"
                  [showClear]="true"
                  appendTo="body"
                />
              </div>

              <!-- Watchers -->
              <div class="flex flex-col gap-1">
                <label
                  for="qcWatchers"
                  class="text-sm font-medium text-[var(--foreground)]"
                  >Watchers</label
                >
                <p-multiSelect
                  inputId="qcWatchers"
                  formControlName="watcherIds"
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
                        {{
                          (member.name || member.email || '?')
                            .charAt(0)
                            .toUpperCase()
                        }}
                      </div>
                      {{ member.name || member.email }}
                    </div>
                  </ng-template>
                </p-multiSelect>
              </div>
            } @else {
              <div
                class="flex flex-col items-center justify-center h-full text-center py-6"
              >
                <svg
                  class="w-10 h-10 text-[var(--muted-foreground)] opacity-40 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <p class="text-sm text-[var(--muted-foreground)]">
                  No project members yet
                </p>
                <p
                  class="text-xs text-[var(--muted-foreground)] opacity-70 mt-1"
                >
                  Add members in project settings to assign tasks
                </p>
              </div>
            }
          </div>
        </div>
      </form>

      <ng-template #footer>
        <div class="flex items-center justify-between">
          <div
            class="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"
          >
            <kbd class="kbd-hint">ESC</kbd>
            <span>close</span>
          </div>
          <div class="flex items-center gap-2">
            <p-button
              label="Cancel"
              [text]="true"
              severity="secondary"
              (onClick)="visible.set(false)"
            />
            <p-button
              label="Create Task"
              icon="pi pi-plus"
              (onClick)="onSave()"
              [disabled]="form.invalid || saving()"
              [loading]="saving()"
            />
          </div>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class QuickCreateTaskDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly wsContext = inject(WorkspaceContextService);
  private readonly taskService = inject(TaskService);
  private readonly projectService = inject(ProjectService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  visible = model(false);
  initialPriority = input<TaskPriority | null>(null);
  initialDueDate = input<Date | null>(null);
  initialProjectId = input<string | null>(null);
  saving = signal(false);
  loadingMeta = signal(false);
  showTimeInputs = signal(false);

  members = signal<ProjectMember[]>([]);
  statuses = signal<ProjectStatus[]>([]);

  readonly priorities = [
    { value: 'low', label: 'Low', color: PRIORITY_COLORS['low'] },
    { value: 'medium', label: 'Medium', color: PRIORITY_COLORS['medium'] },
    { value: 'high', label: 'High', color: PRIORITY_COLORS['high'] },
    { value: 'urgent', label: 'Urgent', color: PRIORITY_COLORS['urgent'] },
  ];

  readonly recurrenceOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Biweekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  readonly projectOptions = computed(() =>
    this.wsContext.getOrderedProjects(),
  );

  readonly form = this.fb.nonNullable.group({
    projectId: ['', [Validators.required]],
    statusId: [''],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    priority: ['medium' as TaskPriority],
    startDate: [null as Date | null],
    dueDate: [null as Date | null],
    startTime: [null as Date | null],
    dueTime: [null as Date | null],
    estimatedHours: [
      null as number | null,
      [Validators.min(0), Validators.max(9999)],
    ],
    assigneeIds: [[] as string[]],
    reportingPersonId: ['' as string],
    watcherIds: [[] as string[]],
    isRecurring: [false],
    recurrencePattern: ['weekly' as RecurrencePattern],
  });

  isRecurringChecked = toSignal(
    this.form.controls.isRecurring.valueChanges,
    { initialValue: false },
  );

  constructor() {
    // Watch project changes to load members + statuses
    effect(() => {
      // Read form value reactively via subscription in constructor
    });

    this.form.controls.projectId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((projectId) => {
        this.onProjectChanged(projectId);
      });
  }

  onDialogShow(): void {
    const priority = this.initialPriority() ?? 'medium';
    const dueDate = this.initialDueDate() ?? null;
    const projectId = this.initialProjectId();

    this.form.reset({
      projectId: '',
      statusId: '',
      title: '',
      description: '',
      priority,
      startDate: null,
      dueDate,
      startTime: null,
      dueTime: null,
      estimatedHours: null,
      assigneeIds: [],
      reportingPersonId: '',
      watcherIds: [],
      isRecurring: false,
      recurrencePattern: 'weekly',
    });
    this.members.set([]);
    this.statuses.set([]);
    this.showTimeInputs.set(false);

    // Auto-select project: prefer initialProjectId, then first available
    const projects = this.projectOptions();
    const targetProject = projectId
      ? projects.find(p => p.id === projectId)
      : null;
    if (targetProject) {
      this.form.patchValue({ projectId: targetProject.id });
    } else if (projects.length > 0) {
      this.form.patchValue({ projectId: projects[0].id });
    }
  }

  private onProjectChanged(projectId: string): void {
    // Reset people fields
    this.form.patchValue({
      statusId: '',
      assigneeIds: [],
      reportingPersonId: '',
      watcherIds: [],
    });
    this.members.set([]);
    this.statuses.set([]);

    if (!projectId) return;

    this.loadingMeta.set(true);

    // Load members
    this.projectService
      .getProjectMembers(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (m) => this.members.set(m),
        error: () => this.members.set([]),
      });

    // Load statuses
    this.projectService
      .listStatuses(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (s) => {
        this.statuses.set(s);
        // Auto-select default status
        const defaultStatus = s.find((st) => st.is_default);
        if (defaultStatus) {
          this.form.patchValue({ statusId: defaultStatus.id });
        }
        this.loadingMeta.set(false);
      },
      error: () => {
        this.statuses.set([]);
        this.loadingMeta.set(false);
      },
    });
  }

  toggleTime(): void {
    const next = !this.showTimeInputs();
    this.showTimeInputs.set(next);
    if (!next) {
      this.form.patchValue({ startTime: null, dueTime: null });
    }
  }

  onSave(): void {
    if (this.form.invalid || this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const values = this.form.getRawValue();
    this.saving.set(true);

    const request: CreateTaskRequest = {
      title: values.title.trim(),
      priority: values.priority,
    };

    if (values.description?.trim()) {
      request.description = values.description.trim();
    }

    if (values.statusId) {
      request.status_id = values.statusId;
    }

    const startMerged = this.mergeDateAndTime(
      values.startDate,
      values.startTime,
    );
    if (startMerged) {
      request.start_date = startMerged.toISOString();
    }

    const dueMerged = this.mergeDateAndTime(values.dueDate, values.dueTime);
    if (dueMerged) {
      request.due_date = dueMerged.toISOString();
    }

    if (values.estimatedHours != null && values.estimatedHours > 0) {
      request.estimated_hours = values.estimatedHours;
    }

    if (values.assigneeIds?.length) {
      request.assignee_ids = values.assigneeIds;
    }

    if (values.reportingPersonId) {
      request.reporting_person_id = values.reportingPersonId;
    }

    this.taskService
      .createTask(values.projectId, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (task) => {
        this.saving.set(false);
        this.visible.set(false);
        const isOffline = !navigator.onLine;
        this.messageService.add({
          severity: isOffline ? 'warn' : 'success',
          summary: isOffline ? 'Saved Offline' : 'Task Created',
          detail: isOffline
            ? `"${task.title}" will sync when you're back online`
            : `"${task.title}" has been created`,
          life: 4000,
        });
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to create task. Please try again.',
          life: 5000,
        });
      },
    });
  }

  private mergeDateAndTime(date: Date | null, time: Date | null): Date | null {
    if (!date) return null;
    if (!time) return date;
    const merged = new Date(date);
    merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return merged;
  }
}
