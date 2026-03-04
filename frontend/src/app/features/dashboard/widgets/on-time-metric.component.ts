import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnTimeMetric } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-on-time-metric',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5 h-full flex flex-col">
      <h3 class="widget-title mb-4 flex items-center gap-2">
        <i class="pi pi-check-circle text-primary text-sm"></i>
        On-Time Delivery
      </h3>

      @if (!data()) {
        <div
          class="flex-1 flex items-center justify-center"
          style="color: var(--muted-foreground)"
        >
          <p class="text-sm">No data available</p>
        </div>
      } @else {
        <div class="flex-1 flex flex-col items-center justify-center">
          <!-- Gauge ring -->
          <div class="relative w-40 h-40">
            <svg viewBox="0 0 120 120" class="w-full h-full -rotate-90">
              <!-- Background ring -->
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="var(--muted)"
                stroke-width="10"
              />
              <!-- Value ring -->
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                [attr.stroke]="gaugeColor()"
                stroke-width="10"
                stroke-linecap="round"
                [attr.stroke-dasharray]="dashArray()"
                [attr.stroke-dashoffset]="dashOffset()"
                style="transition: stroke-dashoffset 0.8s ease"
              />
            </svg>
            <!-- Percentage text in center -->
            <div
              class="absolute inset-0 flex flex-col items-center justify-center"
            >
              <span
                class="text-3xl font-bold font-display"
                [style.color]="gaugeColor()"
              >
                {{ percentage() }}%
              </span>
              <span
                class="text-xs mt-0.5"
                style="color: var(--muted-foreground)"
              >
                on time
              </span>
            </div>
          </div>

          <!-- Details -->
          <div
            class="mt-4 text-center text-sm"
            style="color: var(--muted-foreground)"
          >
            {{ data()!.on_time_count }} of {{ data()!.total_completed }} tasks
            delivered on time
          </div>
        </div>
      }
    </div>
  `,
})
export class OnTimeMetricComponent {
  data = input<OnTimeMetric | null>(null);

  private readonly circumference = 2 * Math.PI * 50; // r=50

  percentage = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return Math.round(d.on_time_pct);
  });

  gaugeColor = computed(() => {
    const pct = this.percentage();
    if (pct >= 90) return 'rgb(16, 185, 129)'; // green
    if (pct >= 80) return 'rgb(245, 158, 11)'; // amber
    return 'rgb(239, 68, 68)'; // red
  });

  dashArray = computed(() => `${this.circumference} ${this.circumference}`);

  dashOffset = computed(() => {
    const pct = this.percentage();
    return this.circumference - (pct / 100) * this.circumference;
  });
}
