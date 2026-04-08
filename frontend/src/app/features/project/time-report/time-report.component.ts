import {
  Component,
  input,
  signal,
  computed,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { Checkbox } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import {
  TimeTrackingService,
  TaskTimeReport,
  TimesheetReport,
  TimesheetEntry,
} from '../../../core/services/time-tracking.service';
import {
  ProjectService,
  ProjectMember,
} from '../../../core/services/project.service';

type ViewMode = 'simple' | 'timesheet';

interface UserOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-time-report',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker, Select, Checkbox, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <div
        class="bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-[var(--border)]">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <svg
                class="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h2 class="text-lg font-display font-semibold text-[var(--card-foreground)]">
                Time Report
              </h2>
            </div>

            <div class="flex items-center gap-2">
            <!-- Export PDF Button -->
            <button
              class="no-print flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--secondary)] transition-colors"
              (click)="exportPdf()"
              title="Export as PDF"
            >
              <i class="pi pi-print text-sm"></i>
              Export PDF
            </button>

            <!-- View Mode Toggle -->
            <div
              class="flex items-center bg-[var(--secondary)] rounded-lg p-0.5"
            >
              <button
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                [class]="
                  viewMode() === 'simple'
                    ? 'bg-[var(--card)] text-[var(--card-foreground)] shadow-sm'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--card-foreground)]'
                "
                (click)="setViewMode('simple')"
              >
                Summary
              </button>
              <button
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                [class]="
                  viewMode() === 'timesheet'
                    ? 'bg-[var(--card)] text-[var(--card-foreground)] shadow-sm'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--card-foreground)]'
                "
                (click)="setViewMode('timesheet')"
              >
                Timesheet
              </button>
            </div>
            </div>
          </div>

          @if (viewMode() === 'simple' && !loading()) {
            <div class="mt-2 text-sm text-[var(--muted-foreground)]">
              Total:
              <span class="font-semibold text-[var(--card-foreground)]">{{
                formatTotalTime(totalMinutes())
              }}</span>
              across {{ reportData().length }} tasks
            </div>
          }
        </div>

        <!-- Timesheet Filters -->
        @if (viewMode() === 'timesheet') {
          <div
            class="px-6 py-4 border-b border-[var(--border)] bg-[var(--secondary)]/30"
          >
            <div class="flex flex-wrap items-end gap-4">
              <div class="flex flex-col gap-1">
                <label
                  class="text-xs font-medium text-[var(--muted-foreground)]"
                  >Start Date</label
                >
                <p-datepicker
                  [(ngModel)]="filterStartDate"
                  [showIcon]="true"
                  dateFormat="yy-mm-dd"
                  placeholder="Start date"
                  [style]="{ width: '160px' }"
                  (onSelect)="loadTimesheetReport()"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label
                  class="text-xs font-medium text-[var(--muted-foreground)]"
                  >End Date</label
                >
                <p-datepicker
                  [(ngModel)]="filterEndDate"
                  [showIcon]="true"
                  dateFormat="yy-mm-dd"
                  placeholder="End date"
                  [style]="{ width: '160px' }"
                  (onSelect)="loadTimesheetReport()"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label
                  class="text-xs font-medium text-[var(--muted-foreground)]"
                  >User</label
                >
                <p-select
                  [(ngModel)]="filterUserId"
                  [options]="userOptions()"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="All users"
                  [showClear]="true"
                  [style]="{ width: '180px' }"
                  (onChange)="loadTimesheetReport()"
                />
              </div>
              <div class="flex items-center gap-2 pb-1">
                <p-checkbox
                  [(ngModel)]="filterBillableOnly"
                  [binary]="true"
                  inputId="billableOnly"
                  (onChange)="loadTimesheetReport()"
                />
                <label
                  for="billableOnly"
                  class="text-sm text-[var(--muted-foreground)] cursor-pointer"
                  >Billable only</label
                >
              </div>
            </div>
          </div>
        }

        @if (loading()) {
          <div class="space-y-3 p-6">
            @for (i of [1, 2, 3]; track i) {
              <div
                class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4"
              >
                <div class="flex items-center gap-4">
                  <div class="skeleton skeleton-text w-40"></div>
                  <div class="flex-1"></div>
                  <div class="skeleton w-20 h-6 rounded-lg"></div>
                  <div class="skeleton w-16 h-4 rounded"></div>
                </div>
              </div>
            }
          </div>
        } @else if (viewMode() === 'simple') {
          <!-- Simple Mode: per-task aggregation -->
          @if (reportData().length === 0) {
            <app-empty-state variant="time-tracking" />
          } @else {
            <!-- Bar Chart (hidden in print — table below is the fallback) -->
            <div class="px-6 py-4 border-b border-[var(--border)] print-hide">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--foreground)] mb-4">
                Time per Task
              </h3>
              <div class="space-y-3">
                @for (item of reportData(); track item.task_id) {
                  <div class="flex items-center gap-3">
                    <div
                      class="w-40 text-sm text-[var(--foreground)] truncate flex-shrink-0"
                      [title]="item.task_title"
                    >
                      {{ item.task_title }}
                    </div>
                    <div
                      class="flex-1 h-6 bg-[var(--secondary)] rounded-full overflow-hidden"
                    >
                      <div
                        class="h-full bg-primary rounded-full transition-all duration-500"
                        [style.width.%]="getBarWidth(item.total_minutes)"
                      ></div>
                    </div>
                    <div
                      class="w-20 text-sm text-[var(--muted-foreground)] text-right flex-shrink-0"
                    >
                      {{ formatTotalTime(item.total_minutes) }}
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Simple Table -->
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr
                    class="bg-[var(--secondary)] border-b border-[var(--border)]"
                  >
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Task
                    </th>
                    <th
                      class="px-6 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Total Time
                    </th>
                    <th
                      class="px-6 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Entries
                    </th>
                    <th
                      class="px-6 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      % of Total
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--border)]">
                  @for (item of reportData(); track item.task_id) {
                    <tr class="hover:bg-[var(--muted)]">
                      <td
                        class="px-6 py-4 text-sm text-[var(--card-foreground)] max-w-xs truncate"
                      >
                        {{ item.task_title }}
                      </td>
                      <td
                        class="px-6 py-4 text-sm text-[var(--muted-foreground)] text-right font-mono"
                      >
                        {{ formatTotalTime(item.total_minutes) }}
                      </td>
                      <td
                        class="px-6 py-4 text-sm text-[var(--muted-foreground)] text-right"
                      >
                        {{ item.entries_count }}
                      </td>
                      <td class="px-6 py-4 text-sm text-right">
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary"
                        >
                          {{ getPercentage(item.total_minutes) }}%
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr
                    class="bg-[var(--secondary)] border-t border-[var(--border)] font-semibold"
                  >
                    <td
                      class="px-6 py-3 text-sm text-[var(--card-foreground)]"
                    >
                      Total
                    </td>
                    <td
                      class="px-6 py-3 text-sm text-[var(--card-foreground)] text-right font-mono"
                    >
                      {{ formatTotalTime(totalMinutes()) }}
                    </td>
                    <td
                      class="px-6 py-3 text-sm text-[var(--card-foreground)] text-right"
                    >
                      {{ totalEntries() }}
                    </td>
                    <td
                      class="px-6 py-3 text-sm text-[var(--card-foreground)] text-right"
                    >
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }
        } @else {
          <!-- Timesheet Mode: detailed entries with billing -->
          @if (timesheetData()) {
            <!-- Summary Cards -->
            <div class="px-6 py-4 border-b border-[var(--border)]">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                  class="bg-[var(--secondary)] rounded-lg p-4 text-center"
                >
                  <div
                    class="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-1"
                  >
                    Total Hours
                  </div>
                  <div
                    class="text-2xl font-bold text-[var(--card-foreground)]"
                  >
                    {{
                      formatTotalTime(timesheetData()!.summary.total_minutes)
                    }}
                  </div>
                </div>
                <div
                  class="bg-[var(--secondary)] rounded-lg p-4 text-center"
                >
                  <div
                    class="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-1"
                  >
                    Billable Hours
                  </div>
                  <div class="text-2xl font-bold text-[var(--success)]">
                    {{
                      formatTotalTime(
                        timesheetData()!.summary.billable_minutes
                      )
                    }}
                  </div>
                </div>
                <div
                  class="bg-[var(--secondary)] rounded-lg p-4 text-center"
                >
                  <div
                    class="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-1"
                  >
                    Non-Billable
                  </div>
                  <div
                    class="text-2xl font-bold text-[var(--muted-foreground)]"
                  >
                    {{
                      formatTotalTime(
                        timesheetData()!.summary.non_billable_minutes
                      )
                    }}
                  </div>
                </div>
                <div
                  class="bg-[var(--secondary)] rounded-lg p-4 text-center"
                >
                  <div
                    class="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-1"
                  >
                    Total Cost
                  </div>
                  <div class="text-2xl font-bold text-primary">
                    {{
                      formatCost(timesheetData()!.summary.total_cost_cents)
                    }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Timesheet Table -->
            @if (timesheetData()!.entries.length === 0) {
              <app-empty-state variant="time-tracking" />
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr
                      class="bg-[var(--secondary)] border-b border-[var(--border)]"
                    >
                      <th
                        class="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                      >
                        Task
                      </th>
                      <th
                        class="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                      >
                        User
                      </th>
                      <th
                        class="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                      >
                        Description
                      </th>
                      <th
                        class="px-4 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                      >
                        Duration
                      </th>
                      <th
                        class="px-4 py-3 text-center text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                      >
                        Billable
                      </th>
                      <th
                        class="px-4 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                      >
                        Cost
                      </th>
                      <th
                        class="px-4 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                      >
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[var(--border)]">
                    @for (
                      entry of timesheetData()!.entries;
                      track entry.id
                    ) {
                      <tr class="hover:bg-[var(--muted)]">
                        <td
                          class="px-4 py-3 text-sm text-[var(--card-foreground)] max-w-[200px] truncate"
                          [title]="entry.task_title"
                        >
                          {{ entry.task_title }}
                        </td>
                        <td
                          class="px-4 py-3 text-sm text-[var(--muted-foreground)]"
                        >
                          {{ entry.user_name }}
                        </td>
                        <td
                          class="px-4 py-3 text-sm text-[var(--muted-foreground)] max-w-[200px] truncate"
                          [title]="entry.description || ''"
                        >
                          {{ entry.description || '-' }}
                        </td>
                        <td
                          class="px-4 py-3 text-sm text-[var(--muted-foreground)] text-right font-mono"
                        >
                          {{ formatTotalTime(entry.duration_minutes) }}
                        </td>
                        <td class="px-4 py-3 text-center">
                          @if (entry.is_billable) {
                            <span
                              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--success)]/10 text-[var(--success)]"
                            >
                              Billable
                            </span>
                          } @else {
                            <span
                              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--secondary)] text-[var(--muted-foreground)]"
                            >
                              Non-billable
                            </span>
                          }
                        </td>
                        <td
                          class="px-4 py-3 text-sm text-right font-mono"
                          [class]="
                            entry.is_billable
                              ? 'text-[var(--success)]'
                              : 'text-[var(--muted-foreground)]'
                          "
                        >
                          {{ formatEntryCost(entry) }}
                        </td>
                        <td
                          class="px-4 py-3 text-sm text-[var(--muted-foreground)] text-right whitespace-nowrap"
                        >
                          {{ formatDate(entry.started_at) }}
                        </td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr
                      class="bg-[var(--secondary)] border-t border-[var(--border)] font-semibold"
                    >
                      <td
                        colspan="3"
                        class="px-4 py-3 text-sm text-[var(--card-foreground)]"
                      >
                        Total ({{ timesheetData()!.entries.length }} entries)
                      </td>
                      <td
                        class="px-4 py-3 text-sm text-[var(--card-foreground)] text-right font-mono"
                      >
                        {{
                          formatTotalTime(
                            timesheetData()!.summary.total_minutes
                          )
                        }}
                      </td>
                      <td class="px-4 py-3 text-center">
                        <span
                          class="text-xs text-[var(--muted-foreground)]"
                        >
                          {{
                            formatTotalTime(
                              timesheetData()!.summary.billable_minutes
                            )
                          }}
                          billable
                        </span>
                      </td>
                      <td
                        class="px-4 py-3 text-sm text-primary text-right font-mono font-bold"
                      >
                        {{
                          formatCost(
                            timesheetData()!.summary.total_cost_cents
                          )
                        }}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }
          }
        }
      </div>
    </div>
  `,
})
export class TimeReportComponent implements OnInit, OnChanges {
  private timeTrackingService = inject(TimeTrackingService);
  private projectService = inject(ProjectService);

  boardId = input.required<string>();

  loading = signal(true);
  viewMode = signal<ViewMode>('simple');
  reportData = signal<TaskTimeReport[]>([]);
  timesheetData = signal<TimesheetReport | null>(null);
  members = signal<ProjectMember[]>([]);

  // Timesheet filters
  filterStartDate: Date | null = null;
  filterEndDate: Date | null = null;
  filterUserId: string | null = null;
  filterBillableOnly = false;

  userOptions = computed<UserOption[]>(() =>
    this.members().map((m) => ({
      label: m.name || m.email || m.user_id,
      value: m.user_id,
    })),
  );

  totalMinutes = computed(() =>
    this.reportData().reduce((sum, item) => sum + item.total_minutes, 0),
  );

  totalEntries = computed(() =>
    this.reportData().reduce((sum, item) => sum + item.entries_count, 0),
  );

  ngOnInit(): void {
    this.loadReport();
    this.loadMembers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['boardId'] && !changes['boardId'].firstChange) {
      this.loadReport();
      this.loadMembers();
      if (this.viewMode() === 'timesheet') {
        this.loadTimesheetReport();
      }
    }
  }

  exportPdf(): void {
    window.print();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    if (mode === 'timesheet' && !this.timesheetData()) {
      this.loadTimesheetReport();
    }
  }

  formatTotalTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  formatCost(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  formatEntryCost(entry: TimesheetEntry): string {
    if (!entry.is_billable || entry.billing_rate_cents == null) {
      return '-';
    }
    const costCents =
      (entry.duration_minutes / 60) * entry.billing_rate_cents;
    return `$${(costCents / 100).toFixed(2)}`;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  getBarWidth(minutes: number): number {
    const total = this.totalMinutes();
    if (total === 0) return 0;
    return (minutes / total) * 100;
  }

  getPercentage(minutes: number): string {
    const total = this.totalMinutes();
    if (total === 0) return '0';
    return ((minutes / total) * 100).toFixed(1);
  }

  loadTimesheetReport(): void {
    this.loading.set(true);

    const params: Record<string, string | boolean> = {};
    if (this.filterStartDate) {
      params['start_date'] = this.toISODate(this.filterStartDate);
    }
    if (this.filterEndDate) {
      params['end_date'] = this.toISODate(this.filterEndDate);
    }
    if (this.filterUserId) {
      params['user_id'] = this.filterUserId;
    }
    if (this.filterBillableOnly) {
      params['billable_only'] = true;
    }

    this.timeTrackingService
      .getTimesheetReport(
        this.boardId(),
        Object.keys(params).length > 0 ? params : undefined,
      )
      .subscribe({
        next: (data) => {
          this.timesheetData.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.timesheetData.set(null);
          this.loading.set(false);
        },
      });
  }

  private toISODate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private loadReport(): void {
    this.loading.set(true);
    this.timeTrackingService.getBoardTimeReport(this.boardId()).subscribe({
      next: (data) => {
        this.reportData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.reportData.set([]);
        this.loading.set(false);
      },
    });
  }

  private loadMembers(): void {
    this.projectService.getProjectMembers(this.boardId()).subscribe({
      next: (data) => {
        this.members.set(data);
      },
      error: () => {
        this.members.set([]);
      },
    });
  }
}
