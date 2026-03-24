import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { FocusTask } from '../dashboard.types';
import { PRIORITY_COLORS_HEX } from '../../../shared/utils/task-colors';

@Component({
  selector: 'app-focus-task-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="focus-task-row flex items-center gap-3 px-4 py-3"
      [class.opacity-40]="completing()"
      [class.pointer-events-none]="completing()"
      [class.ring-2]="selected()"
      [class.ring-primary]="selected()"
      [class.ring-offset-2]="selected()"
    >
      <!-- Priority dot -->
      <span
        class="w-2.5 h-2.5 rounded-full flex-shrink-0"
        [style.background]="priorityDotColor()"
      ></span>

      <!-- Title + project name -->
      <button
        class="flex-1 min-w-0 text-left cursor-pointer"
        (click)="openTask()"
      >
        <span
          class="text-sm font-semibold truncate block hover:text-primary transition-colors"
          style="color: var(--foreground)"
        >
          {{ task().title }}
        </span>
        <span class="text-xs truncate block" style="color: var(--muted-foreground)">
          {{ task().project_name }}
        </span>
      </button>

      <!-- Due date badge -->
      @if (task().due_date) {
        <span
          class="text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0"
          [style.color]="dueDateColor()"
          [style.background]="dueDateBg()"
        >
          {{ dueDateLabel() }}
        </span>
      }

      <!-- Actions -->
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button
          class="flex items-center justify-center w-7 h-7 rounded-md transition-colors btn-press"
          style="background: var(--success); color: white"
          title="Complete task"
          (click)="onComplete()"
          [disabled]="completing()"
        >
          <i class="pi pi-check text-[11px]"></i>
        </button>
        <button
          class="flex items-center justify-center w-7 h-7 rounded-md transition-colors btn-press"
          style="border: 1px solid var(--border); color: var(--muted-foreground); background: transparent"
          title="Snooze for today"
          (click)="onSnooze()"
        >
          <i class="pi pi-clock text-[11px]"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .focus-task-row {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      transition: background var(--duration-fast) var(--ease-standard);
    }
    .focus-task-row:hover {
      background: var(--muted);
    }
    @media (prefers-reduced-motion: reduce) {
      .focus-task-row {
        transition: none;
      }
    }
  `],
})
export class FocusTaskCardComponent {
  private router = inject(Router);

  readonly task = input.required<FocusTask>();
  readonly selected = input(false);

  readonly completed = output<string>();
  readonly snoozed = output<string>();

  readonly completing = signal(false);

  private completeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  onComplete(): void {
    if (this.completing() || this.completeDebounceTimer) return;
    this.completing.set(true);
    this.completeDebounceTimer = setTimeout(() => {
      this.completed.emit(this.task().id);
      this.completeDebounceTimer = null;
    }, 300);
  }

  onSnooze(): void {
    this.snoozed.emit(this.task().id);
  }

  openTask(): void {
    this.router.navigate(['/task', this.task().id]);
  }

  priorityDotColor(): string {
    const key = this.task().priority?.toLowerCase();
    const entry = PRIORITY_COLORS_HEX[key as keyof typeof PRIORITY_COLORS_HEX];
    return entry ? entry.bg : '#9ca3af';
  }

  dueDateColor(): string {
    const daysOverdue = this.task().days_overdue;
    if (daysOverdue !== null && daysOverdue > 0) return 'var(--destructive)';
    if (daysOverdue !== null && daysOverdue === 0) return 'var(--status-amber-text)';
    return 'var(--muted-foreground)';
  }

  dueDateBg(): string {
    const daysOverdue = this.task().days_overdue;
    if (daysOverdue !== null && daysOverdue > 0)
      return 'color-mix(in srgb, var(--destructive) 10%, transparent)';
    if (daysOverdue !== null && daysOverdue === 0)
      return 'color-mix(in srgb, var(--status-amber-text) 10%, transparent)';
    return 'var(--muted)';
  }

  dueDateLabel(): string {
    const daysOverdue = this.task().days_overdue;
    if (daysOverdue !== null && daysOverdue > 0) {
      return `${daysOverdue}d overdue`;
    }
    if (daysOverdue !== null && daysOverdue === 0) {
      return 'Due today';
    }
    if (!this.task().due_date) return '';
    const due = new Date(this.task().due_date!);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000);
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays <= 7) return `Due in ${diffDays}d`;
    return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
