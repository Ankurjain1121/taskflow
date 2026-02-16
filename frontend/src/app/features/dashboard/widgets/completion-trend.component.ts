import { Component, OnInit, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ChartModule } from 'primeng/chart';
import { DashboardService, CompletionTrendPoint } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-completion-trend',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 h-full">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Completion Trend</h3>

        <div class="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          @for (option of dayOptions; track option) {
            <button
              (click)="setDays(option)"
              class="px-3 py-1 text-sm font-medium rounded-md transition-colors"
              [class]="selectedDays() === option
                ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'">
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
        <p-chart
          type="line"
          [data]="chartData()"
          [options]="chartOptions"
          [style]="{height: '240px'}" />

        <div class="mt-3 flex items-center justify-center gap-4 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-indigo-500 rounded"></div>
            <span class="text-gray-600 dark:text-gray-400">Tasks Completed</span>
          </div>
          <span class="text-gray-400">&#183;</span>
          <span class="font-semibold text-gray-900 dark:text-white">
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
})
export class CompletionTrendComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  loading = signal(true);
  data = signal<CompletionTrendPoint[]>([]);
  selectedDays = signal(30);
  totalCompleted = signal(0);

  dayOptions = [30, 60, 90];

  chartData = computed(() => {
    const points = this.data();
    return {
      labels: points.map(p =>
        new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ),
      datasets: [{
        label: 'Tasks Completed',
        data: points.map(p => p.completed),
        fill: true,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 6,
        pointBackgroundColor: '#6366f1',
      }],
    };
  });

  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxTicksLimit: 7,
          font: { size: 11 },
        },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1 },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  };

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.dashboardService.getCompletionTrend(this.selectedDays()));
      this.data.set(data || []);

      const total = (data || []).reduce((sum, d) => sum + d.completed, 0);
      this.totalCompleted.set(total);
    } catch {
      // Chart will show empty state
    } finally {
      this.loading.set(false);
    }
  }

  setDays(days: number) {
    this.selectedDays.set(days);
    this.loadData();
  }
}
