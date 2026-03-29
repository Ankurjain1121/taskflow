import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

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
        <div class="stat-card" [attr.title]="onTimeTooltip()">
          @if (totalCompleted() > 0) {
            <div class="stat-value">{{ onTimePct() }}%</div>
          } @else {
            <div class="stat-value" style="color: var(--muted-foreground)">&mdash;</div>
          }
          <div class="stat-label">
            On-Time
            @if (totalCompleted() > 0) {
              <span class="text-[10px] opacity-60">({{ totalCompleted() }})</span>
            }
          </div>
          @if (onTimePrevious(); as prev) {
            <div class="text-[10px] mt-0.5"
                 [style.color]="onTimePct() >= prev.pct ? '#5E8C4A' : '#B81414'">
              {{ onTimePct() >= prev.pct ? '\u2191' : '\u2193' }}
              {{ absDiff(onTimePct(), prev.pct) }}% vs {{ prev.label }}
            </div>
          }
        </div>
        <div class="stat-card">
          <div class="stat-value" [class.text-[var(--destructive)]]="totalOverdue() > 0">{{ totalOverdue() }}</div>
          <div class="stat-label">Overdue</div>
          @if (totalOverdue() > 0) {
            <div class="text-[10px] mt-0.5" style="color: var(--muted-foreground)">
              @if (overdueAging().critical > 0) {
                <span class="text-[var(--destructive)]">{{ overdueAging().critical }} critical</span>
                @if (overdueAging().recent > 0) { · }
              }
              @if (overdueAging().recent > 0) {
                {{ overdueAging().recent }} recent
              }
            </div>
          }
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
  readonly totalCompleted = input<number>(0);
  readonly onTimePrevious = input<{ pct: number; label: string } | null>(null);
  readonly overdueAging = input<{ critical: number; recent: number }>({ critical: 0, recent: 0 });
  readonly onTimeCount = input<number>(0);

  readonly onTimeTooltip = computed(() => {
    const total = this.totalCompleted();
    if (total === 0) return 'No tasks with due dates completed in this period';
    const onTime = this.onTimeCount();
    const late = total - onTime;
    return `On time: ${onTime} | Late: ${late} | Total: ${total}`;
  });

  absDiff(a: number, b: number): number {
    return Math.abs(a - b);
  }
}
