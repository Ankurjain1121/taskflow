import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import {
  RecurringTaskConfig,
  RecurrencePattern,
} from '../../../core/services/recurring.service';
import { formatDate, getPatternLabel } from './task-fields-utils';

@Component({
  selector: 'app-task-recurring-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Select,
    InputTextModule,
    ButtonModule,
    Tooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
                aria-label="Edit"
              >
                <i class="pi pi-pencil text-xs"></i>
              </button>
              <button
                (click)="recurringRemoved.emit()"
                class="p-1 text-red-400 hover:text-red-600 rounded"
                pTooltip="Remove"
                aria-label="Remove"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>
          </div>
          <div class="text-xs text-primary space-y-1">
            <div>Next run: {{ formatDate(config.next_run_at) }}</div>
            @if (config.last_run_at) {
              <div>Last run: {{ formatDate(config.last_run_at) }}</div>
            }
            <div>
              Occurrences: {{ config.occurrences_created
              }}{{
                config.max_occurrences ? ' / ' + config.max_occurrences : ''
              }}
            </div>
            @if (config.interval_days && config.pattern === 'custom') {
              <div>Every {{ config.interval_days }} days</div>
            }
            @if (config.skip_weekends) {
              <div>Skips weekends</div>
            }
            @if (config.creation_mode === 'on_completion') {
              <div>Creates on task completion</div>
            }
            @if (config.end_date) {
              <div>Ends: {{ formatDate(config.end_date) }}</div>
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
          @if (recurringPattern() === 'monthly') {
            <div>
              <label
                class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                >Day of month (optional)</label
              >
              <input
                pInputText
                type="number"
                min="1"
                max="31"
                [ngModel]="recurringDayOfMonth()"
                (ngModelChange)="recurringDayOfMonth.set($event)"
                class="w-full"
                placeholder="e.g. 15"
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
          <div>
            <label
              class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
              >End date (optional)</label
            >
            <input
              pInputText
              type="date"
              [ngModel]="recurringEndDate()"
              (ngModelChange)="recurringEndDate.set($event)"
              class="w-full"
            />
          </div>
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              [ngModel]="recurringSkipWeekends()"
              (ngModelChange)="recurringSkipWeekends.set($event)"
              class="accent-primary"
              id="skipWeekends"
            />
            <label
              for="skipWeekends"
              class="text-xs text-[var(--muted-foreground)]"
              >Skip weekends</label
            >
          </div>
          <div>
            <label
              class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
              >Create mode</label
            >
            <p-select
              [ngModel]="recurringCreationMode()"
              (ngModelChange)="recurringCreationMode.set($event)"
              [options]="creationModeOptions"
              optionLabel="label"
              optionValue="value"
              styleClass="w-full"
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
  `,
})
export class TaskRecurringSectionComponent {
  recurringConfig = input<RecurringTaskConfig | null>(null);

  recurringSaved = output<{
    pattern: RecurrencePattern;
    intervalDays: number | null;
    maxOccurrences: number | null;
    skipWeekends: boolean;
    daysOfWeek: number[];
    dayOfMonth: number | null;
    creationMode: string;
    endDate: string | null;
  }>();
  recurringRemoved = output<void>();

  showRecurringForm = signal(false);
  recurringPattern = signal<RecurrencePattern>('weekly');
  recurringIntervalDays = signal<number | null>(null);
  recurringMaxOccurrences = signal<number | null>(null);
  recurringSkipWeekends = signal(false);
  recurringDaysOfWeek = signal<number[]>([]);
  recurringDayOfMonth = signal<number | null>(null);
  recurringCreationMode = signal<string>('on_schedule');
  recurringEndDate = signal<string | null>(null);

  recurringPatternOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'custom_weekly', label: 'Custom Weekly' },
    { value: 'biweekly', label: 'Biweekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'custom', label: 'Custom (interval)' },
  ];

  creationModeOptions = [
    { value: 'on_schedule', label: 'On schedule' },
    { value: 'on_completion', label: 'When completed' },
  ];

  formatDate = formatDate;
  getPatternLabel = getPatternLabel;

  toggleRecurringForm(): void {
    this.showRecurringForm.update((v) => !v);
    if (this.showRecurringForm()) {
      const config = this.recurringConfig();
      if (config) {
        this.recurringPattern.set(config.pattern);
        this.recurringIntervalDays.set(config.interval_days);
        this.recurringMaxOccurrences.set(config.max_occurrences);
        this.recurringSkipWeekends.set(config.skip_weekends);
        this.recurringDaysOfWeek.set(config.days_of_week ?? []);
        this.recurringDayOfMonth.set(config.day_of_month);
        this.recurringCreationMode.set(config.creation_mode ?? 'on_schedule');
        this.recurringEndDate.set(config.end_date);
      } else {
        this.recurringPattern.set('weekly');
        this.recurringIntervalDays.set(null);
        this.recurringMaxOccurrences.set(null);
        this.recurringSkipWeekends.set(false);
        this.recurringDaysOfWeek.set([]);
        this.recurringDayOfMonth.set(null);
        this.recurringCreationMode.set('on_schedule');
        this.recurringEndDate.set(null);
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
      skipWeekends: this.recurringSkipWeekends(),
      daysOfWeek: this.recurringDaysOfWeek(),
      dayOfMonth: this.recurringDayOfMonth(),
      creationMode: this.recurringCreationMode(),
      endDate: this.recurringEndDate(),
    });
    this.showRecurringForm.set(false);
  }
}
