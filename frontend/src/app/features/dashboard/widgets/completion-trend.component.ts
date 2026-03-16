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
import { firstValueFrom } from 'rxjs';
import { ChartModule } from 'primeng/chart';
import {
  DashboardService,
  CompletionTrendPoint,
} from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-completion-trend',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5 h-full">
      <div class="flex items-center justify-between mb-4">
        <h3 class="widget-title">Completion Trend</h3>

        <div
          class="flex gap-0.5 rounded-lg p-0.5"
          style="background: var(--muted)"
        >
          @for (option of dayOptions; track option) {
            <button
              (click)="setDays(option)"
              class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
              [style.background]="
                selectedDays() === option ? 'var(--card)' : 'transparent'
              "
              [style.color]="
                selectedDays() === option
                  ? 'var(--primary)'
                  : 'var(--muted-foreground)'
              "
              [style.box-shadow]="
                selectedDays() === option
                  ? '0 1px 2px rgba(0,0,0,0.05)'
                  : 'none'
              "
            >
              {{ option }}d
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="py-4">
          <div class="skeleton skeleton-chart-bar" style="height: 200px;"></div>
        </div>
      } @else if (data().length > 0) {
        <p-chart
          type="line"
          [data]="chartData()"
          [options]="chartOptions"
          [style]="{ height: '220px' }"
        />

        <div class="mt-3 flex items-center justify-center gap-4 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 bg-primary rounded"></div>
            <span style="color: var(--muted-foreground)">Tasks Completed</span>
          </div>
          <span style="color: var(--muted-foreground)">&#183;</span>
          <span
            class="font-semibold font-display"
            style="color: var(--foreground)"
          >
            Total: {{ totalCompleted() }}
          </span>
        </div>
      } @else {
        <div
          class="flex items-center justify-center h-48"
          style="color: var(--muted-foreground)"
        >
          <p class="text-sm">No completion data for this period</p>
        </div>
      }
    </div>
  `,
})
export class CompletionTrendComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private injector = inject(Injector);

  workspaceId = input<string | undefined>();

  loading = signal(true);
  data = signal<CompletionTrendPoint[]>([]);
  selectedDays = signal(30);
  totalCompleted = signal(0);

  ngOnInit(): void {
    effect(
      () => {
        this.workspaceId();
        untracked(() => this.loadData());
      },
      { injector: this.injector },
    );
  }

  dayOptions = [30, 60, 90];

  chartData = computed(() => {
    const points = this.data();
    return {
      labels: points.map((p) =>
        new Date(p.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      ),
      datasets: [
        {
          label: 'Tasks Completed',
          data: points.map((p) => p.completed),
          fill: true,
          borderColor: 'var(--primary)',
          backgroundColor: (context: {
            chart: {
              ctx: CanvasRenderingContext2D;
              chartArea: { top: number; bottom: number };
            };
          }) => {
            const ctx = context.chart?.ctx;
            const area = context.chart?.chartArea;
            if (!ctx || !area) return 'rgba(99, 102, 241, 0.08)';
            const gradient = ctx.createLinearGradient(
              0,
              area.top,
              0,
              area.bottom,
            );
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0.01)');
            return gradient;
          },
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: 'var(--primary)',
          borderWidth: 2,
        },
      ],
    };
  });

  chartOptions = {
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
        grid: { display: false },
        ticks: {
          maxTicksLimit: 7,
          font: { size: 11 },
        },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { color: 'rgba(128,128,128,0.08)' },
      },
    },
  };

  async loadData() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(
        this.dashboardService.getCompletionTrend(
          this.selectedDays(),
          this.workspaceId(),
        ),
      );
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

  private getTooltipBg(): string {
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue('--card')
        .trim() || '#1e293b'
    );
  }
}
