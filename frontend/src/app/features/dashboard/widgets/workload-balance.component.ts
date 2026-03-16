import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { WorkloadBalanceEntry } from '../../../core/services/dashboard.service';

const OVERLOADED_THRESHOLD = 10;

@Component({
  selector: 'app-workload-balance',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5 h-full">
      <h3 class="widget-title mb-4 flex items-center gap-2">
        <i class="pi pi-users text-primary text-sm"></i>
        Workload Balance
      </h3>

      @if (data().length === 0) {
        <div
          class="flex items-center justify-center h-48"
          style="color: var(--muted-foreground)"
        >
          <p class="text-sm">No workload data available</p>
        </div>
      } @else {
        <p-chart
          type="bar"
          [data]="chartData()"
          [options]="chartOptions"
          [style]="{ height: chartHeight() }"
        />
        <div class="mt-3 flex items-center justify-center gap-4 text-xs">
          <div class="flex items-center gap-1.5">
            <div class="w-2.5 h-2.5 bg-emerald-500 rounded"></div>
            <span style="color: var(--muted-foreground)">Normal</span>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="w-2.5 h-2.5 bg-amber-500 rounded"></div>
            <span style="color: var(--muted-foreground)"
              >Overloaded (>{{ threshold }} tasks)</span
            >
          </div>
        </div>
      }
    </div>
  `,
})
export class WorkloadBalanceComponent {
  data = input<WorkloadBalanceEntry[]>([]);
  readonly threshold = OVERLOADED_THRESHOLD;

  chartHeight = computed(() => {
    const count = this.data().length;
    return Math.max(200, count * 32) + 'px';
  });

  chartData = computed(() => {
    const entries = this.data();
    return {
      labels: entries.map((e) => e.user_name),
      datasets: [
        {
          label: 'Active Tasks',
          data: entries.map((e) => e.active_tasks),
          backgroundColor: entries.map((e) =>
            e.active_tasks > OVERLOADED_THRESHOLD
              ? 'rgba(245, 158, 11, 0.7)'
              : 'rgba(16, 185, 129, 0.7)',
          ),
          borderColor: entries.map((e) =>
            e.active_tasks > OVERLOADED_THRESHOLD
              ? 'rgb(245, 158, 11)'
              : 'rgb(16, 185, 129)',
          ),
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.6,
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
        cornerRadius: 8,
        padding: 10,
        callbacks: {
          label: (ctx: { parsed: { x: number } }) =>
            `${ctx.parsed.x} active tasks`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { color: 'rgba(128,128,128,0.08)' },
        title: { display: true, text: 'Tasks', font: { size: 11 } },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
    },
  };
}
