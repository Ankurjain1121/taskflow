import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { CycleTimePoint } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-cycle-time-chart',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5 h-full">
      <h3 class="widget-title mb-4 flex items-center gap-2">
        <i class="pi pi-stopwatch text-primary text-sm"></i>
        Cycle Time
      </h3>

      @if (data().length === 0) {
        <div
          class="flex items-center justify-center h-48"
          style="color: var(--muted-foreground)"
        >
          <p class="text-sm">No cycle time data available</p>
        </div>
      } @else {
        <p-chart
          type="line"
          [data]="chartData()"
          [options]="chartOptions"
          [style]="{ height: '220px' }"
        />
        <div class="mt-3 flex items-center justify-center gap-4 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 bg-primary rounded"></div>
            <span style="color: var(--muted-foreground)">Avg Days</span>
          </div>
          <span style="color: var(--muted-foreground)">&#183;</span>
          <span
            class="font-semibold font-display"
            style="color: var(--foreground)"
          >
            Latest: {{ latestValue() }}d
          </span>
        </div>
      }
    </div>
  `,
})
export class CycleTimeChartComponent {
  data = input<CycleTimePoint[]>([]);

  latestValue = computed(() => {
    const d = this.data();
    if (d.length === 0) return 0;
    return d[d.length - 1].avg_cycle_days.toFixed(1);
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
          label: 'Avg Cycle Days',
          data: points.map((p) => p.avg_cycle_days),
          fill: true,
          borderColor: 'var(--primary)',
          backgroundColor: 'rgba(99, 102, 241, 0.08)',
          tension: 0.4,
          pointRadius: 3,
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
        cornerRadius: 8,
        padding: 10,
        callbacks: {
          label: (ctx: { parsed: { y: number } }) =>
            `${ctx.parsed.y.toFixed(1)} days`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 6, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        ticks: { font: { size: 11 } },
        grid: { color: 'rgba(128,128,128,0.08)' },
        title: { display: true, text: 'Days', font: { size: 11 } },
      },
    },
  };
}
