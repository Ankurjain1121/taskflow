import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { ResourceUtilizationEntry } from '../../../core/services/reports.service';

/**
 * Resource Utilization Widget — Planned vs Actual hours per team member
 *
 * ┌──────────────────────────────────────────┐
 * │  📊 Resource Utilization                  │
 * │                                           │
 * │  Alice  ████████░░░░  8h / 12h planned   │
 * │  Bob    ██████████████  14h / 10h (over!) │
 * │  Carol  ████░░░░░░░░  4h / 10h           │
 * │                                           │
 * │  ■ Estimated  ■ Actual                    │
 * └──────────────────────────────────────────┘
 */
@Component({
  selector: 'app-resource-utilization',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5 h-full">
      <h3 class="widget-title mb-4 flex items-center gap-2">
        <i class="pi pi-chart-bar text-primary text-sm"></i>
        Resource Utilization
      </h3>

      @if (data().length === 0) {
        <div
          class="flex items-center justify-center h-48"
          style="color: var(--muted-foreground)"
        >
          <p class="text-sm">No utilization data yet</p>
        </div>
      } @else {
        <p-chart
          type="bar"
          [data]="chartData()"
          [options]="chartOptions"
          [style]="{ height: chartHeight() }"
          class="print-hide"
        />

        <!-- Print fallback table -->
        <table class="print-show w-full text-sm">
          <thead>
            <tr>
              <th class="text-left py-1">Member</th>
              <th class="text-right py-1">Planned</th>
              <th class="text-right py-1">Actual</th>
              <th class="text-right py-1">Tasks</th>
            </tr>
          </thead>
          <tbody>
            @for (row of data(); track row.user_id) {
              <tr>
                <td class="py-1">{{ row.user_name }}</td>
                <td class="text-right py-1">{{ row.total_estimated_hours | number: '1.1-1' }}h</td>
                <td class="text-right py-1">{{ row.total_actual_hours | number: '1.1-1' }}h</td>
                <td class="text-right py-1">{{ row.task_count }}</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="mt-3 flex items-center justify-center gap-4 text-xs print-hide">
          <div class="flex items-center gap-1.5">
            <div class="w-2.5 h-2.5 rounded" style="background: color-mix(in srgb, var(--primary) 60%, transparent)"></div>
            <span style="color: var(--muted-foreground)">Planned</span>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="w-2.5 h-2.5 rounded" style="background: color-mix(in srgb, var(--success) 70%, transparent)"></div>
            <span style="color: var(--muted-foreground)">Actual</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class ResourceUtilizationComponent {
  data = input<ResourceUtilizationEntry[]>([]);

  chartHeight = computed(() => {
    const count = this.data().length;
    return Math.max(200, count * 40) + 'px';
  });

  chartData = computed(() => {
    const entries = this.data();
    return {
      labels: entries.map((e) => e.user_name),
      datasets: [
        {
          label: 'Planned',
          data: entries.map((e) => e.total_estimated_hours),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.5,
        },
        {
          label: 'Actual',
          data: entries.map((e) => e.total_actual_hours),
          backgroundColor: entries.map((e) =>
            e.total_actual_hours > e.total_estimated_hours && e.total_estimated_hours > 0
              ? 'rgba(245, 158, 11, 0.7)'
              : 'rgba(16, 185, 129, 0.7)',
          ),
          borderColor: entries.map((e) =>
            e.total_actual_hours > e.total_estimated_hours && e.total_estimated_hours > 0
              ? 'rgb(245, 158, 11)'
              : 'rgb(16, 185, 129)',
          ),
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.5,
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
          label: (ctx: { dataset: { label: string }; parsed: { x: number } }) =>
            `${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)}h`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { font: { size: 11 } },
        grid: { color: 'rgba(128,128,128,0.08)' },
        title: { display: true, text: 'Hours', font: { size: 11 } },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
    },
  };
}
