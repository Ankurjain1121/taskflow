import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { ResourceEntry } from '../../core/services/reports.service';

const OVERLOADED_THRESHOLD = 10;

@Component({
  selector: 'app-resource-utilization',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5 h-full">
      <h3 class="widget-title mb-4 flex items-center gap-2">
        <i class="pi pi-users text-primary text-sm"></i>
        Resource Utilization
      </h3>

      @if (data().length === 0) {
        <div
          class="flex items-center justify-center h-48"
          style="color: var(--muted-foreground)"
        >
          <p class="text-sm">No resource data available</p>
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
          @if (hasHoursLogged()) {
            <div class="flex items-center gap-1.5">
              <div
                class="w-2.5 h-2.5 rounded"
                style="background: var(--primary)"
              ></div>
              <span style="color: var(--muted-foreground)">Hours Logged</span>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ResourceUtilizationComponent {
  data = input<ResourceEntry[]>([]);
  readonly threshold = OVERLOADED_THRESHOLD;

  /** Aggregate entries by user, summing task_count and hours across weeks */
  aggregatedData = computed(() => {
    const map = new Map<
      string,
      { user_name: string; task_count: number; hours_logged: number }
    >();
    for (const entry of this.data()) {
      const existing = map.get(entry.user_id);
      if (existing) {
        map.set(entry.user_id, {
          ...existing,
          task_count: existing.task_count + entry.task_count,
          hours_logged: existing.hours_logged + entry.hours_logged,
        });
      } else {
        map.set(entry.user_id, {
          user_name: entry.user_name,
          task_count: entry.task_count,
          hours_logged: entry.hours_logged,
        });
      }
    }
    return Array.from(map.values());
  });

  hasHoursLogged = computed(() =>
    this.aggregatedData().some((e) => e.hours_logged > 0),
  );

  chartHeight = computed(() => {
    const count = this.aggregatedData().length;
    return Math.max(200, count * 36) + 'px';
  });

  chartData = computed(() => {
    const entries = this.aggregatedData();
    const datasets: Record<string, unknown>[] = [
      {
        label: 'Tasks',
        data: entries.map((e) => e.task_count),
        backgroundColor: entries.map((e) =>
          e.task_count > OVERLOADED_THRESHOLD
            ? 'rgba(245, 158, 11, 0.7)'
            : 'rgba(16, 185, 129, 0.7)',
        ),
        borderColor: entries.map((e) =>
          e.task_count > OVERLOADED_THRESHOLD
            ? 'rgb(245, 158, 11)'
            : 'rgb(16, 185, 129)',
        ),
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.6,
      },
    ];

    if (this.hasHoursLogged()) {
      datasets.push({
        label: 'Hours Logged',
        data: entries.map((e) => e.hours_logged),
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        borderColor: 'var(--primary)',
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.6,
      });
    }

    return {
      labels: entries.map((e) => e.user_name),
      datasets,
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
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,0.04)' },
        title: { display: true, text: 'Count', font: { size: 11 } },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
    },
  };
}
