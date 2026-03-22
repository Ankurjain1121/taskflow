import {
  Component,
  signal,
  inject,
  Injector,
  input,
  computed,
  effect,
  untracked,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ChartModule } from 'primeng/chart';
import {
  DashboardService,
  TasksByPriority,
} from '../../../core/services/dashboard.service';
import { PRIORITY_COLORS_HEX } from '../../../shared/utils/task-colors';

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
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="skeleton skeleton-row" style="height: 1.75rem;"></div>
          }
        </div>
      } @else if (data().length > 0) {
        <p-chart
          type="bar"
          [data]="chartData()"
          [options]="chartOptions"
          (onDataSelect)="onChartClick($event)"
          [style]="{ height: '260px' }"
        />
      } @else {
        <div
          class="flex items-center justify-center h-48"
          style="color: var(--muted-foreground)"
        >
          <p class="text-sm">No data available</p>
        </div>
      }
    </div>
  `,
})
export class TasksByPriorityComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private router = inject(Router);
  private injector = inject(Injector);

  workspaceId = input<string | undefined>();

  loading = signal(true);
  data = signal<TasksByPriority[]>([]);

  ngOnInit(): void {
    effect(
      () => {
        this.workspaceId();
        untracked(() => this.loadData());
      },
      { injector: this.injector },
    );
  }

  chartData = computed(() => {
    const items = this.data();
    return {
      labels: items.map((i) => i.priority),
      datasets: [
        {
          data: items.map((i) => i.count),
          backgroundColor: items.map((i) => this.getPriorityColor(i.priority)),
          borderWidth: 0,
          borderRadius: 6,
          barThickness: 28,
        },
      ],
    };
  });

  chartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: this.getTooltipBg(),
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
    const key = priority.toLowerCase();
    const entry = PRIORITY_COLORS_HEX[key as keyof typeof PRIORITY_COLORS_HEX];
    return entry ? entry.bg : '#9ca3af';
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(
        this.dashboardService.getTasksByPriority(this.workspaceId()),
      );
      this.data.set(data || []);
    } catch {
      // Chart will show empty state
    } finally {
      this.loading.set(false);
    }
  }

  private getTooltipBg(): string {
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue('--card')
        .trim() ||
      getComputedStyle(document.documentElement)
        .getPropertyValue('--foreground')
        .trim() ||
      '#1e293b'
    );
  }
}
