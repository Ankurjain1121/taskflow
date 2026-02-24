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
  TasksByStatus,
} from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-tasks-by-status',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5 h-full">
      <h3 class="widget-title mb-4">Tasks by Status</h3>

      @if (loading()) {
        <div class="flex items-center justify-center py-8">
          <div
            class="skeleton skeleton-chart-donut"
            style="width: 180px; height: 180px;"
          ></div>
        </div>
        <div class="mt-4 space-y-2 px-4">
          @for (i of [1, 2, 3]; track i) {
            <div class="skeleton skeleton-row" style="height: 1.25rem;"></div>
          }
        </div>
      } @else if (data().length > 0) {
        <p-chart
          type="doughnut"
          [data]="chartData()"
          [options]="chartOptions"
          (onDataSelect)="onChartClick($event)"
          [style]="{ height: '200px' }"
        />

        <!-- Legend -->
        <div class="mt-4 space-y-1.5">
          @for (item of data(); track item.status) {
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-2">
                <div
                  class="w-2.5 h-2.5 rounded-full"
                  [style.background-color]="item.color || '#6366f1'"
                ></div>
                <span style="color: var(--muted-foreground)">{{
                  item.status
                }}</span>
              </div>
              <span
                class="font-medium font-display"
                style="color: var(--foreground)"
                >{{ item.count }}</span
              >
            </div>
          }
        </div>
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
export class TasksByStatusComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private router = inject(Router);
  private injector = inject(Injector);

  workspaceId = input<string | undefined>();

  loading = signal(true);
  data = signal<TasksByStatus[]>([]);

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
      labels: items.map((i) => i.status),
      datasets: [
        {
          data: items.map((i) => i.count),
          backgroundColor: items.map((i) => i.color || '#6366f1'),
          borderWidth: 0,
          hoverOffset: 6,
          borderRadius: 4,
          spacing: 2,
        },
      ],
    };
  });

  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
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
  };

  onChartClick(event: { element: { index: number } }): void {
    const items = this.data();
    const idx = event?.element?.index;
    if (idx != null && items[idx]) {
      this.router.navigate(['/my-tasks'], {
        queryParams: { status: items[idx].status },
      });
    }
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(
        this.dashboardService.getTasksByStatus(this.workspaceId()),
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
        .trim() || '#1e293b'
    );
  }
}
