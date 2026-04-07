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
        {{ greetingPrefix() }}@if (userName()) {, <em class="truncate inline-block max-w-[200px] align-bottom" style="color: var(--primary)">{{ userName() }}</em>}@if (isQuestion()) {?}
      </h1>
      <p class="text-sm mt-1" style="color: var(--muted-foreground)">
        @if (overdue() > 0) {
          {{ warmIntro() }} You have
          <span class="font-semibold" style="color: var(--destructive)">{{ overdue() }}</span>
          overdue {{ overdue() === 1 ? 'task' : 'tasks' }} that
          {{ overdue() === 1 ? 'needs' : 'need' }} attention.
        } @else if (dueToday() > 0) {
          {{ warmIntro() }} You have {{ totalTasks() }} {{ totalTasks() === 1 ? 'task' : 'tasks' }} on your drafting table, {{ dueToday() }} due today.
        } @else if (totalTasks() > 0) {
          {{ warmIntro() }} You have a productive day ahead with {{ totalTasks() }} {{ totalTasks() === 1 ? 'task' : 'tasks' }} on your drafting table.
        } @else {
          {{ warmIntro() }} Your drafting table is clear &mdash; time to plan something new.
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
  readonly totalTasks = computed(() => this.stats()?.total_tasks ?? 0);

  readonly greetingPrefix = computed(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Burning the midnight oil';
  });

  readonly isQuestion = computed(() => {
    const hour = new Date().getHours();
    return hour < 5 || hour >= 21;
  });

  readonly warmIntro = computed(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'The workshop is quiet and ready.';
    if (hour >= 12 && hour < 17) return 'The afternoon light fills the studio.';
    if (hour >= 17 && hour < 21) return 'The evening settles in nicely.';
    return 'The midnight workshop hums softly.';
  });
}
