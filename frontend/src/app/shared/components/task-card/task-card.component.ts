import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CardComponent } from '../card/card.component';
import { BadgeComponent } from '../badge/badge.component';
import { TaskCardData, TaskCardVariant } from './task-card-data';
import { SwipeableDirective } from '../../directives/swipeable.directive';

@Component({
  selector: 'app-unified-task-card',
  standalone: true,
  imports: [CardComponent, BadgeComponent, SwipeableDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      appSwipeable
      [swipeRightEnabled]="showCheckbox()"
      (swipedRight)="onSwipeComplete()"
      (swipedLeft)="onSwipeSnooze()"
    >
    <app-card
      [variant]="'nav'"
      (click)="clicked.emit(task().id)"
      [style.border-left]="stripeColor() ? '4px solid ' + stripeColor() : 'none'"
      [style.transition]="'border-color 200ms ease'"
    >
      <div [class]="wrapperClasses()">
        <!-- Project context row (non-compact) -->
        @if (variant() !== 'compact' && task().project_name) {
          <div class="flex items-center gap-2 min-w-0 mb-1.5">
            <span
              class="w-2 h-2 rounded-full flex-shrink-0"
              [style.background]="task().project_color || 'var(--primary)'"
            ></span>
            <span class="text-[11px] font-medium truncate" style="color: var(--muted-foreground)">
              {{ task().project_name }}
            </span>
            @if (task().task_number) {
              <span class="text-[10px] ml-auto flex-shrink-0" style="color: var(--muted-foreground)">
                #{{ task().task_number }}
              </span>
            }
          </div>
        }

        <!-- Title row -->
        <div class="flex items-start gap-2">
          @if (showCheckbox()) {
            <button
              class="task-complete-btn flex-shrink-0 mt-0.5"
              [class.completing]="completing()"
              (click)="onComplete($event)"
              [attr.aria-label]="'Complete ' + task().title"
            >
              @if (completing()) {
                <i class="pi pi-check complete-icon"></i>
              }
            </button>
          }
          <p
            class="text-sm font-medium flex-1 min-w-0"
            [class.truncate]="variant() === 'compact'"
            [class.line-clamp-2]="variant() !== 'compact'"
            [class.line-through]="completing()"
            [style.opacity]="completing() ? '0.5' : '1'"
            style="color: var(--card-foreground)"
          >
            {{ task().title }}
          </p>
          @if (variant() === 'compact' && task().task_number) {
            <span class="text-[10px] flex-shrink-0" style="color: var(--muted-foreground)">
              #{{ task().task_number }}
            </span>
          }
        </div>

        <!-- Meta row -->
        <div class="flex items-center gap-2 mt-2 flex-wrap">
          <app-badge [variant]="'priority'" [priority]="task().priority">
            {{ task().priority }}
          </app-badge>

          @if (task().status) {
            <span
              class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded"
              [style.background]="statusBg()"
              [style.color]="task().status_color || 'var(--muted-foreground)'"
            >
              {{ task().status }}
            </span>
          }

          @if (dueDateLabel()) {
            <span class="text-[11px] flex items-center gap-1" [style.color]="dueDateColor()">
              <i class="pi pi-calendar text-[10px]"></i>
              {{ dueDateLabel() }}
            </span>
          }

          <!-- Progress donut -->
          @if (hasChildren()) {
            <span class="ml-auto flex items-center gap-1 text-[11px]" style="color: var(--muted-foreground)">
              <svg width="16" height="16" viewBox="0 0 16 16" class="flex-shrink-0">
                <circle cx="8" cy="8" r="6" fill="none" stroke="var(--border)" stroke-width="2" />
                <circle
                  cx="8" cy="8" r="6" fill="none"
                  stroke="var(--success)"
                  stroke-width="2"
                  stroke-linecap="round"
                  [attr.stroke-dasharray]="progressDash()"
                  transform="rotate(-90 8 8)"
                />
              </svg>
              {{ task().completed_child_count }}/{{ task().child_count }}
            </span>
          }

          <!-- Assignee avatar -->
          @if (task().assignee && variant() !== 'compact') {
            <span
              class="ml-auto w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
              style="background: color-mix(in srgb, var(--primary) 15%, var(--card)); color: var(--primary)"
              [title]="task().assignee?.name || ''"
            >
              {{ assigneeInitial() }}
            </span>
          }
        </div>

        <!-- Extra actions slot -->
        <ng-content />
      </div>
    </app-card>
    </div>
  `,
  styles: [`
    :host { display: block; }
    /* Never override global CDK drag styles */

    .swipeable-content {
      position: relative;
      z-index: 1;
      background: inherit;
      will-change: transform;
    }

    .task-complete-btn {
      width: 18px; height: 18px;
      border-radius: 50%;
      border: 1.5px solid color-mix(in srgb, var(--foreground) 20%, transparent);
      background: none; cursor: pointer; padding: 0;
      display: flex; align-items: center; justify-content: center;
      position: relative;
      transition: border-color 150ms ease, background 150ms ease, transform 150ms ease;
    }
    .task-complete-btn:hover {
      border-color: color-mix(in srgb, var(--success, #10b981) 60%, transparent);
      transform: scale(1.1);
    }
    .task-complete-btn.completing {
      background: var(--success, #10b981);
      border-color: var(--success, #10b981);
      animation: cardCheck 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    .complete-icon {
      font-size: 9px; color: white;
      animation: cardCheck 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      animation-delay: 0.08s;
    }
    @keyframes cardCheck {
      0% { transform: scale(0); opacity: 0; }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .task-complete-btn.completing, .complete-icon { animation: none; }
    }
  `],
})
export class UnifiedTaskCardComponent {
  readonly task = input.required<TaskCardData>();
  readonly variant = input<TaskCardVariant>('kanban');
  readonly stripeColor = input<string | null>(null);

  readonly showCheckbox = input(false);

  readonly clicked = output<string>();
  readonly completed = output<string>();
  readonly snoozed = output<string>();
  readonly priorityChanged = output<{ taskId: string; priority: string }>();

  readonly completing = signal(false);

  onComplete(event: MouseEvent): void {
    event.stopPropagation();
    this.completing.set(true);
    this.completed.emit(this.task().id);
  }

  onSwipeComplete(): void {
    this.completing.set(true);
    this.completed.emit(this.task().id);
  }

  onSwipeSnooze(): void {
    this.snoozed.emit(this.task().id);
  }

  readonly wrapperClasses = computed(() => {
    const v = this.variant();
    switch (v) {
      case 'compact':
        return 'px-3 py-2';
      case 'timeline':
        return 'px-4 py-3';
      default:
        return 'p-4';
    }
  });

  readonly hasChildren = computed(() => {
    const t = this.task();
    return (t.child_count ?? 0) > 0;
  });

  readonly progressDash = computed(() => {
    const t = this.task();
    const total = t.child_count ?? 0;
    const done = t.completed_child_count ?? 0;
    if (total === 0) return '0 37.7';
    const circumference = 2 * Math.PI * 6; // ~37.7
    const filled = (done / total) * circumference;
    return `${filled.toFixed(1)} ${circumference.toFixed(1)}`;
  });

  readonly statusBg = computed(() => {
    const color = this.task().status_color;
    if (!color) return 'var(--muted)';
    return `color-mix(in srgb, ${color} 12%, transparent)`;
  });

  readonly assigneeInitial = computed(() => {
    const name = this.task().assignee?.name;
    return name ? name.charAt(0).toUpperCase() : '?';
  });

  readonly dueDateLabel = computed(() => {
    const due = this.task().due_date;
    if (!due) return '';
    const dueDate = new Date(due);
    const now = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `In ${diffDays}d`;
    return dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  });

  readonly dueDateColor = computed(() => {
    const due = this.task().due_date;
    if (!due) return 'var(--muted-foreground)';
    const dueDate = new Date(due);
    const now = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) return 'var(--destructive)';
    if (diffDays === 0) return 'var(--status-amber-text)';
    return 'var(--muted-foreground)';
  });
}
