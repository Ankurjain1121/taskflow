import { Component, input, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SummaryStats {
  totalTasks: number;
  completedThisWeek: number;
  completedLastWeek: number;
  overdueTasks: number;
  overdueLastWeek: number;
  completionRate: number;
  completionRateLastWeek: number;
}

@Component({
  selector: 'app-summary-numbers',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      @for (card of cards(); track card.label) {
        <div class="widget-card p-5 relative overflow-hidden">
          <!-- Background accent -->
          <div class="absolute top-0 right-0 w-20 h-20 -mr-4 -mt-4 rounded-full opacity-[0.07]"
               [style.background]="card.color"></div>

          <!-- Icon -->
          <div class="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
               [style.background]="card.color + '15'"
               [style.color]="card.color">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="card.iconPath"/>
            </svg>
          </div>

          <!-- Number -->
          <div class="text-2xl lg:text-3xl font-bold tracking-tight animate-count-up"
               style="color: var(--foreground)">
            @if (card.isPercentage) {
              {{ card.value | number:'1.0-0' }}%
            } @else {
              {{ card.value | number }}
            }
          </div>

          <!-- Label -->
          <div class="text-xs font-medium mt-1 uppercase tracking-wide"
               style="color: var(--muted-foreground)">
            {{ card.label }}
          </div>

          <!-- Trend -->
          @if (card.trend !== 0) {
            <div class="flex items-center gap-1 mt-2 text-xs font-medium"
                 [class]="card.trend > 0 ? (card.trendPositive ? 'text-emerald-600' : 'text-red-500') : (card.trendPositive ? 'text-red-500' : 'text-emerald-600')">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"
                   [class.rotate-180]="card.trend < 0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/>
              </svg>
              {{ card.trend > 0 ? '+' : '' }}{{ card.trend | number:'1.0-0' }}% vs last week
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class SummaryNumbersComponent {
  stats = input.required<SummaryStats>();

  cards = computed(() => {
    const s = this.stats();
    return [
      {
        label: 'Total Tasks',
        value: s.totalTasks,
        isPercentage: false,
        color: '#6366f1',
        iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
        trend: 0,
        trendPositive: true,
      },
      {
        label: 'Completed This Week',
        value: s.completedThisWeek,
        isPercentage: false,
        color: '#22c55e',
        iconPath: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        trend: s.completedLastWeek > 0
          ? ((s.completedThisWeek - s.completedLastWeek) / s.completedLastWeek) * 100
          : 0,
        trendPositive: true,
      },
      {
        label: 'Overdue',
        value: s.overdueTasks,
        isPercentage: false,
        color: '#ef4444',
        iconPath: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
        trend: s.overdueLastWeek > 0
          ? ((s.overdueTasks - s.overdueLastWeek) / s.overdueLastWeek) * 100
          : 0,
        trendPositive: false,
      },
      {
        label: 'Completion Rate',
        value: s.completionRate,
        isPercentage: true,
        color: '#8b5cf6',
        iconPath: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5',
        trend: s.completionRateLastWeek > 0
          ? s.completionRate - s.completionRateLastWeek
          : 0,
        trendPositive: true,
      },
    ];
  });
}
