import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { BurndownPoint } from '../../core/services/reports.service';

@Component({
  selector: 'app-burndown-chart',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5 h-full">
      <h3 class="widget-title mb-4 flex items-center gap-2">
        <i class="pi pi-chart-line text-primary text-sm"></i>
        Burndown Chart
      </h3>

      @if (data().length === 0) {
        <div
          class="flex items-center justify-center h-48"
          style="color: var(--muted-foreground)"
        >
          <p class="text-sm">No burndown data available</p>
        </div>
      } @else {
        <p-chart
          type="line"
          [data]="chartData()"
          [options]="chartOptions"
          [style]="{ height: '300px' }"
        />
        <div class="mt-3 flex items-center justify-center gap-4 text-sm">
          <div class="flex items-center gap-2">
            <div
              class="w-2.5 h-2.5 rounded"
              style="background: var(--primary)"
            ></div>
            <span style="color: var(--muted-foreground)">Total Scope</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded bg-amber-500"></div>
            <span style="color: var(--muted-foreground)">Remaining</span>
          </div>
          <span style="color: var(--muted-foreground)">&#183;</span>
          <span
            class="font-semibold font-display"
            style="color: var(--foreground)"
          >
            Remaining: {{ latestRemaining() }}
          </span>
        </div>
      }
    </div>
  `,
})
export class BurndownChartComponent {
  data = input<BurndownPoint[]>([]);

  latestRemaining = computed(() => {
    const d = this.data();
    if (d.length === 0) return 0;
    return d[d.length - 1].remaining;
  });

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
          label: 'Total Scope',
          data: points.map((p) => p.total_tasks),
          fill: false,
          borderColor: 'var(--primary)',
          backgroundColor: 'var(--primary)',
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
          pointBackgroundColor: 'var(--primary)',
          borderWidth: 2,
          borderDash: [5, 3],
        },
        {
          label: 'Remaining',
          data: points.map((p) => p.remaining),
          fill: true,
          borderColor: 'rgb(245, 158, 11)',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: 'rgb(245, 158, 11)',
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
        ticks: { font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,0.04)' },
        title: { display: true, text: 'Tasks', font: { size: 11 } },
      },
    },
  };
}
