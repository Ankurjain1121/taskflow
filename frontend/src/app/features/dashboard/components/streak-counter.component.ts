import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { StreakData } from '../dashboard.types';

@Component({
  selector: 'app-streak-counter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl transition-colors"
      [style.background]="hasStreak() ? 'color-mix(in srgb, var(--accent-warm) 12%, transparent)' : 'var(--muted)'"
      [style.opacity]="hasStreak() ? '1' : '0.7'"
    >
      @if (hasStreak()) {
        <span class="streak-flame" role="img" aria-label="Fire streak"
          [class.text-lg]="currentStreak() <= 7"
          [class.text-xl]="currentStreak() > 7"
        >
          <svg
            [attr.width]="currentStreak() > 7 ? 26 : 20"
            [attr.height]="currentStreak() > 7 ? 26 : 20"
            viewBox="0 0 24 24"
            fill="none"
            class="inline-block"
          >
            <path
              d="M12 2C9.5 7 4 9 4 14a8 8 0 0016 0c0-5-5.5-7-8-12z"
              fill="#f59e0b"
              opacity="0.85"
            />
            <path
              d="M12 9c-1.5 3-4 4-4 7a4 4 0 008 0c0-3-2.5-4-4-7z"
              fill="#f97316"
              opacity="0.6"
            />
          </svg>
        </span>
        <span
          class="tabular-nums"
          style="color: var(--accent-warm)"
          [class.text-sm]="currentStreak() <= 7"
          [class.text-base]="currentStreak() > 7"
          [class.font-bold]="true"
        >
          @if (isHotStreak()) {
            <span class="mr-0.5">&#x1F525;</span>
          }
          {{ currentStreak() }}-day streak
        </span>
      } @else {
        <i class="pi pi-bolt text-xs" style="color: var(--muted-foreground)"></i>
        <span class="text-xs font-medium" style="color: var(--muted-foreground)">
          Start your streak!
        </span>
      }

      @if (completedToday() > 0) {
        <span
          class="text-xs px-2 py-0.5 rounded-md font-medium"
          style="background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--success)"
        >
          {{ completedToday() }} done today
        </span>
      }
    </div>
  `,
  styles: [`
    @media (prefers-reduced-motion: no-preference) {
      .streak-flame {
        animation: flameWiggle 2s ease-in-out infinite;
      }
    }
    @keyframes flameWiggle {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-3deg); }
      75% { transform: rotate(3deg); }
    }
  `],
})
export class StreakCounterComponent {
  readonly streak = input<StreakData | null>(null);

  readonly currentStreak = computed(() => this.streak()?.current_streak ?? 0);
  readonly completedToday = computed(() => this.streak()?.completed_today ?? 0);
  readonly hasStreak = computed(() => this.currentStreak() > 0);
  readonly isHotStreak = computed(() => this.currentStreak() > 7);
}
