import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  TimeTrackingService,
  TimeEntryWithTask,
} from '../../../core/services/time-tracking.service';

/**
 * Floating timer pill — fixed bottom-left, shows when a timer is running.
 *
 * ┌─────────────────────────────────────────┐
 * │  ● 01:23:45  Task title...   [■ Stop]  │
 * └─────────────────────────────────────────┘
 *
 * Data flow:
 *   OnInit → poll GET /time-entries/running
 *         → if running, set entry signal
 *         → setInterval(1000) ticks elapsed
 *   Stop  → POST /time-entries/:id/stop
 *         → clear entry signal
 */
@Component({
  selector: 'app-timer-widget',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entry(); as e) {
      <div
        class="fixed bottom-6 left-6 z-50 flex items-center gap-3 pl-4 pr-2 py-2.5 rounded-full shadow-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:shadow-xl transition-all duration-200"
      >
        <!-- Pulsing dot -->
        <span class="relative flex h-2.5 w-2.5">
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"
          ></span>
          <span
            class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"
          ></span>
        </span>

        <!-- Elapsed time -->
        <span class="text-sm font-mono font-semibold tabular-nums">
          {{ elapsed() }}
        </span>

        <!-- Task title (clickable) -->
        <button
          (click)="navigateToTask(e)"
          class="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] truncate max-w-[160px] transition-colors"
          [title]="e.task_title"
        >
          {{ e.task_title }}
        </button>

        <!-- Stop button -->
        <button
          (click)="stopTimer()"
          [disabled]="stopping()"
          class="ml-1 flex items-center justify-center w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
          title="Stop timer"
        >
          @if (stopping()) {
            <svg
              class="w-3.5 h-3.5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          } @else {
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          }
        </button>
      </div>
    }
  `,
})
export class TimerWidgetComponent implements OnInit {
  private timeService = inject(TimeTrackingService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  entry = signal<TimeEntryWithTask | null>(null);
  stopping = signal(false);
  private tick = signal(0);
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private stopCancel$ = new Subject<void>();

  elapsed = computed(() => {
    this.tick(); // subscribe to tick updates
    const e = this.entry();
    if (!e) return '00:00:00';

    const startedAt = new Date(e.started_at).getTime();
    const now = Date.now();
    const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((n) => n.toString().padStart(2, '0'))
      .join(':');
  });

  constructor() {
    // Clean up all resources on destroy
    this.destroyRef.onDestroy(() => {
      this.stopTicking();
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }
      this.stopCancel$.next();
      this.stopCancel$.complete();
    });
  }

  ngOnInit(): void {
    this.pollRunningTimer();

    // Poll for running timer every 30 seconds
    // (catches timers started from other tabs/devices)
    this.pollInterval = setInterval(() => this.pollRunningTimer(), 30_000);
  }

  private pollRunningTimer(): void {
    this.timeService
      .getRunningTimer()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (timer) => {
          const wasRunning = !!this.entry();
          this.entry.set(timer);

          if (timer && !wasRunning) {
            this.startTicking();
          } else if (!timer && wasRunning) {
            this.stopTicking();
          }
        },
        error: (err) => {
          // Stop polling on auth errors to avoid log noise
          if (err?.status === 401 || err?.status === 403) {
            this.stopTicking();
            if (this.pollInterval) {
              clearInterval(this.pollInterval);
              this.pollInterval = null;
            }
          }
        },
      });
  }

  stopTimer(): void {
    const e = this.entry();
    if (!e || this.stopping()) return;

    this.stopping.set(true);
    this.stopCancel$.next(); // cancel any previous retry

    this.timeService
      .stopTimer(e.id)
      .pipe(takeUntil(this.stopCancel$))
      .subscribe({
        next: () => {
          this.entry.set(null);
          this.stopping.set(false);
          this.stopTicking();
        },
        error: () => {
          // Retry once after 2 seconds, verify entry ID still matches
          this.retryTimeout = setTimeout(() => {
            const current = this.entry();
            if (!current || current.id !== e.id) {
              this.stopping.set(false);
              return;
            }

            this.timeService
              .stopTimer(e.id)
              .pipe(takeUntil(this.stopCancel$))
              .subscribe({
                next: () => {
                  this.entry.set(null);
                  this.stopping.set(false);
                  this.stopTicking();
                },
                error: () => {
                  this.stopping.set(false);
                  // Timer stays visible — user can try again
                },
              });
          }, 2000);
        },
      });
  }

  navigateToTask(entry: TimeEntryWithTask): void {
    if (entry.task_id) {
      this.router.navigate(['/task', entry.task_id]);
    }
  }

  private startTicking(): void {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => {
      this.tick.update((t) => t + 1);
    }, 1000);
  }

  private stopTicking(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
