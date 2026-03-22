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
      class="focus-task-card p-4 flex flex-col gap-3"
      [class.opacity-40]="completing()"
      [class.pointer-events-none]="completing()"
      [class.ring-2]="selected()"
      [class.ring-primary]="selected()"
      [class.ring-offset-2]="selected()"
      [style.border-left-color]="priorityBorderColor()"
    >
      <!-- Project row -->
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="w-2.5 h-2.5 rounded-full flex-shrink-0"
          [style.background]="task().project_color || 'var(--primary)'"
        ></span>
        <span class="text-xs font-medium truncate min-w-0 flex-1" style="color: var(--muted-foreground)">
          {{ task().project_name }}
        </span>
        <span
          class="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          [class]="priorityClass()"
        >
          {{ task().priority }}
        </span>
      </div>

      <!-- Title -->
      <button
        class="text-sm font-semibold text-left truncate hover:text-primary transition-colors cursor-pointer"
        style="color: var(--foreground)"
        (click)="openTask()"
      >
        {{ task().title }}
      </button>

      <!-- Due date -->
      @if (task().due_date) {
        <div class="flex items-center gap-1.5">
          <i class="pi pi-calendar text-[11px]" [style.color]="dueDateColor()"></i>
          <span class="text-xs font-medium" [style.color]="dueDateColor()">
            {{ dueDateLabel() }}
          </span>
        </div>
      }

      <!-- Actions -->
      <div class="flex items-center gap-1.5 pt-1" style="border-top: 1px solid var(--border)">
        <button
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors btn-press"
          style="background: var(--success); color: white"
          title="Complete task"
          (click)="onComplete()"
          [disabled]="completing()"
        >
          <i class="pi pi-check text-[11px]"></i>
          Done
        </button>
        <button
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors btn-press"
          style="border: 1px solid var(--border); color: var(--muted-foreground); background: transparent"
          title="Snooze for today"
          (click)="onSnooze()"
        >
          <i class="pi pi-clock text-[11px]"></i>
          Snooze
        </button>
        <button
          class="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors btn-press"
          style="color: var(--primary)"
          title="Open task detail"
          (click)="openTask()"
        >
          <i class="pi pi-arrow-right text-[11px]"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .focus-task-card {
      background: var(--card);
      border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
      border-left: 3px solid var(--muted-foreground);
      border-radius: var(--radius);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--foreground) 6%, transparent);
      transition: box-shadow var(--duration-normal) var(--ease-standard),
                  transform var(--duration-normal) var(--ease-standard),
                  border-color var(--duration-normal) var(--ease-standard);
    }
    .focus-task-card:hover {
      box-shadow: var(--shadow-sm);
      transform: scale(1.01);
    }
    @media (prefers-reduced-motion: reduce) {
      .focus-task-card:hover {
        transform: none;
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

  priorityBorderColor(): string {
    const key = this.task().priority?.toLowerCase();
    const entry = PRIORITY_COLORS_HEX[key as keyof typeof PRIORITY_COLORS_HEX];
    return entry ? entry.bg : '#9ca3af';
  }

  priorityClass(): string {
    switch (this.task().priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'high':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-[var(--muted)] text-[var(--muted-foreground)]';
    }
  }

  dueDateColor(): string {
    const daysOverdue = this.task().days_overdue;
    if (daysOverdue !== null && daysOverdue > 0) return 'var(--destructive)';
    if (daysOverdue !== null && daysOverdue === 0) return 'var(--status-amber-text)';
    return 'var(--muted-foreground)';
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
