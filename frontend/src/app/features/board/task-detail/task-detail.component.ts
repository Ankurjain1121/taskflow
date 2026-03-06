import {
  Component,
  input,
  output,
  signal,
  inject,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Drawer } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import {
  TaskService,
  Task,
  TaskPriority,
  TaskListItem,
  Assignee,
  Label,
  ConflictError,
} from '../../../core/services/task.service';
import {
  WorkspaceService,
  MemberSearchResult,
} from '../../../core/services/workspace.service';
import { BoardService, Column } from '../../../core/services/board.service';
import {
  DependencyService,
  TaskDependency,
  DependencyType,
} from '../../../core/services/dependency.service';
import {
  MilestoneService,
  Milestone,
} from '../../../core/services/milestone.service';
import {
  CustomFieldService,
  TaskCustomFieldValueWithField,
  SetFieldValue,
} from '../../../core/services/custom-field.service';
import {
  RecurringService,
  RecurringTaskConfig,
  RecurrencePattern,
  CreateRecurringRequest,
} from '../../../core/services/recurring.service';
import {
  TimeTrackingService,
  TimeEntry,
} from '../../../core/services/time-tracking.service';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import {
  TaskTemplateService,
  SaveAsTemplateRequest,
} from '../../../core/services/task-template.service';
import { Dialog } from 'primeng/dialog';
import { SaveStatusService } from '../../../core/services/save-status.service';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import {
  PresenceService,
  TaskLockInfo,
} from '../../../core/services/presence.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConflictNotificationService } from '../../../core/services/conflict-notification.service';
import {
  ConflictDialogComponent,
  ConflictResolution,
} from '../../../shared/components/conflict-dialog/conflict-dialog.component';
import { TaskDetailHeaderComponent } from './task-detail-header.component';
import { TaskDetailMetadataComponent } from './task-detail-metadata.component';
import { TaskDetailDescriptionComponent } from './task-detail-description.component';
import { SubtaskListComponent } from '../subtask-list/subtask-list.component';
import { TaskDetailActivityComponent } from './task-detail-activity.component';
import { TaskDetailFieldsComponent } from './task-detail-fields.component';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    CommonModule,
    Drawer,
    ButtonModule,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TaskDetailHeaderComponent,
    TaskDetailMetadataComponent,
    TaskDetailDescriptionComponent,
    SubtaskListComponent,
    TaskDetailActivityComponent,
    TaskDetailFieldsComponent,
    ConfirmDialog,
    Dialog,
    FormsModule,
    InputTextModule,
    Select,
    ConflictDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-drawer
      [(visible)]="drawerVisible"
      position="right"
      [style]="{ width: '520px' }"
      [modal]="true"
      (onHide)="onClose()"
    >
      <ng-template #header>
        <div class="flex items-center gap-2 w-full">
          <span class="text-sm text-gray-500">Task Detail</span>
          @if (task()) {
            <button
              (click)="showSaveTemplateDialog.set(true)"
              class="ml-auto p-1.5 rounded-md hover:bg-[var(--muted)] transition-colors"
              title="Save as Template"
            >
              <i class="pi pi-copy text-sm text-[var(--muted-foreground)]"></i>
            </button>
          }
        </div>
      </ng-template>

      @if (loading()) {
        <div class="p-6 space-y-6 animate-fade-in">
          <div class="space-y-3">
            <div class="skeleton skeleton-heading w-3/4"></div>
            <div class="skeleton skeleton-text w-1/2"></div>
          </div>
          <div class="flex gap-2">
            <div class="skeleton w-16 h-6 rounded-full"></div>
            <div class="skeleton w-20 h-6 rounded-full"></div>
            <div class="skeleton w-16 h-6 rounded-full"></div>
          </div>
          <div class="skeleton w-full h-24 rounded-lg"></div>
        </div>
      } @else if (task()) {
        <div class="flex-1 overflow-y-auto">
          @if (lockedByOther()) {
            <div
              class="mx-2 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-800"
            >
              <i class="pi pi-lock text-amber-500"></i>
              <span class="font-medium">{{ lockedByOther()!.user_name }}</span>
              <span>is editing this task</span>
            </div>
          }
          <div class="px-2 py-4 space-y-4">
            <!-- Header: title, column badge, created date -->
            <app-task-detail-header
              [task]="task()"
              [column]="column()"
              [parentTitle]="parentTaskTitle()"
              (titleChanged)="onTitleSave($event)"
            />

            <!-- Metadata: priority, due date, assignees, labels, milestone -->
            <app-task-detail-metadata
              [task]="task()"
              [milestones]="milestones()"
              [selectedMilestone]="selectedMilestone()"
              [searchResults]="memberSearchResults()"
              [availableLabels]="availableLabels()"
              (priorityChanged)="onPriorityChange($event)"
              (dueDateChanged)="onDueDateChange($event)"
              (assigneeSearchChanged)="onAssigneeSearchChange($event)"
              (assignRequested)="onAssign($event)"
              (unassignRequested)="onUnassign($event)"
              (labelAdded)="onAddLabel($event)"
              (labelRemoved)="onRemoveLabel($event)"
              (milestoneChanged)="onMilestoneChange($event)"
            />

            <!-- Tabbed content area -->
            <p-tabs value="0">
              <p-tablist>
                <p-tab value="0">
                  <i class="pi pi-align-left mr-1"></i> Description
                </p-tab>
                <p-tab value="1">
                  <i class="pi pi-check-square mr-1"></i> Subtasks
                </p-tab>
                <p-tab value="2">
                  <i class="pi pi-comments mr-1"></i> Activity
                </p-tab>
                <p-tab value="3">
                  <i class="pi pi-cog mr-1"></i> Details
                </p-tab>
              </p-tablist>
              <p-tabpanels>
                <p-tabpanel value="0">
                  <app-task-detail-description
                    [description]="task()!.description"
                    (descriptionChanged)="onDescriptionSave($event)"
                  />
                </p-tabpanel>
                <p-tabpanel value="1">
                  <app-subtask-list [taskId]="taskId()" />
                </p-tabpanel>
                <p-tabpanel value="2">
                  <app-task-detail-activity [taskId]="taskId()" />
                </p-tabpanel>
                <p-tabpanel value="3">
                  <app-task-detail-fields
                    [taskId]="taskId()"
                    [dependencies]="dependencies()"
                    [blockingDeps]="blockingDeps()"
                    [blockedByDeps]="blockedByDeps()"
                    [relatedDeps]="relatedDeps()"
                    [depSearchResults]="depSearchResults()"
                    [customFields]="customFields()"
                    [recurringConfig]="recurringConfig()"
                    [timeEntries]="timeEntries()"
                    [runningTimer]="runningTimerForTask()"
                    [elapsedTime]="elapsedTime()"
                    (dependencyAdded)="onAddDependency($event)"
                    (dependencyRemoved)="onRemoveDependency($event)"
                    (depSearchChanged)="onDepSearchChange($event)"
                    (customFieldChanged)="onCustomFieldChanged($event)"
                    (customFieldSaveRequested)="saveCustomFields()"
                    (recurringSaved)="onSaveRecurring($event)"
                    (recurringRemoved)="onRemoveRecurring()"
                    (timerStarted)="onStartTimer()"
                    (timerStopped)="onStopTimer()"
                    (timeEntryLogged)="onSubmitLogTime($event)"
                    (timeEntryDeleted)="onDeleteTimeEntry($event)"
                  />
                </p-tabpanel>
              </p-tabpanels>
            </p-tabs>

            <!-- Footer: delete -->
            <div class="border-t border-gray-200 pt-4">
              <div class="flex items-center justify-end">
                <p-button
                  label="Delete"
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  (onClick)="onDelete()"
                />
              </div>
            </div>
          </div>
        </div>
      }
    </p-drawer>
    <app-conflict-dialog
      [visible]="showConflictDialog()"
      [yourChanges]="conflictYourChanges()"
      [serverVersion]="conflictServerVersion()"
      [originalTask]="conflictOriginalTask()"
      (resolved)="onConflictResolved($event)"
      (accepted)="onConflictAccepted()"
      (cancelled)="onConflictCancelled()"
    />
    <p-confirmDialog />
    <!-- Save as Template Dialog -->
    <p-dialog
      header="Save as Template"
      [(visible)]="showSaveTemplateDialog"
      [modal]="true"
      [style]="{ width: '420px' }"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-[var(--foreground)]"
            >Template Name</label
          >
          <input
            pInputText
            [(ngModel)]="templateName"
            placeholder="Enter template name"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-[var(--foreground)]"
            >Scope</label
          >
          <p-select
            [(ngModel)]="templateScope"
            [options]="scopeOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            styleClass="w-full"
          />
        </div>
      </div>
      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <button
            class="px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-md"
            (click)="showSaveTemplateDialog.set(false)"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md disabled:opacity-50"
            [disabled]="!templateName.trim() || savingTemplate()"
            (click)="onSaveAsTemplate()"
          >
            Save
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class TaskDetailComponent implements OnInit, OnChanges, OnDestroy {
  private taskService = inject(TaskService);
  private workspaceService = inject(WorkspaceService);
  private boardService = inject(BoardService);
  private dependencyService = inject(DependencyService);
  private milestoneService = inject(MilestoneService);
  private customFieldService = inject(CustomFieldService);
  private recurringService = inject(RecurringService);
  private timeTrackingService = inject(TimeTrackingService);
  private confirmationService = inject(ConfirmationService);
  private saveStatus = inject(SaveStatusService);
  private presenceService = inject(PresenceService);
  private authService = inject(AuthService);
  private conflictNotification = inject(ConflictNotificationService);

  // Inputs
  taskId = input.required<string>();
  workspaceId = input.required<string>();
  boardId = input<string>('');
  availableLabels = input<Label[]>([]);

  // Outputs
  closed = output<void>();
  taskUpdated = output<Task>();

  // Core state
  loading = signal(true);
  task = signal<Task | null>(null);
  column = signal<Column | null>(null);
  drawerVisible = true;

  // Member search
  memberSearchResults = signal<MemberSearchResult[]>([]);

  // Dependencies
  dependencies = signal<TaskDependency[]>([]);
  blockingDeps = signal<TaskDependency[]>([]);
  blockedByDeps = signal<TaskDependency[]>([]);
  relatedDeps = signal<TaskDependency[]>([]);
  depSearchResults = signal<TaskListItem[]>([]);
  private boardTasks = signal<TaskListItem[]>([]);

  // Milestones
  milestones = signal<Milestone[]>([]);
  selectedMilestone = signal<Milestone | null>(null);

  // Custom fields
  customFields = signal<TaskCustomFieldValueWithField[]>([]);
  private customFieldDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Recurring
  recurringConfig = signal<RecurringTaskConfig | null>(null);

  // Time tracking
  timeEntries = signal<TimeEntry[]>([]);
  runningTimerForTask = signal<TimeEntry | null>(null);
  elapsedTime = signal('00:00:00');
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Save as Template
  private taskTemplateService = inject(TaskTemplateService);
  private messageService = inject(MessageService);
  showSaveTemplateDialog = signal(false);
  templateName = '';
  templateScope = 'personal';
  savingTemplate = signal(false);
  scopeOptions = [
    { label: 'Personal', value: 'personal' },
    { label: 'Board', value: 'board' },
    { label: 'Workspace', value: 'workspace' },
  ];

  // Conflict dialog
  showConflictDialog = signal(false);
  conflictYourChanges = signal<Partial<Task>>({});
  conflictServerVersion = signal<Task | null>(null);
  conflictOriginalTask = signal<Task | null>(null);

  // Parent task
  parentTaskTitle = signal<string | null>(null);

  // Lock info: who else is editing this task?
  lockedByOther = signal<TaskLockInfo | null>(null);
  private lockCheckInterval: ReturnType<typeof setInterval> | null = null;

  // ── Lifecycle ──────────────────────────────────────────────

  ngOnInit(): void {
    this.loadTask();
    this.presenceService.lockTask(this.taskId());
    this.startLockCheck();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['taskId'] && !changes['taskId'].firstChange) {
      // Unlock old task, lock new one
      const prev = changes['taskId'].previousValue;
      if (prev) {
        this.presenceService.unlockTask(prev);
      }
      this.loadTask();
      this.presenceService.lockTask(this.taskId());
    }
  }

  ngOnDestroy(): void {
    this.presenceService.unlockTask(this.taskId());
    this.conflictNotification.clearEdits(this.taskId());
    this.stopLockCheck();
    this.clearTimerInterval();
    if (this.customFieldDebounceTimer) {
      clearTimeout(this.customFieldDebounceTimer);
    }
  }

  // ── Event handlers from sub-components ─────────────────────

  onClose(): void {
    this.presenceService.unlockTask(this.taskId());
    this.conflictNotification.clearEdits(this.taskId());
    this.closed.emit();
  }

  onTitleSave(title: string): void {
    this.conflictNotification.registerEdit(this.taskId(), 'title');
    this.updateTask({ title }, 'title');
  }

  onDescriptionSave(description: string): void {
    this.conflictNotification.registerEdit(this.taskId(), 'description');
    this.updateTask({ description: description || null }, 'description');
  }

  onPriorityChange(priority: TaskPriority): void {
    this.conflictNotification.registerEdit(this.taskId(), 'priority');
    this.updateTask({ priority }, 'priority');
  }

  onDueDateChange(dueDate: string): void {
    this.conflictNotification.registerEdit(this.taskId(), 'due_date');
    this.updateTask({ due_date: dueDate || null }, 'due_date');
  }

  onAssigneeSearchChange(query: string): void {
    if (!query || query.length < 2) {
      this.memberSearchResults.set([]);
      return;
    }
    this.workspaceService.searchMembers(this.workspaceId(), query).subscribe({
      next: (results) => this.memberSearchResults.set(results),
      error: () => this.memberSearchResults.set([]),
    });
  }

  onAssign(member: MemberSearchResult): void {
    const task = this.task();
    if (!task) return;

    const snapshot = task;
    const newAssignee: Assignee = {
      id: member.id,
      display_name: member.name || 'Unknown',
      avatar_url: member.avatar_url,
    };
    const optimisticTask = {
      ...task,
      assignees: [...(task.assignees || []), newAssignee],
    };
    this.task.set(optimisticTask);
    this.taskUpdated.emit(optimisticTask);

    this.taskService.assignUser(task.id, member.id).subscribe({
      next: () => {
        /* already applied */
      },
      error: () => {
        this.task.set(snapshot);
        this.taskUpdated.emit(snapshot);
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
    const task = this.task();
    if (!task) return;

    const snapshot = task;
    const optimisticTask = {
      ...task,
      assignees: (task.assignees || []).filter((a) => a.id !== assignee.id),
    };
    this.task.set(optimisticTask);
    this.taskUpdated.emit(optimisticTask);

    this.taskService.unassignUser(task.id, assignee.id).subscribe({
      next: () => {
        /* already applied */
      },
      error: () => {
        this.task.set(snapshot);
        this.taskUpdated.emit(snapshot);
        this.messageService.add({
          severity: 'error',
          summary: 'Update failed',
          detail: 'Could not unassign member.',
          life: 4000,
        });
      },
    });
  }

  onAddLabel(labelId: string): void {
    const task = this.task();
    if (!task) return;

    const label = this.availableLabels().find((l) => l.id === labelId);
    if (!label) return;

    // Optimistically add the label
    const newLabel: Label = {
      id: label.id,
      workspace_id: label.workspace_id ?? '',
      name: label.name,
      color: label.color,
      created_at: label.created_at ?? '',
    };
    const optimisticTask = {
      ...task,
      labels: [...(task.labels || []), newLabel],
    };
    this.task.set(optimisticTask);
    this.taskUpdated.emit(optimisticTask);

    this.taskService.addLabel(task.id, labelId).subscribe({
      error: () => {
        // Rollback on failure
        this.task.set(task);
        this.taskUpdated.emit(task);
      },
    });
  }

  onRemoveLabel(labelId: string): void {
    const task = this.task();
    if (!task) return;

    const snapshot = task;
    const optimisticTask = {
      ...task,
      labels: (task.labels || []).filter((l) => l.id !== labelId),
    };
    this.task.set(optimisticTask);
    this.taskUpdated.emit(optimisticTask);

    this.taskService.removeLabel(task.id, labelId).subscribe({
      next: () => {
        /* already applied */
      },
      error: () => {
        this.task.set(snapshot);
        this.taskUpdated.emit(snapshot);
        this.messageService.add({
          severity: 'error',
          summary: 'Update failed',
          detail: 'Could not remove label.',
          life: 4000,
        });
      },
    });
  }

  onMilestoneChange(milestoneId: string): void {
    const task = this.task();
    if (!task) return;

    if (milestoneId) {
      const snapshot = task;
      const previousMilestone = this.selectedMilestone();
      const optimisticTask = { ...task, milestone_id: milestoneId };
      const ms = this.milestones().find((m) => m.id === milestoneId) || null;
      this.task.set(optimisticTask);
      this.taskUpdated.emit(optimisticTask);
      this.selectedMilestone.set(ms);

      this.milestoneService.assignTask(task.id, milestoneId).subscribe({
        next: () => {
          /* already applied */
        },
        error: () => {
          this.task.set(snapshot);
          this.taskUpdated.emit(snapshot);
          this.selectedMilestone.set(previousMilestone);
          this.messageService.add({
            severity: 'error',
            summary: 'Update failed',
            detail: 'Could not assign milestone.',
            life: 4000,
          });
        },
      });
    } else {
      this.onClearMilestone();
    }
  }

  onDelete(): void {
    const task = this.task();
    if (!task) return;

    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${task.title}"? This action cannot be undone.`,
      header: 'Delete Task',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.closed.emit(); // close drawer immediately
        this.taskService.deleteTask(task.id).subscribe({
          error: () => {
            // Task will be restored by WebSocket or next board load
          },
        });
      },
    });
  }

  onSaveAsTemplate(): void {
    const task = this.task();
    if (!task || !this.templateName.trim()) return;

    this.savingTemplate.set(true);
    const req: SaveAsTemplateRequest = {
      name: this.templateName.trim(),
      scope: this.templateScope,
    };

    this.taskTemplateService.saveTaskAsTemplate(task.id, req).subscribe({
      next: () => {
        this.savingTemplate.set(false);
        this.showSaveTemplateDialog.set(false);
        this.templateName = '';
        this.templateScope = 'personal';
        this.messageService.add({
          severity: 'success',
          summary: 'Template Saved',
          detail: 'Task saved as template successfully.',
          life: 3000,
        });
      },
      error: () => {
        this.savingTemplate.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save task as template.',
          life: 3000,
        });
      },
    });
  }

  // ── Dependency handlers ────────────────────────────────────

  onDepSearchChange(query: string): void {
    if (!query || query.length < 2) {
      this.depSearchResults.set([]);
      return;
    }
    // Lazy-load board tasks if needed
    if (this.boardTasks().length === 0 && this.boardId()) {
      this.taskService.listFlat(this.boardId()).subscribe({
        next: (tasks) => {
          this.boardTasks.set(tasks);
          this.filterDepResults(query);
        },
        error: () => {},
      });
    } else {
      this.filterDepResults(query);
    }
  }

  onAddDependency(event: {
    targetTaskId: string;
    depType: DependencyType;
  }): void {
    this.dependencyService
      .createDependency(this.taskId(), event.targetTaskId, event.depType)
      .subscribe({
        next: (dep) => {
          this.dependencies.update((deps) => [dep, ...deps]);
          this.updateDepGroups();
        },
        error: () => {},
      });
  }

  onRemoveDependency(depId: string): void {
    this.dependencyService.deleteDependency(depId).subscribe({
      next: () => {
        this.dependencies.update((deps) => deps.filter((d) => d.id !== depId));
        this.updateDepGroups();
      },
      error: () => {},
    });
  }

  // ── Custom field handlers ──────────────────────────────────

  onCustomFieldChanged(event: {
    fieldId: string;
    field: string;
    value: unknown;
  }): void {
    this.customFields.update((fields) =>
      fields.map((f) =>
        f.field_id === event.fieldId ? { ...f, [event.field]: event.value } : f,
      ),
    );
  }

  saveCustomFields(): void {
    if (this.customFieldDebounceTimer) {
      clearTimeout(this.customFieldDebounceTimer);
    }
    this.customFieldDebounceTimer = setTimeout(() => {
      this.doSaveCustomFields();
    }, 500);
  }

  // ── Recurring handlers ─────────────────────────────────────

  onSaveRecurring(event: {
    pattern: RecurrencePattern;
    intervalDays: number | null;
    maxOccurrences: number | null;
  }): void {
    const config = this.recurringConfig();
    const req: CreateRecurringRequest = {
      pattern: event.pattern,
      interval_days:
        event.pattern === 'custom'
          ? event.intervalDays || undefined
          : undefined,
      max_occurrences: event.maxOccurrences || undefined,
    };

    if (config) {
      this.recurringService.updateConfig(config.id, req).subscribe({
        next: (updated) => this.recurringConfig.set(updated),
        error: () => {},
      });
    } else {
      this.recurringService.createConfig(this.taskId(), req).subscribe({
        next: (created) => this.recurringConfig.set(created),
        error: () => {},
      });
    }
  }

  onRemoveRecurring(): void {
    const config = this.recurringConfig();
    if (!config) return;

    this.confirmationService.confirm({
      message: 'Remove recurring schedule from this task?',
      header: 'Remove Recurring Schedule',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.recurringService.deleteConfig(config.id).subscribe({
          next: () => this.recurringConfig.set(null),
          error: () => {},
        });
      },
    });
  }

  // ── Time tracking handlers ─────────────────────────────────

  onStartTimer(): void {
    this.timeTrackingService.startTimer(this.taskId()).subscribe({
      next: (entry) => {
        this.runningTimerForTask.set(entry);
        this.timeEntries.update((entries) => [entry, ...entries]);
        this.startElapsedTimer(entry.started_at);
      },
      error: () => {},
    });
  }

  onStopTimer(): void {
    const running = this.runningTimerForTask();
    if (!running) return;

    this.timeTrackingService.stopTimer(running.id).subscribe({
      next: (stoppedEntry) => {
        this.runningTimerForTask.set(null);
        this.clearTimerInterval();
        this.timeEntries.update((entries) =>
          entries.map((e) => (e.id === stoppedEntry.id ? stoppedEntry : e)),
        );
      },
      error: () => {},
    });
  }

  onSubmitLogTime(event: {
    hours: number;
    minutes: number;
    description: string;
    date: string;
  }): void {
    const totalMinutes = event.hours * 60 + event.minutes;
    if (totalMinutes <= 0) return;

    const startedAt = new Date(event.date + 'T09:00:00Z').toISOString();
    const endedAt = new Date(
      new Date(startedAt).getTime() + totalMinutes * 60000,
    ).toISOString();

    this.timeTrackingService
      .createManualEntry(this.taskId(), {
        description: event.description || undefined,
        started_at: startedAt,
        ended_at: endedAt,
        duration_minutes: totalMinutes,
      })
      .subscribe({
        next: (entry) => {
          this.timeEntries.update((entries) => [entry, ...entries]);
        },
        error: () => {},
      });
  }

  onDeleteTimeEntry(entryId: string): void {
    this.timeTrackingService.deleteEntry(entryId).subscribe({
      next: () => {
        this.timeEntries.update((entries) =>
          entries.filter((e) => e.id !== entryId),
        );
        if (this.runningTimerForTask()?.id === entryId) {
          this.runningTimerForTask.set(null);
          this.clearTimerInterval();
        }
      },
      error: () => {},
    });
  }

  // ── Private methods ────────────────────────────────────────

  private loadTask(): void {
    this.loading.set(true);

    this.taskService.getTask(this.taskId()).subscribe({
      next: (task) => {
        this.task.set(task);
        this.loadDependencies();
        this.loadMilestones(task);
        this.loadCustomFields();
        this.loadRecurringConfig();
        this.loadTimeEntries();
        this.loadParentTitle(task);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadParentTitle(task: Task): void {
    if (task.parent_task_id) {
      this.taskService.getTask(task.parent_task_id).subscribe({
        next: (parent) => this.parentTaskTitle.set(parent.title),
        error: () => this.parentTaskTitle.set(null),
      });
    } else {
      this.parentTaskTitle.set(null);
    }
  }

  private loadDependencies(): void {
    this.dependencyService.listDependencies(this.taskId()).subscribe({
      next: (deps) => {
        this.dependencies.set(deps);
        this.updateDepGroups();
      },
      error: () => {},
    });
  }

  private loadMilestones(task: Task): void {
    const bid = this.boardId();
    if (!bid) return;

    this.milestoneService.list(bid).subscribe({
      next: (milestones) => {
        this.milestones.set(milestones);
        if (task.milestone_id) {
          const selected =
            milestones.find((m) => m.id === task.milestone_id) || null;
          this.selectedMilestone.set(selected);
        } else {
          this.selectedMilestone.set(null);
        }
      },
      error: () => {},
    });
  }

  private loadCustomFields(): void {
    const bid = this.boardId();
    if (!bid) return;

    this.customFieldService.getTaskValues(this.taskId()).subscribe({
      next: (values) => this.customFields.set(values),
      error: () => {},
    });
  }

  private loadRecurringConfig(): void {
    this.recurringService.getConfig(this.taskId()).subscribe({
      next: (config) => this.recurringConfig.set(config),
      error: () => this.recurringConfig.set(null),
    });
  }

  private loadTimeEntries(): void {
    this.timeTrackingService.listEntries(this.taskId()).subscribe({
      next: (entries) => {
        this.timeEntries.set(entries);
        const running = entries.find((e) => e.is_running);
        if (running) {
          this.runningTimerForTask.set(running);
          this.startElapsedTimer(running.started_at);
        } else {
          this.runningTimerForTask.set(null);
          this.clearTimerInterval();
        }
      },
      error: () => {},
    });
  }

  private updateTask(updates: Partial<Task>, editField?: string): void {
    const task = this.task();
    if (!task) return;

    // Apply optimistically to local signal
    const optimisticTask = { ...task, ...updates };
    this.task.set(optimisticTask);
    this.taskUpdated.emit(optimisticTask);

    // Include version for OCC if available
    const request = task.version
      ? { ...updates, version: task.version }
      : updates;

    this.saveStatus.markSaving();
    this.taskService.updateTask(task.id, request).subscribe({
      next: (serverTask) => {
        this.saveStatus.markSaved();
        this.task.set(serverTask);
        this.taskUpdated.emit(serverTask);
        if (editField) {
          this.conflictNotification.unregisterEdit(this.taskId(), editField);
        }
      },
      error: (error) => {
        if (editField) {
          this.conflictNotification.unregisterEdit(this.taskId(), editField);
        }
        // Handle 409 Conflict
        if (this.isConflictError(error)) {
          this.saveStatus.markSaved(); // Not a true error
          this.conflictOriginalTask.set(task);
          this.conflictYourChanges.set(updates);
          this.conflictServerVersion.set(error.serverTask);
          this.showConflictDialog.set(true);
          return;
        }
        this.saveStatus.markError();
        // Rollback
        this.task.set(task);
        this.taskUpdated.emit(task);
      },
    });
  }

  private isConflictError(error: unknown): error is ConflictError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      (error as ConflictError).status === 409
    );
  }

  onConflictResolved(resolution: ConflictResolution): void {
    this.showConflictDialog.set(false);
    if (resolution.action === 'keep_mine' && resolution.yourChanges) {
      // Re-submit with server's version
      const task = this.task();
      if (!task) return;
      const request = {
        ...resolution.yourChanges,
        version: resolution.serverVersion,
      };
      this.saveStatus.markSaving();
      this.taskService.updateTask(task.id, request).subscribe({
        next: (serverTask) => {
          this.saveStatus.markSaved();
          this.task.set(serverTask);
          this.taskUpdated.emit(serverTask);
        },
        error: () => {
          this.saveStatus.markError();
        },
      });
    }
  }

  onConflictAccepted(): void {
    this.showConflictDialog.set(false);
    // Reload task from server (accept their version)
    this.loadTask();
  }

  onConflictCancelled(): void {
    this.showConflictDialog.set(false);
    // Rollback to original
    const original = this.conflictOriginalTask();
    if (original) {
      this.task.set(original);
      this.taskUpdated.emit(original);
    }
  }

  private onClearMilestone(): void {
    const task = this.task();
    if (!task) return;

    const snapshot = task;
    const previousMilestone = this.selectedMilestone();
    const optimisticTask = { ...task, milestone_id: null };
    this.task.set(optimisticTask);
    this.taskUpdated.emit(optimisticTask);
    this.selectedMilestone.set(null);

    this.milestoneService.unassignTask(task.id).subscribe({
      next: () => {
        /* already applied */
      },
      error: () => {
        this.task.set(snapshot);
        this.taskUpdated.emit(snapshot);
        this.selectedMilestone.set(previousMilestone);
        this.messageService.add({
          severity: 'error',
          summary: 'Update failed',
          detail: 'Could not remove milestone.',
          life: 4000,
        });
      },
    });
  }

  private updateDepGroups(): void {
    const deps = this.dependencies();
    const taskId = this.taskId();

    this.blockingDeps.set(
      deps.filter(
        (d) => d.dependency_type === 'blocks' && d.source_task_id === taskId,
      ),
    );
    this.blockedByDeps.set(
      deps.filter(
        (d) => d.dependency_type === 'blocks' && d.target_task_id === taskId,
      ),
    );
    this.relatedDeps.set(deps.filter((d) => d.dependency_type === 'related'));
  }

  private filterDepResults(query: string): void {
    const currentTaskId = this.taskId();
    const existingDepTaskIds = new Set(
      this.dependencies().map((d) => d.related_task_id),
    );
    const filtered = this.boardTasks().filter(
      (t) =>
        t.id !== currentTaskId &&
        !existingDepTaskIds.has(t.id) &&
        t.title.toLowerCase().includes(query.toLowerCase()),
    );
    this.depSearchResults.set(filtered.slice(0, 10));
  }

  private doSaveCustomFields(): void {
    const fields = this.customFields();
    if (fields.length === 0) return;

    const values: SetFieldValue[] = fields.map((f) => ({
      field_id: f.field_id,
      value_text: f.value_text,
      value_number: f.value_number,
      value_date: f.value_date,
      value_bool: f.value_bool,
    }));

    this.customFieldService.setTaskValues(this.taskId(), values).subscribe({
      error: () => {},
    });
  }

  private startElapsedTimer(startedAt: string): void {
    this.clearTimerInterval();
    const updateElapsed = (): void => {
      const start = new Date(startedAt).getTime();
      const now = Date.now();
      const diffSec = Math.floor((now - start) / 1000);
      const hours = Math.floor(diffSec / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);
      const secs = diffSec % 60;
      this.elapsedTime.set(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      );
    };
    updateElapsed();
    this.timerInterval = setInterval(updateElapsed, 1000);
  }

  private clearTimerInterval(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.elapsedTime.set('00:00:00');
  }

  private startLockCheck(): void {
    this.stopLockCheck();
    const check = (): void => {
      const locks = this.presenceService.taskLocks();
      const lock = locks.get(this.taskId());
      const currentUserId = this.authService.currentUser()?.id;
      if (lock && lock.user_id !== currentUserId) {
        this.lockedByOther.set(lock);
      } else {
        this.lockedByOther.set(null);
      }
    };
    check();
    this.lockCheckInterval = setInterval(check, 2000);
  }

  private stopLockCheck(): void {
    if (this.lockCheckInterval) {
      clearInterval(this.lockCheckInterval);
      this.lockCheckInterval = null;
    }
  }
}
