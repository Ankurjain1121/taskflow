import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { CompletionRatePoint } from '../../core/services/reports.service';

@Component({
  selector: 'app-completion-rate-chart',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5 h-full">
      <h3 class="widget-title mb-4 flex items-center gap-2">
        <i class="pi pi-percentage text-primary text-sm"></i>
        Completion Rate
      </h3>

      @if (data().length === 0) {
        <div
          class="flex items-center justify-center h-48"
          style="color: var(--muted-foreground)"
        >
          <p class="text-sm">No completion rate data available</p>
        </div>
      } @else {
        <p-chart
          type="bar"
          [data]="chartData()"
          [options]="chartOptions"
          [style]="{ height: '300px' }"
        />
        <div class="mt-3 flex items-center justify-center gap-4 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded bg-emerald-500"></div>
            <span style="color: var(--muted-foreground)">Completed</span>
          </div>
          <div class="flex items-center gap-2">
            <div
              class="w-2.5 h-2.5 rounded"
              style="background: var(--muted)"
            ></div>
            <span style="color: var(--muted-foreground)">Total</span>
          </div>
          <span style="color: var(--muted-foreground)">&#183;</span>
          <span
            class="font-semibold font-display"
            style="color: var(--foreground)"
          >
            Latest: {{ latestRate() }}%
          </span>
        </div>
      }
    </div>
  `,
})
export class CompletionRateChartComponent {
  data = input<CompletionRatePoint[]>([]);

  latestRate = computed(() => {
    const d = this.data();
    if (d.length === 0) return 0;
    const last = d[d.length - 1];
    if (last.total === 0) return 0;
    return Math.round((last.completed / last.total) * 100);
  });

  chartData = computed(() => {
    const points = this.data();
    return {
      labels: points.map((p) =>
        new Date(p.week_start).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      ),
      datasets: [
        {
          label: 'Completed',
          data: points.map((p) => p.completed),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.7,
        },
        {
          label: 'Total',
          data: points.map((p) => p.total),
          backgroundColor: 'rgba(148, 163, 184, 0.3)',
          borderColor: 'rgba(148, 163, 184, 0.5)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.7,
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
        cornerRadius: 8,
        padding: 10,
        callbacks: {
          label: (ctx: { dataset: { label: string }; parsed: { y: number } }) =>
            `${ctx.dataset.label}: ${ctx.parsed.y} tasks`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,0.04)' },
        title: { display: true, text: 'Tasks', font: { size: 11 } },
      },
    },
  };
}
