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
  ],
  providers: [ConfirmationService],
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
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">Task Detail</span>
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
          <div class="px-2 py-4 space-y-4">
            <!-- Header: title, column badge, created date -->
            <app-task-detail-header
              [task]="task()"
              [column]="column()"
              (titleChanged)="onTitleSave($event)"
            />

            <!-- Metadata: priority, due date, assignees, labels, milestone -->
            <app-task-detail-metadata
              [task]="task()"
              [milestones]="milestones()"
              [selectedMilestone]="selectedMilestone()"
              [searchResults]="memberSearchResults()"
              (priorityChanged)="onPriorityChange($event)"
              (dueDateChanged)="onDueDateChange($event)"
              (assigneeSearchChanged)="onAssigneeSearchChange($event)"
              (assignRequested)="onAssign($event)"
              (unassignRequested)="onUnassign($event)"
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
    <p-confirmDialog />
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

  // Inputs
  taskId = input.required<string>();
  workspaceId = input.required<string>();
  boardId = input<string>('');

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

  // ── Lifecycle ──────────────────────────────────────────────

  ngOnInit(): void {
    this.loadTask();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['taskId'] && !changes['taskId'].firstChange) {
      this.loadTask();
    }
  }

  ngOnDestroy(): void {
    this.clearTimerInterval();
    if (this.customFieldDebounceTimer) {
      clearTimeout(this.customFieldDebounceTimer);
    }
  }

  // ── Event handlers from sub-components ─────────────────────

  onClose(): void {
    this.closed.emit();
  }

  onTitleSave(title: string): void {
    this.updateTask({ title });
  }

  onDescriptionSave(description: string): void {
    this.updateTask({ description: description || null });
  }

  onPriorityChange(priority: TaskPriority): void {
    this.updateTask({ priority });
  }

  onDueDateChange(dueDate: string): void {
    this.updateTask({ due_date: dueDate || null });
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

    this.taskService.assignUser(task.id, member.id).subscribe({
      next: () => {
        const newAssignee: Assignee = {
          id: member.id,
          display_name: member.name || 'Unknown',
          avatar_url: member.avatar_url,
        };
        const updatedTask = {
          ...task,
          assignees: [...(task.assignees || []), newAssignee],
        };
        this.task.set(updatedTask);
        this.taskUpdated.emit(updatedTask);
      },
      error: () => {},
    });
  }

  onUnassign(assignee: Assignee): void {
    const task = this.task();
    if (!task) return;

    this.taskService.unassignUser(task.id, assignee.id).subscribe({
      next: () => {
        const updatedTask = {
          ...task,
          assignees: (task.assignees || []).filter((a) => a.id !== assignee.id),
        };
        this.task.set(updatedTask);
        this.taskUpdated.emit(updatedTask);
      },
      error: () => {},
    });
  }

  onRemoveLabel(labelId: string): void {
    const task = this.task();
    if (!task) return;

    this.taskService.removeLabel(task.id, labelId).subscribe({
      next: () => {
        const updatedTask = {
          ...task,
          labels: (task.labels || []).filter((l) => l.id !== labelId),
        };
        this.task.set(updatedTask);
        this.taskUpdated.emit(updatedTask);
      },
      error: () => {},
    });
  }

  onMilestoneChange(milestoneId: string): void {
    const task = this.task();
    if (!task) return;

    if (milestoneId) {
      this.milestoneService.assignTask(task.id, milestoneId).subscribe({
        next: () => {
          const updatedTask = { ...task, milestone_id: milestoneId };
          this.task.set(updatedTask);
          this.taskUpdated.emit(updatedTask);
          const ms =
            this.milestones().find((m) => m.id === milestoneId) || null;
          this.selectedMilestone.set(ms);
        },
        error: () => {},
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
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
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

  private updateTask(updates: Partial<Task>): void {
    const task = this.task();
    if (!task) return;

    // Apply optimistically to local signal
    const optimisticTask = { ...task, ...updates };
    this.task.set(optimisticTask);
    this.taskUpdated.emit(optimisticTask);

    this.taskService.updateTask(task.id, updates).subscribe({
      next: (serverTask) => {
        this.task.set(serverTask);
        this.taskUpdated.emit(serverTask);
      },
      error: () => {
        // Rollback
        this.task.set(task);
        this.taskUpdated.emit(task);
      },
    });
  }

  private onClearMilestone(): void {
    const task = this.task();
    if (!task) return;

    this.milestoneService.unassignTask(task.id).subscribe({
      next: () => {
        const updatedTask = { ...task, milestone_id: null };
        this.task.set(updatedTask);
        this.taskUpdated.emit(updatedTask);
        this.selectedMilestone.set(null);
      },
      error: () => {},
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
}
