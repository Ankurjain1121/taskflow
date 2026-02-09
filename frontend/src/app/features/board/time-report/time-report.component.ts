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
import {
  TimeTrackingService,
  TaskTimeReport,
} from '../../../core/services/time-tracking.service';

@Component({
  selector: 'app-time-report',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 class="text-lg font-semibold text-gray-900">Time Report</h2>
          </div>
          @if (!loading()) {
            <div class="mt-2 text-sm text-gray-500">
              Total: <span class="font-semibold text-gray-900">{{ formatTotalTime(totalMinutes()) }}</span>
              across {{ reportData().length }} tasks
            </div>
          }
        </div>

        @if (loading()) {
          <div class="flex items-center justify-center py-12">
            <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        } @else if (reportData().length === 0) {
          <div class="py-12 text-center text-gray-500">
            <svg class="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-sm">No time entries recorded yet</p>
          </div>
        } @else {
          <!-- Bar Chart -->
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-sm font-medium text-gray-700 mb-4">Time per Task</h3>
            <div class="space-y-3">
              @for (item of reportData(); track item.task_id) {
                <div class="flex items-center gap-3">
                  <div class="w-40 text-sm text-gray-700 truncate flex-shrink-0" [title]="item.task_title">
                    {{ item.task_title }}
                  </div>
                  <div class="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      [style.width.%]="getBarWidth(item.total_minutes)"
                    ></div>
                  </div>
                  <div class="w-20 text-sm text-gray-600 text-right flex-shrink-0">
                    {{ formatTotalTime(item.total_minutes) }}
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="bg-gray-50 border-b border-gray-200">
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Time</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Entries</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% of Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                @for (item of reportData(); track item.task_id) {
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{{ item.task_title }}</td>
                    <td class="px-6 py-4 text-sm text-gray-600 text-right font-mono">{{ formatTotalTime(item.total_minutes) }}</td>
                    <td class="px-6 py-4 text-sm text-gray-600 text-right">{{ item.entries_count }}</td>
                    <td class="px-6 py-4 text-sm text-right">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                        {{ getPercentage(item.total_minutes) }}%
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="bg-gray-50 border-t border-gray-200 font-semibold">
                  <td class="px-6 py-3 text-sm text-gray-900">Total</td>
                  <td class="px-6 py-3 text-sm text-gray-900 text-right font-mono">{{ formatTotalTime(totalMinutes()) }}</td>
                  <td class="px-6 py-3 text-sm text-gray-900 text-right">{{ totalEntries() }}</td>
                  <td class="px-6 py-3 text-sm text-gray-900 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        }
      </div>
    </div>
  `,
})
export class TimeReportComponent implements OnInit, OnChanges {
  private timeTrackingService = inject(TimeTrackingService);

  boardId = input.required<string>();

  loading = signal(true);
  reportData = signal<TaskTimeReport[]>([]);

  totalMinutes = computed(() =>
    this.reportData().reduce((sum, item) => sum + item.total_minutes, 0)
  );

  totalEntries = computed(() =>
    this.reportData().reduce((sum, item) => sum + item.entries_count, 0)
  );

  ngOnInit(): void {
    this.loadReport();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['boardId'] && !changes['boardId'].firstChange) {
      this.loadReport();
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

  private loadReport(): void {
    this.loading.set(true);
    this.timeTrackingService.getBoardTimeReport(this.boardId()).subscribe({
      next: (data) => {
        this.reportData.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load time report:', err);
        this.reportData.set([]);
        this.loading.set(false);
      },
    });
  }
}
