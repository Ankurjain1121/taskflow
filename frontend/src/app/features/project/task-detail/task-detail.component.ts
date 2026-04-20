import {
  Component,
  input,
  output,
  signal,
  inject,
  DestroyRef,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Drawer } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { TaskCompletionService } from '../../../core/services/task-completion.service';
import {
  TaskService,
  Task,
  TaskPriority,
  TaskListItem,
  Assignee,
  Label,
} from '../../../core/services/task.service';
import {
  WorkspaceService,
  MemberSearchResult,
} from '../../../core/services/workspace.service';
import { ProjectService, Column } from '../../../core/services/project.service';
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
import {
  isConflictError,
  buildConflictResubmitRequest,
  groupDependencies,
  filterDependencyResults,
  formatElapsedTime,
  buildUpdateRequest,
  buildCustomFieldValues,
  computeManualTimeEntry,
  checkLockByOther,
  addAssigneeToTask,
  removeAssigneeFromTask,
  addLabelToTask,
  removeLabelFromTask,
} from './task-detail-conflict.helper';

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
  templateUrl: './task-detail.component.html',
})
export class TaskDetailComponent implements OnInit, OnChanges, OnDestroy {
  private destroyRef = inject(DestroyRef);
  private taskService = inject(TaskService);
  private taskCompletion = inject(TaskCompletionService);
  private workspaceService = inject(WorkspaceService);
  private projectService = inject(ProjectService);
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
    { label: 'Project', value: 'board' },
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

