import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TimeEntry } from '../../../core/services/time-tracking.service';
import { formatDuration, formatDate } from './task-fields-utils';

@Component({
  selector: 'app-task-time-tracking-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePicker,
    InputTextModule,
    ButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
                <span class="font-mono text-[var(--foreground)] flex-shrink-0">
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
  `,
})
export class TaskTimeTrackingSectionComponent {
  timeEntries = input<TimeEntry[]>([]);
  runningTimer = input<TimeEntry | null>(null);
  elapsedTime = input<string>('00:00:00');

  timerStarted = output<void>();
  timerStopped = output<void>();
  timeEntryLogged = output<{
    hours: number;
    minutes: number;
    description: string;
    date: string;
  }>();
  timeEntryDeleted = output<string>();

  showLogTimeForm = signal(false);
  logTimeHours = signal(0);
  logTimeMinutes = signal(0);
  logTimeDescription = signal('');
  logTimeDate = signal(new Date().toISOString().split('T')[0]);

  logTimeDateValue = computed(() => {
    const d = this.logTimeDate();
    return d ? new Date(d) : new Date();
  });

  formatDuration = formatDuration;
  formatDate = formatDate;

  timeEntryTotalMinutes(): number {
    return this.timeEntries().reduce(
      (sum, e) => sum + (e.duration_minutes || 0),
      0,
    );
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
