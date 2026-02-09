import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  computed,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReportsService,
  BoardReport,
} from '../../../core/services/reports.service';
import {
  createPieSegments,
  scaleLinear,
  createPolylinePoints,
  createAreaPath,
  generateTicks,
  CHART_PRIORITY_COLORS,
  CHART_COLORS,
} from '../../../shared/utils/svg-charts';

@Component({
  selector: 'app-reports-view',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="p-6 space-y-6 max-w-7xl mx-auto">
        <div class="flex items-center justify-between">
          <div class="skeleton skeleton-heading w-40"></div>
          <div class="skeleton w-32 h-8 rounded-lg"></div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          @for (i of [1,2,3,4]; track i) {
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div class="skeleton skeleton-text w-28 mb-4"></div>
              <div class="skeleton w-full h-40 rounded-lg"></div>
            </div>
          }
        </div>
      </div>
    } @else if (report()) {
      <div class="p-6 space-y-6 max-w-7xl mx-auto">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold text-gray-900">Board Analytics</h2>
          <select
            class="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
            [value]="daysBack()"
            (change)="onDaysChange($event)"
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>

        <!-- Charts Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Completion Rate (Pie) -->
          <div class="bg-white rounded-xl border border-gray-200 p-6">
            <h3 class="text-sm font-medium text-gray-500 mb-4">Completion Rate</h3>
            <div class="flex items-center justify-center">
              <svg viewBox="0 0 100 100" class="w-48 h-48">
                @for (seg of pieSegments(); track seg.label) {
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    [attr.stroke]="seg.color"
                    stroke-width="12"
                    [attr.stroke-dasharray]="seg.dashArray"
                    [attr.stroke-dashoffset]="seg.dashOffset"
                    transform="rotate(-90 50 50)"
                  />
                }
                <text x="50" y="46" text-anchor="middle" class="text-2xl font-bold fill-gray-900" font-size="16">
                  {{ completionPercent() }}%
                </text>
                <text x="50" y="60" text-anchor="middle" class="fill-gray-500" font-size="6">
                  {{ report()!.completion_rate.completed }}/{{ report()!.completion_rate.total }} done
                </text>
              </svg>
            </div>
          </div>

          <!-- Burndown Chart (Line) -->
          <div class="bg-white rounded-xl border border-gray-200 p-6">
            <h3 class="text-sm font-medium text-gray-500 mb-4">Burndown</h3>
            @if (burndownPoints().length > 0) {
              <svg [attr.viewBox]="'0 0 ' + chartWidth + ' ' + chartHeight" class="w-full h-48">
                <!-- Grid lines -->
                @for (tick of burndownYTicks(); track tick) {
                  <line
                    [attr.x1]="40" [attr.y1]="burndownYScale()(tick)"
                    [attr.x2]="chartWidth - 10" [attr.y2]="burndownYScale()(tick)"
                    stroke="#e5e7eb" stroke-width="0.5"
                  />
                  <text [attr.x]="36" [attr.y]="burndownYScale()(tick) + 3"
                    text-anchor="end" fill="#9ca3af" font-size="8">{{ tick }}</text>
                }
                <!-- Area -->
                <path [attr.d]="burndownArea()" fill="#6366f1" opacity="0.1" />
                <!-- Line -->
                <polyline
                  [attr.points]="burndownLine()"
                  fill="none" stroke="#6366f1" stroke-width="2"
                />
                <!-- Dots -->
                @for (pt of burndownPoints(); track pt.x) {
                  <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="2.5" fill="#6366f1" />
                }
              </svg>
            } @else {
              <div class="flex items-center justify-center h-48 text-gray-400 text-sm">No data</div>
            }
          </div>

          <!-- Priority Distribution (Horizontal Bars) -->
          <div class="bg-white rounded-xl border border-gray-200 p-6">
            <h3 class="text-sm font-medium text-gray-500 mb-4">Priority Distribution</h3>
            <div class="space-y-3">
              @for (item of report()!.priority_distribution; track item.priority) {
                <div class="flex items-center gap-3">
                  <span class="text-xs text-gray-600 w-14 text-right capitalize">{{ item.priority }}</span>
                  <div class="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      [style.width.%]="priorityBarWidth(item.count)"
                      [style.background-color]="getPriorityColor(item.priority)"
                    ></div>
                  </div>
                  <span class="text-xs font-medium text-gray-700 w-8">{{ item.count }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Assignee Workload (Stacked Bars) -->
          <div class="bg-white rounded-xl border border-gray-200 p-6">
            <h3 class="text-sm font-medium text-gray-500 mb-4">Assignee Workload</h3>
            @if (report()!.assignee_workload.length > 0) {
              <div class="space-y-3">
                @for (a of report()!.assignee_workload; track a.user_id) {
                  <div class="flex items-center gap-3">
                    <div class="flex items-center gap-2 w-28 min-w-0">
                      <div class="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-700 flex-shrink-0">
                        {{ a.name.charAt(0) }}
                      </div>
                      <span class="text-xs text-gray-600 truncate">{{ a.name }}</span>
                    </div>
                    <div class="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden flex">
                      <div
                        class="h-full bg-green-500 transition-all duration-500"
                        [style.width.%]="workloadBarWidth(a.completed_tasks, a.total_tasks)"
                      ></div>
                      <div
                        class="h-full bg-gray-300 transition-all duration-500"
                        [style.width.%]="workloadBarWidth(a.total_tasks - a.completed_tasks, a.total_tasks)"
                      ></div>
                    </div>
                    <span class="text-xs text-gray-600 w-12 text-right">{{ a.completed_tasks }}/{{ a.total_tasks }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="flex items-center justify-center h-32 text-gray-400 text-sm">No assigned tasks</div>
            }
          </div>

          <!-- Overdue Analysis (Vertical Bars) -->
          <div class="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
            <h3 class="text-sm font-medium text-gray-500 mb-4">Overdue Analysis</h3>
            @if (hasOverdue()) {
              <div class="flex items-end justify-center gap-8 h-40">
                @for (bucket of report()!.overdue_analysis; track bucket.bucket) {
                  <div class="flex flex-col items-center gap-2">
                    <span class="text-xs font-medium text-gray-700">{{ bucket.count }}</span>
                    <div
                      class="w-16 rounded-t-lg transition-all duration-500"
                      [style.height.px]="overdueBarHeight(bucket.count)"
                      [style.background-color]="'#ef4444'"
                      [style.opacity]="0.5 + (bucket.count / maxOverdue()) * 0.5"
                    ></div>
                    <span class="text-xs text-gray-500 text-center">{{ bucket.bucket }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="flex items-center justify-center h-32 text-green-600 text-sm font-medium">
                No overdue tasks!
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class ReportsViewComponent implements OnInit {
  boardId = input.required<string>();

  private reportsService = inject(ReportsService);

  loading = signal(true);
  report = signal<BoardReport | null>(null);
  daysBack = signal(30);

  chartWidth = 400;
  chartHeight = 180;
  chartPadding = { top: 10, right: 10, bottom: 10, left: 40 };

  completionPercent = computed(() => {
    const r = this.report();
    if (!r || r.completion_rate.total === 0) return 0;
    return Math.round((r.completion_rate.completed / r.completion_rate.total) * 100);
  });

  pieSegments = computed(() => {
    const r = this.report();
    if (!r) return [];
    return createPieSegments([
      { value: r.completion_rate.completed, color: '#22c55e', label: 'Completed' },
      { value: r.completion_rate.remaining, color: '#e5e7eb', label: 'Remaining' },
    ]);
  });

  burndownYScale = computed(() => {
    const r = this.report();
    if (!r || r.burndown.length === 0) return scaleLinear([0, 1], [this.chartHeight - this.chartPadding.bottom, this.chartPadding.top]);
    const maxVal = Math.max(...r.burndown.map((p) => p.remaining), 1);
    return scaleLinear([0, maxVal], [this.chartHeight - this.chartPadding.bottom, this.chartPadding.top]);
  });

  burndownYTicks = computed(() => {
    const r = this.report();
    if (!r || r.burndown.length === 0) return [];
    const maxVal = Math.max(...r.burndown.map((p) => p.remaining), 1);
    return generateTicks(0, maxVal, 4);
  });

  burndownPoints = computed(() => {
    const r = this.report();
    if (!r || r.burndown.length === 0) return [];
    const yScale = this.burndownYScale();
    const xScale = scaleLinear(
      [0, r.burndown.length - 1],
      [this.chartPadding.left, this.chartWidth - this.chartPadding.right]
    );
    return r.burndown.map((pt, i) => ({
      x: xScale(i),
      y: yScale(pt.remaining),
    }));
  });

  burndownLine = computed(() => createPolylinePoints(this.burndownPoints()));

  burndownArea = computed(() => {
    return createAreaPath(this.burndownPoints(), this.chartHeight - this.chartPadding.bottom);
  });

  hasOverdue = computed(() => {
    const r = this.report();
    if (!r) return false;
    return r.overdue_analysis.some((b) => b.count > 0);
  });

  maxOverdue = computed(() => {
    const r = this.report();
    if (!r) return 1;
    return Math.max(...r.overdue_analysis.map((b) => b.count), 1);
  });

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.loading.set(true);
    this.reportsService.getBoardReport(this.boardId(), this.daysBack()).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onDaysChange(event: Event): void {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    this.daysBack.set(value);
    this.loadReport();
  }

  priorityBarWidth(count: number): number {
    const r = this.report();
    if (!r) return 0;
    const max = Math.max(...r.priority_distribution.map((p) => p.count), 1);
    return (count / max) * 100;
  }

  getPriorityColor(priority: string): string {
    return CHART_PRIORITY_COLORS[priority] || '#6b7280';
  }

  workloadBarWidth(value: number, total: number): number {
    if (total === 0) return 0;
    return (value / total) * 100;
  }

  overdueBarHeight(count: number): number {
    const max = this.maxOverdue();
    return Math.max((count / max) * 100, 4);
  }
}
