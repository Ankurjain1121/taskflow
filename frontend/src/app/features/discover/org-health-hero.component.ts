import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-org-health-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .stat-card {
      background: var(--secondary);
      border-radius: 0.75rem;
      padding: 1rem;
      text-align: center;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--foreground);
    }
    .stat-label {
      font-size: 0.75rem;
      color: var(--muted-foreground);
      margin-top: 0.25rem;
    }
  `,
  template: `
    <div class="rounded-xl p-6 flex flex-col md:flex-row items-center gap-6"
         style="background: var(--card); border: 1px solid var(--border)">
      <!-- Health Score -->
      <div class="flex flex-col items-center gap-2">
        <div class="text-5xl font-bold" [style.color]="color()">
          {{ score() }}
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-semibold text-white"
              [style.background]="color()">
          {{ label() }}
        </span>
      </div>

      <!-- Stat Cards -->
      <div class="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
        <div class="stat-card">
          <div class="stat-value">{{ totalProjects() }}</div>
          <div class="stat-label">Projects</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ onTimePct() }}%</div>
          <div class="stat-label">On-Time</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" [class.text-red-500]="totalOverdue() > 0">{{ totalOverdue() }}</div>
          <div class="stat-label">Overdue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ totalMembers() }}</div>
          <div class="stat-label">Team Members</div>
        </div>
      </div>
    </div>
  `,
})
export class OrgHealthHeroComponent {
  readonly score = input.required<number>();
  readonly label = input.required<string>();
  readonly color = input.required<string>();
  readonly totalProjects = input.required<number>();
  readonly onTimePct = input.required<number>();
  readonly totalOverdue = input.required<number>();
  readonly totalMembers = input.required<number>();
}
