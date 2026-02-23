import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EisenhowerTask } from '../../../core/services/eisenhower.service';

@Component({
  selector: 'app-eisenhower-task-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="group relative bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 hover:shadow-sm transition-shadow">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <h3
              class="text-sm font-medium text-[var(--card-foreground)] truncate cursor-pointer hover:underline"
              [routerLink]="['/task', task().id]"
            >
              {{ task().title }}
            </h3>
            @if (task().eisenhower_urgency !== null || task().eisenhower_importance !== null) {
              <span
                class="shrink-0 w-2 h-2 rounded-full bg-blue-500"
                title="Manual override active"
              ></span>
            }
          </div>
          <div class="flex items-center gap-2 mt-1">
            <a
              [routerLink]="['/board', task().board_id]"
              class="text-xs text-[var(--muted-foreground)] hover:text-primary hover:underline"
              (click)="$event.stopPropagation()"
            >
              {{ task().board_name }}
            </a>
            @if (task().due_date) {
              <span class="text-xs text-[var(--muted-foreground)]">&bull;</span>
              <span
                class="text-xs"
                [class]="
                  isOverdue(task().due_date!)
                    ? 'text-red-600 dark:text-red-400 font-medium'
                    : 'text-[var(--muted-foreground)]'
                "
              >
                Due {{ formatDueDate(task().due_date!) }}
              </span>
            }
          </div>
        </div>

        <!-- Priority badge (clickable dropdown) -->
        <div class="relative ml-2">
          <button
            (click)="togglePriorityDropdown(); $event.stopPropagation()"
            class="px-2 py-0.5 text-xs font-medium rounded cursor-pointer"
            [class]="getPriorityClass(task().priority)"
            title="Change priority"
          >
            {{ task().priority }}
          </button>

          @if (showPriorityDropdown()) {
            <div
              class="absolute right-0 top-full mt-1 z-10 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[100px]"
            >
              @for (p of priorities; track p) {
                <button
                  (click)="onPriorityChange(p); $event.stopPropagation()"
                  class="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--muted)] transition-colors"
                  [class.font-semibold]="p.toLowerCase() === task().priority.toLowerCase()"
                >
                  <span
                    class="inline-block w-2 h-2 rounded-full mr-2"
                    [class]="getPriorityDotClass(p)"
                  ></span>
                  {{ p }}
                </button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Hover toolbar -->
      <div
        class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
      >
        <a
          [routerLink]="['/board', task().board_id]"
          class="p-1 text-[var(--muted-foreground)] hover:text-primary rounded"
          title="Go to board"
          (click)="$event.stopPropagation()"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  `,
})
export class EisenhowerTaskCardComponent {
  task = input.required<EisenhowerTask>();

  priorityChanged = output<{ taskId: string; priority: string }>();

  showPriorityDropdown = signal(false);

  priorities = ['Urgent', 'High', 'Medium', 'Low'];

  togglePriorityDropdown() {
    this.showPriorityDropdown.update((v) => !v);
  }

  onPriorityChange(priority: string) {
    this.showPriorityDropdown.set(false);
    if (priority.toLowerCase() !== this.task().priority.toLowerCase()) {
      this.priorityChanged.emit({ taskId: this.task().id, priority: priority.toLowerCase() });
    }
  }

  formatDueDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `in ${diffDays}d`;
    return date.toLocaleDateString();
  }

  isOverdue(dateStr: string): boolean {
    return new Date(dateStr) < new Date();
  }

  getPriorityClass(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'medium':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'low':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400';
    }
  }

  getPriorityDotClass(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-blue-500';
      case 'low':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  }
}
