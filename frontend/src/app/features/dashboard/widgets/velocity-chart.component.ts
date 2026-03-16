import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { VelocityPoint } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-velocity-chart',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5 h-full">
      <h3 class="widget-title mb-4 flex items-center gap-2">
        <i class="pi pi-bolt text-primary text-sm"></i>
        Velocity
      </h3>

      @if (data().length === 0) {
        <div
          class="flex items-center justify-center h-48"
          style="color: var(--muted-foreground)"
        >
          <p class="text-sm">No velocity data available</p>
        </div>
      } @else {
        <p-chart
          type="bar"
          [data]="chartData()"
          [options]="chartOptions"
          [style]="{ height: '220px' }"
        />
        <div class="mt-3 flex items-center justify-center gap-4 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 bg-primary rounded"></div>
            <span style="color: var(--muted-foreground)"
              >Tasks Completed / Week</span
            >
          </div>
          <span style="color: var(--muted-foreground)">&#183;</span>
          <span
            class="font-semibold font-display"
            style="color: var(--foreground)"
          >
            Avg: {{ avgVelocity() }}
          </span>
        </div>
      }
    </div>
  `,
})
export class VelocityChartComponent {
  data = input<VelocityPoint[]>([]);

  avgVelocity = computed(() => {
    const d = this.data();
    if (d.length === 0) return 0;
    const total = d.reduce((sum, p) => sum + p.tasks_completed, 0);
    return Math.round(total / d.length);
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
          label: 'Tasks Completed',
          data: points.map((p) => p.tasks_completed),
          backgroundColor: 'rgba(99, 102, 241, 0.7)',
          borderColor: 'var(--primary)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.6,
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
        grid: { color: 'rgba(128,128,128,0.08)' },
        title: { display: true, text: 'Tasks', font: { size: 11 } },
      },
    },
  };
}
