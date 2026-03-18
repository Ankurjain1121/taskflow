import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DashboardStats } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-smart-greeting',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="animate-fade-in-up">
      <h1
        class="text-2xl font-bold tracking-tight font-display"
        style="color: var(--foreground)"
      >
        {{ greeting() }}
      </h1>
      <p class="text-sm mt-1" style="color: var(--muted-foreground)">
        @if (overdue() > 0) {
          You have
          <span class="font-semibold text-red-500">{{ overdue() }}</span>
          overdue {{ overdue() === 1 ? 'task' : 'tasks' }} that
          {{ overdue() === 1 ? 'needs' : 'need' }} attention
        } @else if (dueToday() > 0) {
          You have {{ dueToday() }}
          {{ dueToday() === 1 ? 'task' : 'tasks' }} due today &mdash;
          let's knock them out
        } @else {
          All clear &mdash; you're on top of things!
        }
      </p>
    </div>
  `,
})
export class SmartGreetingComponent {
  readonly stats = input<DashboardStats | null>(null);
  readonly userName = input<string | null>(null);

  readonly overdue = computed(() => this.stats()?.overdue ?? 0);
  readonly dueToday = computed(() => this.stats()?.due_today ?? 0);

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const name = this.userName();
    const suffix = name ? `, ${name}` : '';

    if (hour >= 5 && hour < 12) return `Good morning${suffix}`;
    if (hour >= 12 && hour < 17) return `Good afternoon${suffix}`;
    if (hour >= 17 && hour < 21) return `Good evening${suffix}`;
    return `Burning the midnight oil${suffix}?`;
  });
}
