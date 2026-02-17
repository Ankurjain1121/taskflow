import { Component, OnInit, signal, inject, input, effect, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ChartModule } from 'primeng/chart';
import { DashboardService, TasksByPriority } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-tasks-by-priority',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5 h-full">
      <h3 class="widget-title mb-4">Tasks by Priority</h3>

      @if (loading()) {
        <div class="px-2 space-y-3 py-4">
          @for (i of [1,2,3,4]; track i) {
            <div class="skeleton skeleton-row" style="height: 1.75rem;"></div>
          }
        </div>
      } @else if (data().length > 0) {
        <p-chart
          type="bar"
          [data]="chartData()"
          [options]="chartOptions"
          (onDataSelect)="onChartClick($event)"
          [style]="{height: '260px'}" />
      } @else {
        <div class="flex items-center justify-center h-48" style="color: var(--muted-foreground)">
          <p class="text-sm">No data available</p>
        </div>
      }
    </div>
  `,
})
export class TasksByPriorityComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private router = inject(Router);

  workspaceId = input<string | undefined>();

  loading = signal(true);
  data = signal<TasksByPriority[]>([]);

  constructor() {
    effect(() => {
      const _wsId = this.workspaceId();
      this.loadData();
    });
  }

  chartData = computed(() => {
    const items = this.data();
    return {
      labels: items.map(i => i.priority),
      datasets: [{
        data: items.map(i => i.count),
        backgroundColor: items.map(i => this.getPriorityColor(i.priority)),
        borderWidth: 0,
        borderRadius: 6,
        barThickness: 28,
      }],
    };
  });

  chartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { family: 'Inter', size: 12 },
        bodyFont: { family: 'Inter', size: 12 },
        cornerRadius: 8,
        padding: 10,
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { display: false },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 12, weight: '500' as const } },
      },
    },
  };

  ngOnInit() {
    this.loadData();
  }

  onChartClick(event: { element: { index: number } }): void {
    const items = this.data();
    const idx = event?.element?.index;
    if (idx != null && items[idx]) {
      this.router.navigate(['/my-tasks'], {
        queryParams: { priority: items[idx].priority },
      });
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

  async loadData() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(
        this.dashboardService.getTasksByPriority(this.workspaceId())
      );
      this.data.set(data || []);
    } catch {
      // Chart will show empty state
    } finally {
      this.loading.set(false);
    }
  }
}
