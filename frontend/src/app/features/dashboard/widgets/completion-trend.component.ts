import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, CompletionTrendPoint } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-completion-trend',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-xl border border-gray-200 p-6 h-full">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Completion Trend</h3>

        <div class="flex gap-1 bg-gray-100 rounded-lg p-1">
          @for (option of dayOptions; track option) {
            <button
              (click)="setDays(option)"
              class="px-3 py-1 text-sm font-medium rounded-md transition-colors"
              [class]="selectedDays() === option ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'">
              {{ option }}d
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center h-64">
          <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      } @else if (data().length > 0) {
        <!-- Simple visualization (fallback until Chart.js) -->
        <div class="h-64">
          <div class="flex items-end justify-between h-full gap-1">
            @for (point of getVisiblePoints(); track point.date) {
              <div class="flex-1 flex flex-col items-center">
                <div
                  class="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors cursor-pointer"
                  [style.height.%]="(point.completed / maxCompleted()) * 100"
                  [title]="point.date + ': ' + point.completed + ' tasks'">
                </div>
                @if ($index % getDateLabelInterval() === 0) {
                  <span class="text-xs text-gray-400 mt-2 rotate-45 origin-top-left">
                    {{ formatDate(point.date) }}
                  </span>
                }
              </div>
            }
          </div>
        </div>

        <div class="mt-4 flex items-center justify-center gap-4 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-indigo-500 rounded"></div>
            <span class="text-gray-600">Tasks Completed</span>
          </div>
          <span class="text-gray-400">•</span>
          <span class="font-semibold text-gray-900">
            Total: {{ totalCompleted() }}
          </span>
        </div>
      } @else {
        <div class="flex items-center justify-center h-64 text-gray-400">
          <p class="text-sm">No completion data for this period</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .rotate-45 {
      transform: rotate(-45deg);
    }
  `]
})
export class CompletionTrendComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  loading = signal(true);
  data = signal<CompletionTrendPoint[]>([]);
  selectedDays = signal(30);
  maxCompleted = signal(1);
  totalCompleted = signal(0);

  dayOptions = [30, 60, 90];

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await this.dashboardService.getCompletionTrend(this.selectedDays()).toPromise();
      this.data.set(data || []);

      const max = Math.max(...(data?.map(d => d.completed) || [0]));
      this.maxCompleted.set(max || 1);

      const total = (data || []).reduce((sum, d) => sum + d.completed, 0);
      this.totalCompleted.set(total);
    } catch (error) {
      console.error('Failed to load completion trend:', error);
    } finally {
      this.loading.set(false);
    }
  }

  setDays(days: number) {
    this.selectedDays.set(days);
    this.loadData();
  }

  getVisiblePoints(): CompletionTrendPoint[] {
    // For better visualization, show every Nth point based on range
    const points = this.data();
    if (points.length <= 30) return points;

    const step = Math.ceil(points.length / 30);
    return points.filter((_, i) => i % step === 0);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return (date.getMonth() + 1) + '/' + date.getDate();
  }

  getDateLabelInterval(): number {
    return Math.max(1, Math.floor(this.getVisiblePoints().length / 7));
  }
}
