import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { ProjectPulse } from '../dashboard.types';

@Component({
  selector: 'app-project-pulse-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="pulse-card p-4 w-full text-left cursor-pointer group"
      (click)="navigateToProject()"
    >
      <!-- Header row -->
      <div class="flex items-center gap-2 mb-2">
        <span
          class="w-3 h-3 rounded-full flex-shrink-0"
          [style.background]="project().project_color || 'var(--primary)'"
        ></span>
        <span
          class="text-sm font-semibold truncate group-hover:text-primary transition-colors"
          style="color: var(--foreground)"
        >
          {{ project().project_name }}
        </span>
        <span
          class="ml-auto w-2.5 h-2.5 rounded-full flex-shrink-0"
          [style.background]="healthColor()"
          [title]="'Health: ' + project().health"
        ></span>
      </div>

      <!-- Stats row -->
      <p class="text-xs mb-3" style="color: var(--muted-foreground)">
        <span class="font-semibold" style="color: var(--foreground)">{{ project().active_tasks }}</span> active
        <span class="mx-1">&middot;</span>
        @if (project().overdue_tasks > 0) {
          <span class="font-semibold text-red-500">{{ project().overdue_tasks }}</span> overdue
          <span class="mx-1">&middot;</span>
        }
        <span class="font-semibold" style="color: var(--success)">{{ project().completed_this_week }}</span> completed
      </p>

      <!-- Sparkline -->
      @if (sparklinePath()) {
        <div class="mt-auto">
          <svg
            viewBox="0 0 120 28"
            class="w-full overflow-visible"
            style="height: 28px"
            aria-hidden="true"
          >
            <polyline
              [attr.points]="sparklinePath()"
              fill="none"
              [attr.stroke]="project().project_color || 'var(--primary)'"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      }
    </button>
  `,
  styles: [`
    .pulse-card {
      background: var(--card);
      border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
      border-radius: var(--radius);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--foreground) 6%, transparent);
      display: flex;
      flex-direction: column;
      min-height: 120px;
      transition: box-shadow var(--duration-normal) var(--ease-standard),
                  transform var(--duration-normal) var(--ease-standard),
                  border-color var(--duration-normal) var(--ease-standard);
    }
    .pulse-card:hover {
      border-color: var(--widget-hover-border);
      box-shadow: var(--shadow-sm);
      transform: scale(1.01);
    }
    @media (prefers-reduced-motion: reduce) {
      .pulse-card:hover {
        transform: none;
      }
    }
  `],
})
export class ProjectPulseCardComponent {
  private router = inject(Router);

  readonly project = input.required<ProjectPulse>();

  readonly healthColor = computed(() => {
    switch (this.project().health) {
      case 'green':
        return 'var(--success)';
      case 'amber':
        return 'var(--status-amber-text)';
      case 'red':
        return 'var(--destructive)';
    }
  });

  readonly sparklinePath = computed(() => {
    const data = this.project().sparkline;
    if (!data || data.length < 2) return '';
    const max = Math.max(...data, 1);
    const step = 120 / (data.length - 1);
    return data
      .map((v, i) => `${(i * step).toFixed(1)},${(26 - (v / max) * 24).toFixed(1)}`)
      .join(' ');
  });

  navigateToProject(): void {
    this.router.navigate(['/project', this.project().project_id, 'board']);
  }
}
