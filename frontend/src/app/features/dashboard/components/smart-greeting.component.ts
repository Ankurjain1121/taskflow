import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DashboardStats } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-status-line',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="text-base font-semibold" style="color: var(--foreground)">
      @if (isAllClear()) {
        <span style="color: var(--muted-foreground)">All clear</span>
      } @else {
        @if (dueToday() > 0) {
          <span>{{ dueToday() }} due today</span>
        }
        @if (overdue() > 0) {
          @if (dueToday() > 0) {
            <span style="color: var(--muted-foreground)"> &middot; </span>
          }
          <span style="color: var(--destructive)">{{ overdue() }} overdue</span>
        }
        @if (active() > 0) {
          @if (dueToday() > 0 || overdue() > 0) {
            <span style="color: var(--muted-foreground)"> &middot; </span>
          }
          <span style="color: var(--muted-foreground)">{{ active() }} active</span>
        }
      }
    </p>
  `,
})
export class StatusLineComponent {
  readonly stats = input<DashboardStats | null>(null);

  readonly overdue = computed(() => this.stats()?.overdue ?? 0);
  readonly dueToday = computed(() => this.stats()?.due_today ?? 0);
  readonly active = computed(() => this.stats()?.total_tasks ?? 0);

  readonly isAllClear = computed(
    () => this.dueToday() === 0 && this.overdue() === 0 && this.active() === 0,
  );
}
