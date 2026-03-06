import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MyTask } from '../../../core/services/my-tasks.service';
import {
  getPriorityColor,
  getPriorityLabel,
  getDueDateColor,
  isOverdue,
  isToday,
} from '../../../shared/utils/task-colors';

@Component({
  selector: 'app-task-list-item',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <a
      [routerLink]="['/task', task().id]"
      class="block widget-card rounded-lg hover:shadow-md transition-all cursor-pointer"
      [style.border-left]="'4px solid ' + getBorderColor()"
    >
      <div class="p-4">
        <div class="flex items-start justify-between gap-4">
          <!-- Left: Title and metadata -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <!-- Status Badge -->
              @if (isDone()) {
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  style="background: var(--status-green-bg); color: var(--status-green-text)"
                >
                  Done
                </span>
              }
              <!-- Priority Badge -->
              <span
                [class]="
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ' +
                  priorityColors.bg +
                  ' ' +
                  priorityColors.text
                "
              >
                {{ priorityLabel }}
              </span>
            </div>

            <h3
              class="text-sm font-medium truncate"
              style="color: var(--foreground)"
            >
              {{ task().title }}
            </h3>

            <!-- Board and Column Info -->
            <p class="text-xs mt-1" style="color: var(--muted-foreground)">
              {{ task().board_name }} / {{ task().column_name }}
            </p>

            <!-- Labels -->
            @if (task().labels && task().labels.length > 0) {
              <div class="flex flex-wrap gap-1 mt-2">
                @for (label of task().labels.slice(0, 3); track label.id) {
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    [style.background-color]="label.color + '20'"
                    [style.color]="label.color"
                  >
                    {{ label.name }}
                  </span>
                }
                @if (task().labels.length > 3) {
                  <span class="text-xs" style="color: var(--muted-foreground)">
                    +{{ task().labels.length - 3 }}
                  </span>
                }
              </div>
            }
          </div>

          <!-- Right: Due date and workspace -->
          <div class="flex flex-col items-end gap-2 text-right shrink-0">
            <!-- Due Date -->
            @if (task().due_date) {
              <span
                [class]="
                  'flex items-center gap-1 text-xs font-medium ' +
                  dueDateColorClass
                "
              >
                <svg
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {{ formatDueDate(task().due_date) }}
              </span>
            }

            <!-- Workspace -->
            <span class="text-xs" style="color: var(--muted-foreground)">
              {{ task().workspace_name }}
            </span>
          </div>
        </div>
      </div>
    </a>
  `,
})
export class TaskListItemComponent {
  task = input.required<MyTask>();

  get priorityColors() {
    return getPriorityColor(this.task().priority);
  }

  get priorityLabel(): string {
    return getPriorityLabel(this.task().priority);
  }

  get dueDateColorClass(): string {
    const result = getDueDateColor(this.task().due_date);
    return [result.class, result.chipClass].filter(Boolean).join(' ');
  }

  getBorderColor(): string {
    const colors: Record<string, string> = {
      urgent: '#ef4444',
      high: '#f97316',
      medium: '#eab308',
      low: '#3b82f6',
    };
    return colors[this.task().priority] || '#9ca3af';
  }

  isDone(): boolean {
    const statusMapping = this.task().column_status_mapping;
    return statusMapping?.done === true;
  }

  formatDueDate(date: string | null): string {
    if (!date) return '';

    const dueDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (isToday(date)) {
      return 'Today';
    }

    if (
      dueDate.getDate() === tomorrow.getDate() &&
      dueDate.getMonth() === tomorrow.getMonth() &&
      dueDate.getFullYear() === tomorrow.getFullYear()
    ) {
      return 'Tomorrow';
    }

    if (isOverdue(date)) {
      return 'Overdue';
    }

    return dueDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}
