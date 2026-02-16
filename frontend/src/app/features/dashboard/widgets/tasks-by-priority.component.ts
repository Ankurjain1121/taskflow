import { Component, OnInit, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ChartModule } from 'primeng/chart';
import { DashboardService, TasksByPriority } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-tasks-by-priority',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 h-full">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tasks by Priority</h3>

      @if (loading()) {
        <div class="flex items-center justify-center h-64">
          <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      } @else if (data().length > 0) {
        <p-chart
          type="bar"
          [data]="chartData()"
          [options]="chartOptions"
          [style]="{height: '280px'}" />
      } @else {
        <div class="flex items-center justify-center h-64 text-gray-400">
          <p class="text-sm">No data available</p>
        </div>
      }
    </div>
  `,
})
export class TasksByPriorityComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  loading = signal(true);
  data = signal<TasksByPriority[]>([]);

  chartData = computed(() => {
    const items = this.data();
    return {
      labels: items.map(i => i.priority),
      datasets: [{
        data: items.map(i => i.count),
        backgroundColor: items.map(i => this.getPriorityColor(i.priority)),
        borderWidth: 0,
        borderRadius: 4,
        barThickness: 24,
      }],
    };
  });

  chartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { stepSize: 1 },
        grid: { display: false },
      },
      y: {
        grid: { display: false },
      },
    },
  };

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.dashboardService.getTasksByPriority());
      this.data.set(data || []);
    } catch {
      // Chart will show empty state
    } finally {
      this.loading.set(false);
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#3b82f6';
      case 'low': return '#9ca3af';
      default: return '#9ca3af';
    }
  }
}
