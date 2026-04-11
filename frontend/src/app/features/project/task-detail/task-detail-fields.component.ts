import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { TaskListItem } from '../../../core/services/task.service';
import {
  TaskDependency,
  DependencyType,
} from '../../../core/services/dependency.service';
import { TaskCustomFieldValueWithField } from '../../../core/services/custom-field.service';
import {
  RecurringTaskConfig,
  RecurrencePattern,
} from '../../../core/services/recurring.service';
import { TimeEntry } from '../../../core/services/time-tracking.service';
import { TaskDependenciesSectionComponent } from './task-dependencies-section.component';
import { TaskCustomFieldsSectionComponent } from './task-custom-fields-section.component';
import { TaskRecurringSectionComponent } from './task-recurring-section.component';
import { TaskTimeTrackingSectionComponent } from './task-time-tracking-section.component';
import { TaskLinkedIssuesSectionComponent } from './task-linked-issues-section.component';
import { TaskStatusTimelineSectionComponent } from './task-status-timeline-section.component';

@Component({
  selector: 'app-task-detail-fields',
  standalone: true,
  imports: [
    TaskDependenciesSectionComponent,
    TaskCustomFieldsSectionComponent,
    TaskRecurringSectionComponent,
    TaskTimeTrackingSectionComponent,
    TaskLinkedIssuesSectionComponent,
    TaskStatusTimelineSectionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <app-task-dependencies-section
        [dependencies]="dependencies()"
        [blockingDeps]="blockingDeps()"
        [blockedByDeps]="blockedByDeps()"
        [relatedDeps]="relatedDeps()"
        [depSearchResults]="depSearchResults()"
        (dependencyAdded)="dependencyAdded.emit($event)"
        (dependencyRemoved)="dependencyRemoved.emit($event)"
        (depSearchChanged)="depSearchChanged.emit($event)"
      />

      <app-task-status-timeline-section [taskId]="taskId()" />

      <app-task-linked-issues-section
        [taskId]="taskId()"
        [projectId]="projectId()"
      />

      <app-task-custom-fields-section
        [customFields]="customFields()"
        (customFieldChanged)="customFieldChanged.emit($event)"
        (customFieldSaveRequested)="customFieldSaveRequested.emit()"
      />

      <app-task-recurring-section
        [recurringConfig]="recurringConfig()"
        (recurringSaved)="recurringSaved.emit($event)"
        (recurringRemoved)="recurringRemoved.emit()"
      />

      <app-task-time-tracking-section
        [timeEntries]="timeEntries()"
        [runningTimer]="runningTimer()"
        [elapsedTime]="elapsedTime()"
        (timerStarted)="timerStarted.emit()"
        (timerStopped)="timerStopped.emit()"
        (timeEntryLogged)="timeEntryLogged.emit($event)"
        (timeEntryDeleted)="timeEntryDeleted.emit($event)"
      />
    </div>
  `,
})
export class TaskDetailFieldsComponent {
  // Inputs
  taskId = input.required<string>();
  projectId = input<string>('');
  dependencies = input<TaskDependency[]>([]);
  blockingDeps = input<TaskDependency[]>([]);
  blockedByDeps = input<TaskDependency[]>([]);
  relatedDeps = input<TaskDependency[]>([]);
  depSearchResults = input<TaskListItem[]>([]);
  customFields = input<TaskCustomFieldValueWithField[]>([]);
  recurringConfig = input<RecurringTaskConfig | null>(null);
  timeEntries = input<TimeEntry[]>([]);
  runningTimer = input<TimeEntry | null>(null);
  elapsedTime = input<string>('00:00:00');

  // Outputs
  dependencyAdded = output<{ targetTaskId: string; depType: DependencyType }>();
  dependencyRemoved = output<string>();
  depSearchChanged = output<string>();
  customFieldChanged = output<{
    fieldId: string;
    field: string;
    value: unknown;
  }>();
  customFieldSaveRequested = output<void>();
  recurringSaved = output<{
    pattern: RecurrencePattern;
    intervalDays: number | null;
    maxOccurrences: number | null;
  }>();
  recurringRemoved = output<void>();
  timerStarted = output<void>();
  timerStopped = output<void>();
  timeEntryLogged = output<{
    hours: number;
    minutes: number;
    description: string;
    date: string;
  }>();
  timeEntryDeleted = output<string>();
}
