import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { Task, TaskListItem } from '../../../core/services/task.service';
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

@Component({
  selector: 'app-task-detail-fields',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Select,
    DatePicker,
    InputTextModule,
    ButtonModule,
    Tooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Dependencies -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-link text-gray-400"></i>
            <h3 class="text-sm font-medium text-[var(--card-foreground)]">
              Dependencies
            </h3>
            <span class="text-xs text-gray-400"
              >({{ dependencies().length }})</span
            >
          </div>
          <button
            (click)="toggleAddDependency()"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded"
          >
            <i class="pi pi-plus text-xs"></i>
            Add
          </button>
        </div>

        <!-- Add Dependency Form -->
        @if (showAddDependency()) {
          <div class="mb-3 bg-[var(--secondary)] rounded-md p-3 space-y-2">
            <p-select
              [ngModel]="selectedDepType()"
              (ngModelChange)="selectedDepType.set($event)"
              [options]="depTypeOptions"
              optionLabel="label"
              optionValue="value"
              styleClass="w-full"
            />
            <input
              pInputText
              type="text"
              [ngModel]="depSearchQuery()"
              (ngModelChange)="onDepSearchInput($event)"
              placeholder="Search tasks..."
              class="w-full"
            />
            @if (depSearchResults().length > 0) {
              <div
                class="max-h-40 overflow-y-auto border border-[var(--border)] rounded-md bg-[var(--card)]"
              >
                @for (t of depSearchResults(); track t.id) {
                  <button
                    (click)="onSelectDepTask(t)"
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] text-left"
                  >
                    <span
                      class="w-2 h-2 rounded-full flex-shrink-0"
                      [class.bg-red-500]="t.priority === 'urgent'"
                      [class.bg-orange-500]="t.priority === 'high'"
                      [class.bg-yellow-500]="t.priority === 'medium'"
                      [class.bg-blue-500]="t.priority === 'low'"
                    ></span>
                    <span class="truncate">{{ t.title }}</span>
                    <span class="text-xs text-gray-400 ml-auto flex-shrink-0">{{
                      t.column_name
                    }}</span>
                  </button>
                }
              </div>
            }
          </div>
        }

        <!-- Blocking -->
        @if (blockingDeps().length > 0) {
          <div class="mb-2">
            <span
              class="text-xs font-medium text-red-600 uppercase tracking-wide"
              >Blocking</span
            >
            <div class="mt-1 space-y-1">
              @for (dep of blockingDeps(); track dep.id) {
                <div
                  class="flex items-center justify-between px-2 py-1.5 bg-red-50 rounded text-sm group"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class="w-2 h-2 rounded-full flex-shrink-0"
                      [class.bg-red-500]="
                        dep.related_task_priority === 'urgent'
                      "
                      [class.bg-orange-500]="
                        dep.related_task_priority === 'high'
                      "
                      [class.bg-yellow-500]="
                        dep.related_task_priority === 'medium'
                      "
                      [class.bg-blue-500]="dep.related_task_priority === 'low'"
                    ></span>
                    <span class="truncate text-red-800">{{
                      dep.related_task_title
                    }}</span>
                    <span class="text-xs text-red-400 flex-shrink-0">{{
                      dep.related_task_column_name
                    }}</span>
                  </div>
                  <button
                    (click)="dependencyRemoved.emit(dep.id)"
                    class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-0.5"
                  >
                    <i class="pi pi-times text-xs"></i>
                  </button>
                </div>
              }
            </div>
          </div>
        }

        <!-- Blocked by -->
        @if (blockedByDeps().length > 0) {
          <div class="mb-2">
            <span
              class="text-xs font-medium text-orange-600 uppercase tracking-wide"
              >Blocked by</span
            >
            <div class="mt-1 space-y-1">
              @for (dep of blockedByDeps(); track dep.id) {
                <div
                  class="flex items-center justify-between px-2 py-1.5 bg-orange-50 rounded text-sm group"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class="w-2 h-2 rounded-full flex-shrink-0"
                      [class.bg-red-500]="
                        dep.related_task_priority === 'urgent'
                      "
                      [class.bg-orange-500]="
                        dep.related_task_priority === 'high'
                      "
                      [class.bg-yellow-500]="
                        dep.related_task_priority === 'medium'
                      "
                      [class.bg-blue-500]="dep.related_task_priority === 'low'"
                    ></span>
                    <span class="truncate text-orange-800">{{
                      dep.related_task_title
                    }}</span>
                    <span class="text-xs text-orange-400 flex-shrink-0">{{
                      dep.related_task_column_name
                    }}</span>
                  </div>
                  <button
                    (click)="dependencyRemoved.emit(dep.id)"
                    class="opacity-0 group-hover:opacity-100 text-orange-400 hover:text-orange-600 p-0.5"
                  >
                    <i class="pi pi-times text-xs"></i>
                  </button>
                </div>
              }
            </div>
          </div>
        }

        <!-- Related -->
        @if (relatedDeps().length > 0) {
          <div class="mb-2">
            <span
              class="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide"
              >Related</span
            >
            <div class="mt-1 space-y-1">
              @for (dep of relatedDeps(); track dep.id) {
                <div
                  class="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded text-sm group"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class="w-2 h-2 rounded-full flex-shrink-0"
                      [class.bg-red-500]="
                        dep.related_task_priority === 'urgent'
                      "
                      [class.bg-orange-500]="
                        dep.related_task_priority === 'high'
                      "
                      [class.bg-yellow-500]="
                        dep.related_task_priority === 'medium'
                      "
                      [class.bg-blue-500]="dep.related_task_priority === 'low'"
                    ></span>
                    <span class="truncate text-gray-800">{{
                      dep.related_task_title
                    }}</span>
                    <span class="text-xs text-gray-400 flex-shrink-0">{{
                      dep.related_task_column_name
                    }}</span>
                  </div>
                  <button
                    (click)="dependencyRemoved.emit(dep.id)"
                    class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[var(--foreground)] p-0.5"
                  >
                    <i class="pi pi-times text-xs"></i>
                  </button>
                </div>
              }
            </div>
          </div>
        }

        @if (dependencies().length === 0 && !showAddDependency()) {
          <div class="text-sm text-gray-400">No dependencies</div>
        }
      </div>

      <!-- Custom Fields -->
      @if (customFields().length > 0) {
        <div class="border-t border-[var(--border)] pt-6">
          <div class="flex items-center gap-2 mb-3">
            <i class="pi pi-clipboard text-gray-400"></i>
            <h3 class="text-sm font-medium text-[var(--card-foreground)]">
              Custom Fields
            </h3>
          </div>
          <div class="space-y-3">
            @for (cf of customFields(); track cf.field_id) {
              <div class="flex flex-col gap-1">
                <label
                  class="text-xs font-medium text-[var(--muted-foreground)]"
                >
                  {{ cf.field_name }}
                  @if (cf.is_required) {
                    <span class="text-red-500">*</span>
                  }
                </label>
                @switch (cf.field_type) {
                  @case ('text') {
                    <input
                      pInputText
                      type="text"
                      [ngModel]="cf.value_text || ''"
                      (ngModelChange)="
                        onCustomFieldTextChange(cf.field_id, $event)
                      "
                      (blur)="customFieldSaveRequested.emit()"
                      class="w-full"
                      placeholder="Enter text..."
                    />
                  }
                  @case ('number') {
                    <input
                      pInputText
                      type="number"
                      [ngModel]="cf.value_number"
                      (ngModelChange)="
                        onCustomFieldNumberChange(cf.field_id, $event)
                      "
                      (blur)="customFieldSaveRequested.emit()"
                      class="w-full"
                      placeholder="Enter number..."
                    />
                  }
                  @case ('date') {
                    <p-datePicker
                      [ngModel]="cf.value_date ? toDate(cf.value_date) : null"
                      (ngModelChange)="
                        onCustomFieldDateChange(cf.field_id, $event)
                      "
                      dateFormat="yy-mm-dd"
                      [showIcon]="true"
                      [showClear]="true"
                      styleClass="w-full"
                    />
                  }
                  @case ('dropdown') {
                    <p-select
                      [ngModel]="cf.value_text || ''"
                      (ngModelChange)="
                        onCustomFieldDropdownChange(cf.field_id, $event)
                      "
                      [options]="getDropdownSelectOptions(cf.options)"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Select..."
                      [showClear]="true"
                      styleClass="w-full"
                    />
                  }
                  @case ('checkbox') {
                    <label
                      class="inline-flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        [ngModel]="cf.value_bool || false"
                        (ngModelChange)="
                          onCustomFieldCheckboxChange(cf.field_id, $event)
                        "
                        class="rounded border-[var(--border)] text-primary focus:ring-ring"
                      />
                      <span class="text-sm text-[var(--foreground)]">{{
                        cf.value_bool ? 'Yes' : 'No'
                      }}</span>
                    </label>
                  }
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Recurring -->
      <div class="border-t border-[var(--border)] pt-6">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-replay text-gray-400"></i>
            <h3 class="text-sm font-medium text-[var(--card-foreground)]">
              Recurring
            </h3>
          </div>
          @if (!recurringConfig() && !showRecurringForm()) {
            <button
              (click)="toggleRecurringForm()"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded"
            >
              <i class="pi pi-plus text-xs"></i>
              Set as recurring
            </button>
          }
        </div>

        @if (recurringConfig(); as config) {
          <div class="bg-primary/10 rounded-md p-3 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-primary"
                  >Repeats: {{ getPatternLabel(config.pattern) }}</span
                >
                @if (!config.is_active) {
                  <span
                    class="text-xs px-1.5 py-0.5 bg-[var(--secondary)] text-[var(--muted-foreground)] rounded"
                    >Paused</span
                  >
                }
              </div>
              <div class="flex items-center gap-1">
                <button
                  (click)="toggleRecurringForm()"
                  class="p-1 text-primary hover:text-primary rounded"
                  pTooltip="Edit"
                >
                  <i class="pi pi-pencil text-xs"></i>
                </button>
                <button
                  (click)="recurringRemoved.emit()"
                  class="p-1 text-red-400 hover:text-red-600 rounded"
                  pTooltip="Remove"
                >
                  <i class="pi pi-times text-xs"></i>
                </button>
              </div>
            </div>
            <div class="text-xs text-primary space-y-1">
              <div>Next run: {{ formatDate(config.next_run_at) }}</div>
              <div>
                Occurrences: {{ config.occurrences_created
                }}{{
                  config.max_occurrences ? ' / ' + config.max_occurrences : ''
                }}
              </div>
              @if (config.interval_days && config.pattern === 'custom') {
                <div>Every {{ config.interval_days }} days</div>
              }
            </div>
          </div>
        }

        @if (showRecurringForm()) {
          <div class="bg-[var(--secondary)] rounded-md p-3 space-y-3">
            <div>
              <label
                class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                >Pattern</label
              >
              <p-select
                [ngModel]="recurringPattern()"
                (ngModelChange)="recurringPattern.set($event)"
                [options]="recurringPatternOptions"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full"
              />
            </div>
            @if (recurringPattern() === 'custom') {
              <div>
                <label
                  class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                  >Interval (days)</label
                >
                <input
                  pInputText
                  type="number"
                  min="1"
                  [ngModel]="recurringIntervalDays()"
                  (ngModelChange)="recurringIntervalDays.set($event)"
                  class="w-full"
                  placeholder="e.g. 3"
                />
              </div>
            }
            <div>
              <label
                class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                >Max occurrences (optional)</label
              >
              <input
                pInputText
                type="number"
                min="1"
                [ngModel]="recurringMaxOccurrences()"
                (ngModelChange)="recurringMaxOccurrences.set($event)"
                class="w-full"
                placeholder="Leave empty for unlimited"
              />
            </div>
            <div class="flex items-center gap-2">
              <p-button
                [label]="recurringConfig() ? 'Update' : 'Save'"
                (onClick)="onSaveRecurring()"
                size="small"
              />
              <p-button
                label="Cancel"
                [text]="true"
                severity="secondary"
                (onClick)="toggleRecurringForm()"
                size="small"
              />
            </div>
          </div>
        }

        @if (!recurringConfig() && !showRecurringForm()) {
          <div class="text-sm text-gray-400">Not recurring</div>
        }
      </div>

      <!-- Time Tracking -->
      <div class="border-t border-[var(--border)] pt-6">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-clock text-gray-400"></i>
            <h3 class="text-sm font-medium text-[var(--card-foreground)]">
              Time Tracking
            </h3>
            @if (timeEntryTotalMinutes() > 0) {
              <span class="text-xs text-gray-400"
                >({{ formatDuration(timeEntryTotalMinutes()) }})</span
              >
            }
          </div>
          <button
            (click)="toggleLogTimeForm()"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded"
          >
            <i class="pi pi-plus text-xs"></i>
            Log Time
          </button>
        </div>

        <!-- Timer Control -->
        <div class="mb-3">
          @if (runningTimer()) {
            <div class="flex items-center gap-3 px-3 py-2 bg-red-50 rounded-md">
              <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <span class="text-sm font-mono text-red-700 flex-1">{{
                elapsedTime()
              }}</span>
              <p-button
                label="Stop"
                icon="pi pi-stop"
                severity="danger"
                size="small"
                (onClick)="timerStopped.emit()"
              />
            </div>
          } @else {
            <p-button
              label="Start Timer"
              icon="pi pi-play"
              severity="success"
              [outlined]="true"
              styleClass="w-full"
              (onClick)="timerStarted.emit()"
            />
          }
        </div>

        <!-- Log Time Form -->
        @if (showLogTimeForm()) {
          <div class="mb-3 bg-[var(--secondary)] rounded-md p-3 space-y-2">
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="block text-xs text-[var(--muted-foreground)] mb-1"
                  >Hours</label
                >
                <input
                  pInputText
                  type="number"
                  min="0"
                  [ngModel]="logTimeHours()"
                  (ngModelChange)="logTimeHours.set($event)"
                  class="w-full"
                  placeholder="0"
                />
              </div>
              <div class="flex-1">
                <label class="block text-xs text-[var(--muted-foreground)] mb-1"
                  >Minutes</label
                >
                <input
                  pInputText
                  type="number"
                  min="0"
                  max="59"
                  [ngModel]="logTimeMinutes()"
                  (ngModelChange)="logTimeMinutes.set($event)"
                  class="w-full"
                  placeholder="0"
                />
              </div>
            </div>
            <input
              pInputText
              type="text"
              [ngModel]="logTimeDescription()"
              (ngModelChange)="logTimeDescription.set($event)"
              placeholder="Description (optional)"
              class="w-full"
            />
            <p-datePicker
              [ngModel]="logTimeDateValue()"
              (ngModelChange)="onLogTimeDatePickerChange($event)"
              dateFormat="yy-mm-dd"
              [showIcon]="true"
              styleClass="w-full"
            />
            <div class="flex gap-2">
              <p-button
                label="Log Time"
                (onClick)="onSubmitLogTime()"
                styleClass="flex-1"
                size="small"
              />
              <p-button
                label="Cancel"
                [text]="true"
                severity="secondary"
                (onClick)="toggleLogTimeForm()"
                size="small"
              />
            </div>
          </div>
        }

        <!-- Time Entries List -->
        @if (timeEntries().length > 0) {
          <div class="space-y-1">
            @for (entry of timeEntries(); track entry.id) {
              <div
                class="flex items-center justify-between px-2 py-1.5 hover:bg-[var(--muted)] rounded text-sm group"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="font-mono text-[var(--foreground)] flex-shrink-0"
                  >
                    {{ formatDuration(entry.duration_minutes || 0) }}
                  </span>
                  @if (entry.description) {
                    <span class="text-[var(--muted-foreground)] truncate">{{
                      entry.description
                    }}</span>
                  }
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-400 flex-shrink-0">{{
                    formatDate(entry.started_at)
                  }}</span>
                  <button
                    (click)="timeEntryDeleted.emit(entry.id)"
                    class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-0.5"
                  >
                    <i class="pi pi-times text-xs"></i>
                  </button>
                </div>
              </div>
            }
          </div>
        } @else if (!showLogTimeForm()) {
          <div class="text-sm text-gray-400">No time entries</div>
        }
      </div>
    </div>
  `,
})
export class TaskDetailFieldsComponent {
  // Inputs
  taskId = input.required<string>();
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

  // Internal state
  showAddDependency = signal(false);
  selectedDepType = signal<DependencyType>('blocks');
  depSearchQuery = signal('');
  showRecurringForm = signal(false);
  recurringPattern = signal<RecurrencePattern>('weekly');
  recurringIntervalDays = signal<number | null>(null);
  recurringMaxOccurrences = signal<number | null>(null);
  showLogTimeForm = signal(false);
  logTimeHours = signal(0);
  logTimeMinutes = signal(0);
  logTimeDescription = signal('');
  logTimeDate = signal(new Date().toISOString().split('T')[0]);

  depTypeOptions = [
    { value: 'blocks', label: 'Blocks' },
    { value: 'blocked_by', label: 'Blocked by' },
    { value: 'related', label: 'Related to' },
  ];

  recurringPatternOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Biweekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'custom', label: 'Custom' },
  ];

  logTimeDateValue = computed(() => {
    const d = this.logTimeDate();
    return d ? new Date(d) : new Date();
  });

  timeEntryTotalMinutes(): number {
    return this.timeEntries().reduce(
      (sum, e) => sum + (e.duration_minutes || 0),
      0,
    );
  }

  formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  toDate(dateString: string): Date {
    return new Date(dateString);
  }

  getPatternLabel(pattern: RecurrencePattern): string {
    const labels: Record<RecurrencePattern, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      biweekly: 'Biweekly',
      monthly: 'Monthly',
      custom: 'Custom',
    };
    return labels[pattern] || pattern;
  }

  getDropdownSelectOptions(
    options: unknown,
  ): { label: string; value: string }[] {
    const opts = Array.isArray(options) ? options : [];
    return opts.map((opt: string) => ({ label: opt, value: opt }));
  }

  toggleAddDependency(): void {
    this.showAddDependency.update((v) => !v);
    if (!this.showAddDependency()) {
      this.depSearchQuery.set('');
    }
  }

  onDepSearchInput(query: string): void {
    this.depSearchQuery.set(query);
    this.depSearchChanged.emit(query);
  }

  onSelectDepTask(targetTask: TaskListItem): void {
    this.dependencyAdded.emit({
      targetTaskId: targetTask.id,
      depType: this.selectedDepType(),
    });
    this.showAddDependency.set(false);
    this.depSearchQuery.set('');
  }

  onCustomFieldTextChange(fieldId: string, value: string): void {
    this.customFieldChanged.emit({
      fieldId,
      field: 'value_text',
      value: value || null,
    });
  }

  onCustomFieldNumberChange(fieldId: string, value: number | null): void {
    this.customFieldChanged.emit({ fieldId, field: 'value_number', value });
  }

  onCustomFieldDateChange(fieldId: string, date: Date | null): void {
    const dateValue = date ? date.toISOString().split('T')[0] : '';
    this.customFieldChanged.emit({
      fieldId,
      field: 'value_date',
      value: dateValue ? new Date(dateValue).toISOString() : null,
    });
    this.customFieldSaveRequested.emit();
  }

  onCustomFieldDropdownChange(fieldId: string, value: string): void {
    this.customFieldChanged.emit({
      fieldId,
      field: 'value_text',
      value: value || null,
    });
    this.customFieldSaveRequested.emit();
  }

  onCustomFieldCheckboxChange(fieldId: string, value: boolean): void {
    this.customFieldChanged.emit({ fieldId, field: 'value_bool', value });
    this.customFieldSaveRequested.emit();
  }

  toggleRecurringForm(): void {
    this.showRecurringForm.update((v) => !v);
    if (this.showRecurringForm()) {
      const config = this.recurringConfig();
      if (config) {
        this.recurringPattern.set(config.pattern);
        this.recurringIntervalDays.set(config.interval_days);
        this.recurringMaxOccurrences.set(config.max_occurrences);
      } else {
        this.recurringPattern.set('weekly');
        this.recurringIntervalDays.set(null);
        this.recurringMaxOccurrences.set(null);
      }
    }
  }

  onSaveRecurring(): void {
    this.recurringSaved.emit({
      pattern: this.recurringPattern(),
      intervalDays:
        this.recurringPattern() === 'custom'
          ? this.recurringIntervalDays()
          : null,
      maxOccurrences: this.recurringMaxOccurrences(),
    });
    this.showRecurringForm.set(false);
  }

  toggleLogTimeForm(): void {
    this.showLogTimeForm.update((v) => !v);
    if (this.showLogTimeForm()) {
      this.logTimeHours.set(0);
      this.logTimeMinutes.set(0);
      this.logTimeDescription.set('');
      this.logTimeDate.set(new Date().toISOString().split('T')[0]);
    }
  }

  onLogTimeDatePickerChange(date: Date | null): void {
    this.logTimeDate.set(
      date
        ? date.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    );
  }

  onSubmitLogTime(): void {
    const hours = this.logTimeHours() || 0;
    const minutes = this.logTimeMinutes() || 0;
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes <= 0) return;

    this.timeEntryLogged.emit({
      hours,
      minutes,
      description: this.logTimeDescription() || '',
      date: this.logTimeDate() || new Date().toISOString().split('T')[0],
    });
    this.showLogTimeForm.set(false);
  }
}