  onReopen(): void {
    this.taskCompletion.uncomplete(this.taskId()).subscribe({
      next: (updated) => {
        const current = this.task();
        if (current) this.task.set({ ...current, ...updated });
      },
    });
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
    if (!query || query.length < 2) { this.memberSearchResults.set([]); return; }
    this.workspaceService.searchMembers(this.workspaceId(), query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => this.memberSearchResults.set(results),
        error: () => this.memberSearchResults.set([]),
      });
  }

  onAssign(member: MemberSearchResult): void {
    const task = this.task();
    if (!task) return;

    const optimisticTask = addAssigneeToTask(task, member);
    this.task.set(optimisticTask);
    this.taskUpdated.emit(optimisticTask);

    this.taskService.assignUser(task.id, member.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.rollbackWithError(task, 'Could not assign member.'),
      });
  }

  onUnassign(assignee: Assignee): void {
    const task = this.task();
    if (!task) return;

    const optimisticTask = removeAssigneeFromTask(task, assignee.id);
    this.task.set(optimisticTask);
    this.taskUpdated.emit(optimisticTask);

    this.taskService.unassignUser(task.id, assignee.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.rollbackWithError(task, 'Could not unassign member.'),
      });
  }

  onAddLabel(labelId: string): void {
    const task = this.task();
    if (!task) return;

    const label = this.availableLabels().find((l) => l.id === labelId);
    if (!label) return;

    const optimisticTask = addLabelToTask(task, label);
    this.task.set(optimisticTask);
    this.taskUpdated.emit(optimisticTask);

    this.taskService.addLabel(task.id, labelId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.rollbackWithError(task, 'Could not add label.'),
      });
  }

  onRemoveLabel(labelId: string): void {
    const task = this.task();
    if (!task) return;

    const optimisticTask = removeLabelFromTask(task, labelId);
    this.task.set(optimisticTask);
    this.taskUpdated.emit(optimisticTask);

    this.taskService.removeLabel(task.id, labelId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.rollbackWithError(task, 'Could not remove label.'),
      });
  }

  onMilestoneChange(milestoneId: string): void {
    const task = this.task();
    if (!task) return;

    if (!milestoneId) {
      this.onClearMilestone();
      return;
    }

    const previousMilestone = this.selectedMilestone();
    const optimisticTask = { ...task, milestone_id: milestoneId };
    const ms = this.milestones().find((m) => m.id === milestoneId) || null;
    this.task.set(optimisticTask);
    this.taskUpdated.emit(optimisticTask);
    this.selectedMilestone.set(ms);

    this.milestoneService.assignTask(task.id, milestoneId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => {
          this.task.set(task);
          this.taskUpdated.emit(task);
          this.selectedMilestone.set(previousMilestone);
          this.showError('Could not assign milestone.');
        },
      });
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
        this.closed.emit();
        this.taskService.deleteTask(task.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            error: () => this.showError('Could not delete task.'),
          });
      },
    });
  }

  onSaveAsTemplate(): void {
    const task = this.task();
    if (!task || !this.templateName.trim()) return;

    this.savingTemplate.set(true);
    const req: SaveAsTemplateRequest = { name: this.templateName.trim(), scope: this.templateScope };
    this.taskTemplateService.saveTaskAsTemplate(task.id, req)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: () => {
        this.savingTemplate.set(false);
        this.showSaveTemplateDialog.set(false);
        this.templateName = '';
        this.templateScope = 'personal';
        this.messageService.add({ severity: 'success', summary: 'Template Saved', detail: 'Task saved as template successfully.', life: 3000 });
      },
      error: () => {
        this.savingTemplate.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save task as template.', life: 3000 });
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
      this.taskService.listFlat(this.boardId())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (tasks) => {
            this.boardTasks.set(tasks);
            this.filterDepResults(query);
          },
          error: () => this.showError('Could not load board tasks.'),
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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dep) => {
          this.dependencies.update((deps) => [dep, ...deps]);
          this.updateDepGroups();
        },
        error: () => this.showError('Could not add dependency.'),
      });
  }

  onRemoveDependency(depId: string): void {
    this.dependencyService.deleteDependency(depId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dependencies.update((deps) => deps.filter((d) => d.id !== depId));
          this.updateDepGroups();
        },
        error: () => this.showError('Could not remove dependency.'),
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
    pattern: RecurrencePattern; intervalDays: number | null; maxOccurrences: number | null;
  }): void {
    const config = this.recurringConfig();
    const req: CreateRecurringRequest = {
      pattern: event.pattern,
      interval_days: event.pattern === 'custom' ? event.intervalDays || undefined : undefined,
      max_occurrences: event.maxOccurrences || undefined,
    };
    const obs = config
      ? this.recurringService.updateConfig(config.id, req)
      : this.recurringService.createConfig(this.taskId(), req);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => this.recurringConfig.set(result),
      error: () => this.showError('Could not save recurring schedule.'),
    });
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
      accept: () => this.recurringService.deleteConfig(config.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.recurringConfig.set(null),
          error: () => this.showError('Could not remove recurring schedule.'),
        }),
    });
  }

  // ── Time tracking handlers ─────────────────────────────────

  onStartTimer(): void {
    this.timeTrackingService.startTimer(this.taskId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entry) => {
          this.runningTimerForTask.set(entry);
          this.timeEntries.update((entries) => [entry, ...entries]);
          this.startElapsedTimer(entry.started_at);
        },
        error: () => this.showError('Could not start timer.'),
      });
  }

  onStopTimer(): void {
    const running = this.runningTimerForTask();
    if (!running) return;
    this.timeTrackingService.stopTimer(running.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stopped) => {
          this.runningTimerForTask.set(null);
          this.clearTimerInterval();
          this.timeEntries.update((entries) => entries.map((e) => (e.id === stopped.id ? stopped : e)));
        },
        error: () => this.showError('Could not stop timer.'),
      });
  }

  onSubmitLogTime(event: {
    hours: number;
    minutes: number;
    description: string;
    date: string;
  }): void {
    const payload = computeManualTimeEntry(event);
    if (!payload) return;

    this.timeTrackingService
      .createManualEntry(this.taskId(), payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entry) => {
          this.timeEntries.update((entries) => [entry, ...entries]);
        },
        error: () => this.showError('Could not log time entry.'),
      });
  }

  onDeleteTimeEntry(entryId: string): void {
    this.timeTrackingService.deleteEntry(entryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.timeEntries.update((entries) => entries.filter((e) => e.id !== entryId));
          if (this.runningTimerForTask()?.id === entryId) { this.runningTimerForTask.set(null); this.clearTimerInterval(); }
        },
        error: () => this.showError('Could not delete time entry.'),
      });
  }

  // ── Private methods ────────────────────────────────────────

  private loadTask(): void {
    this.loading.set(true);

    this.taskService.getTask(this.taskId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
          this.showError('Could not load task.');
        },
      });
  }

  private loadParentTitle(task: Task): void {
    if (task.parent_task_id) {
      this.taskService.getTask(task.parent_task_id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (parent) => this.parentTaskTitle.set(parent.title),
          error: () => this.parentTaskTitle.set(null),
        });
    } else {
      this.parentTaskTitle.set(null);
    }
  }

  private loadDependencies(): void {
    this.dependencyService.listDependencies(this.taskId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (deps) => { this.dependencies.set(deps); this.updateDepGroups(); },
        error: () => this.showError('Could not load dependencies.'),
      });
  }

  private loadMilestones(task: Task): void {
    const bid = this.boardId();
    if (!bid) return;
    this.milestoneService.list(bid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (milestones) => {
          this.milestones.set(milestones);
          this.selectedMilestone.set(
            task.milestone_id ? milestones.find((m) => m.id === task.milestone_id) || null : null,
          );
        },
        error: () => this.showError('Could not load milestones.'),
      });
  }

  private loadCustomFields(): void {
    if (!this.boardId()) return;
    this.customFieldService.getTaskValues(this.taskId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (values) => this.customFields.set(values),
        error: () => this.showError('Could not load custom fields.'),
      });
  }

  private loadRecurringConfig(): void {
    this.recurringService.getConfig(this.taskId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config) => this.recurringConfig.set(config),
        error: () => this.recurringConfig.set(null),
      });
  }

  private loadTimeEntries(): void {
    this.timeTrackingService.listEntries(this.taskId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entries) => {
          this.timeEntries.set(entries);
          const running = entries.find((e) => e.is_running);
          if (running) { this.runningTimerForTask.set(running); this.startElapsedTimer(running.started_at); }
          else { this.runningTimerForTask.set(null); this.clearTimerInterval(); }
        },
        error: () => this.showError('Could not load time entries.'),
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
    const request = buildUpdateRequest(task, updates);

    this.saveStatus.markSaving();
    this.taskService.updateTask(task.id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
          if (isConflictError(error)) {
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

  onConflictResolved(resolution: ConflictResolution): void {
    this.showConflictDialog.set(false);
    const request = buildConflictResubmitRequest(resolution);
    if (!request) return;
    const task = this.task();
    if (!task) return;
    this.saveStatus.markSaving();
    this.taskService.updateTask(task.id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (serverTask) => { this.saveStatus.markSaved(); this.task.set(serverTask); this.taskUpdated.emit(serverTask); },
        error: () => this.saveStatus.markError(),
      });
  }

  onConflictAccepted(): void {
    this.showConflictDialog.set(false);
    this.loadTask();
  }

  onConflictCancelled(): void {
    this.showConflictDialog.set(false);
    const original = this.conflictOriginalTask();
    if (original) { this.task.set(original); this.taskUpdated.emit(original); }
  }

  private onClearMilestone(): void {
    const task = this.task();
    if (!task) return;

    const previousMilestone = this.selectedMilestone();
    this.task.set({ ...task, milestone_id: null });
    this.taskUpdated.emit({ ...task, milestone_id: null });
    this.selectedMilestone.set(null);

    this.milestoneService.unassignTask(task.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => {
          this.task.set(task);
          this.taskUpdated.emit(task);
          this.selectedMilestone.set(previousMilestone);
          this.showError('Could not remove milestone.');
        },
      });
  }

  private updateDepGroups(): void {
    const groups = groupDependencies(this.dependencies(), this.taskId());
    this.blockingDeps.set(groups.blocking);
    this.blockedByDeps.set(groups.blockedBy);
    this.relatedDeps.set(groups.related);
  }

  private filterDepResults(query: string): void {
    this.depSearchResults.set(
      filterDependencyResults(
        this.boardTasks(),
        this.taskId(),
        this.dependencies(),
        query,
      ),
    );
  }

  private doSaveCustomFields(): void {
    const fields = this.customFields();
    if (fields.length === 0) return;

    const values = buildCustomFieldValues(fields);
    this.customFieldService.setTaskValues(this.taskId(), values)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.showError('Could not save custom fields.'),
      });
  }

  private startElapsedTimer(startedAt: string): void {
    this.clearTimerInterval();
    this.elapsedTime.set(formatElapsedTime(startedAt));
    this.timerInterval = setInterval(() => {
      this.elapsedTime.set(formatElapsedTime(startedAt));
    }, 1000);
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
      this.lockedByOther.set(
        checkLockByOther(
          this.presenceService.taskLocks(),
          this.taskId(),
          this.authService.currentUser()?.id,
        ),
      );
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

  /** Rollback task state and show an error toast. */
  private rollbackWithError(snapshot: Task, detail: string): void {
    this.task.set(snapshot);
    this.taskUpdated.emit(snapshot);
    this.showError(detail);
  }

  /** Show an error toast with standard formatting. */
  private showError(detail: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Update failed',
      detail,
      life: 4000,
    });
  }
}
