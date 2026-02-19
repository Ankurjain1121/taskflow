import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CdkDrag,
  CdkDragPreview,
  CdkDragPlaceholder,
} from '@angular/cdk/drag-drop';
import { Task } from '../../../core/services/task.service';
import {
  getPriorityColor,
  getPriorityLabel,
  getDueDateColor,
  isOverdue,
  isToday,
  PRIORITY_FLAG_COLORS,
} from '../../../shared/utils/task-colors';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, CdkDrag, CdkDragPreview, CdkDragPlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      cdkDrag
      [cdkDragData]="task()"
      (click)="onCardClick($event)"
      class="task-card rounded-lg border border-gray-200/80 cursor-grab group relative overflow-hidden"
      [style.border-left]="'4px solid ' + getBorderColor()"
      [class.task-card--urgent]="task().priority === 'urgent'"
      [class.task-card--high]="task().priority === 'high'"
      [class.task-card--medium]="task().priority === 'medium'"
      [class.task-card--low]="task().priority === 'low'"
      [class.ring-2]="isFocused()"
      [class.ring-indigo-500]="isFocused()"
      [class.shadow-lg]="isFocused()"
    >
      <!-- Celebration Overlay -->
      @if (isCelebrating()) {
        <div
          class="absolute inset-0 bg-emerald-50/80 dark:bg-emerald-900/30 flex items-center justify-center z-10 rounded-lg"
        >
          <div class="animate-celebrate-check">
            <svg
              class="w-10 h-10 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="2.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      }

      <!-- Hover Quick-Actions -->
      <div
        class="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20"
      >
        <button
          class="w-6 h-6 rounded bg-white/90 dark:bg-gray-700/90 shadow-sm flex items-center justify-center hover:bg-white dark:hover:bg-gray-600 text-gray-500"
          (click)="$event.stopPropagation()"
        >
          <svg
            class="w-3.5 h-3.5"
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
        </button>
        <button
          class="w-6 h-6 rounded bg-white/90 dark:bg-gray-700/90 shadow-sm flex items-center justify-center hover:bg-white dark:hover:bg-gray-600 text-gray-500"
          (click)="$event.stopPropagation()"
        >
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </button>
        <button
          class="w-6 h-6 rounded bg-white/90 dark:bg-gray-700/90 shadow-sm flex items-center justify-center hover:bg-white dark:hover:bg-gray-600 text-gray-500"
          (click)="$event.stopPropagation()"
        >
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
            />
          </svg>
        </button>
      </div>

      <!-- Label Bars -->
      @if (task().labels && task().labels!.length > 0) {
        <div class="flex gap-1 mb-0 px-3 pt-3">
          @for (label of task().labels!; track label.id) {
            <div
              class="h-1 rounded-full"
              [style.width.px]="32"
              [style.background-color]="label.color"
              [title]="label.name"
            ></div>
          }
        </div>
      }

      <div
        class="p-3.5"
        [class.pt-2]="task().labels && task().labels!.length > 0"
      >
        <!-- Blocked Indicator -->
        @if (isBlocked()) {
          <div
            class="flex items-center gap-1.5 mb-2.5 px-2 py-1 bg-red-50 rounded-lg text-xs font-semibold text-red-600 border border-red-100"
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Blocked
          </div>
        }

        <!-- Title -->
        <h4
          class="text-sm font-semibold text-black dark:text-gray-100 line-clamp-2 mb-2.5 leading-snug tracking-tight"
        >
          {{ task().title }}
        </h4>

        <!-- Running Timer Indicator -->
        @if (hasRunningTimer()) {
          <div
            class="flex items-center gap-1.5 mb-2.5 px-2 py-1 bg-emerald-50 rounded-lg text-xs font-semibold text-emerald-700 border border-emerald-100"
          >
            <span
              class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
            ></span>
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Timer running
          </div>
        }

        <!-- Bottom Row -->
        <div
          class="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700"
        >
          <div class="flex items-center gap-2">
            <!-- Priority Flag Icon -->
            <svg class="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 1v10M2 1h7l-2 3 2 3H2"
                [attr.stroke]="getPriorityFlagColor()"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>

            <!-- Due Date -->
            @if (task().due_date) {
              <span
                [class]="
                  'flex items-center gap-1 text-[11px] font-medium ' +
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
                {{ formatDueDate(task().due_date!) }}
              </span>
            }

            <!-- Subtask Progress -->
            @if (subtaskProgress() && subtaskProgress()!.total > 0) {
              <span
                class="flex items-center gap-1 text-[11px] font-medium"
                [class.text-emerald-600]="
                  subtaskProgress()!.completed === subtaskProgress()!.total
                "
                [class.text-gray-400]="
                  subtaskProgress()!.completed !== subtaskProgress()!.total
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {{ subtaskProgress()!.completed }}/{{
                  subtaskProgress()!.total
                }}
              </span>
            }
          </div>

          <!-- Assignees -->
          <div class="flex items-center">
            @if (task().assignees && task().assignees!.length > 0) {
              <div class="flex -space-x-2">
                @for (
                  assignee of task().assignees!.slice(0, 3);
                  track assignee.id;
                  let i = $index
                ) {
                  <div
                    class="assignee-avatar w-7 h-7 rounded-full ring-2 ring-white dark:ring-gray-800 flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                    [title]="assignee.display_name"
                    [style.z-index]="3 - i"
                    [style.background]="
                      assignee.avatar_url ? 'transparent' : getAvatarGradient(i)
                    "
                  >
                    @if (assignee.avatar_url) {
                      <img
                        [src]="assignee.avatar_url"
                        [alt]="assignee.display_name"
                        class="w-full h-full rounded-full object-cover"
                      />
                    } @else {
                      {{ getInitials(assignee.display_name) }}
                    }
                  </div>
                }
                @if (task().assignees!.length > 3) {
                  <div
                    class="w-7 h-7 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 shadow-sm"
                    [style.z-index]="0"
                  >
                    +{{ task().assignees!.length - 3 }}
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Drag Preview -->
      <div
        *cdkDragPreview
        class="drag-preview rounded-xl shadow-2xl p-4 w-64 border border-gray-200/50"
      >
        <div class="flex items-center gap-2 mb-1">
          <span
            class="w-2 h-2 rounded-full"
            [style.background-color]="getBorderColor()"
          ></span>
          <span
            class="text-[10px] font-bold uppercase tracking-wider text-gray-400"
          >
            {{ priorityLabel }}
          </span>
        </div>
        <h4
          class="text-sm font-semibold text-black dark:text-gray-100 line-clamp-2 leading-snug"
        >
          {{ task().title }}
        </h4>
      </div>

      <!-- Drag Placeholder -->
      <div
        *cdkDragPlaceholder
        class="bg-indigo-50/30 dark:bg-indigo-900/20 rounded-lg border-2 border-dashed border-indigo-200/60"
        style="height: 80px"
      ></div>
    </div>
  `,
  styles: [
    `
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .task-card {
        background: var(--card, #ffffff);
        box-shadow:
          0 1px 3px rgba(0, 0, 0, 0.04),
          0 1px 2px rgba(0, 0, 0, 0.03);
        transition: box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .task-card:hover {
        box-shadow:
          0 4px 12px rgba(0, 0, 0, 0.08),
          0 2px 4px rgba(0, 0, 0, 0.04);
      }

      /* CDK drag-drop transitions */
      :host {
        display: block;
      }

      :host.cdk-drag-animating {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }

      .cdk-drop-list-dragging .task-card {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }

      .task-card--urgent {
        background: linear-gradient(
          135deg,
          rgba(239, 68, 68, 0.03) 0%,
          var(--card, #ffffff) 60%
        );
      }

      .task-card--high {
        background: linear-gradient(
          135deg,
          rgba(249, 115, 22, 0.03) 0%,
          var(--card, #ffffff) 60%
        );
      }

      .task-card--medium {
        background: linear-gradient(
          135deg,
          rgba(234, 179, 8, 0.02) 0%,
          var(--card, #ffffff) 60%
        );
      }

      .task-card--low {
        background: linear-gradient(
          135deg,
          rgba(59, 130, 246, 0.02) 0%,
          var(--card, #ffffff) 60%
        );
      }

      .assignee-avatar {
        transition: transform 0.15s ease;
      }

      .task-card:hover .assignee-avatar {
        transform: translateX(0);
      }

      .drag-preview {
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(12px) saturate(180%);
        -webkit-backdrop-filter: blur(12px) saturate(180%);
      }
    `,
  ],
})
export class TaskCardComponent {
  task = input.required<Task>();
  isBlocked = input<boolean>(false);
  isCelebrating = input<boolean>(false);
  isFocused = input<boolean>(false);
  subtaskProgress = input<{ completed: number; total: number } | null>(null);
  hasRunningTimer = input<boolean>(false);

  taskClicked = output<Task>();

  get priorityColors() {
    return getPriorityColor(this.task().priority);
  }

  get priorityLabel(): string {
    return getPriorityLabel(this.task().priority);
  }

  get dueDateColorClass(): string {
    return getDueDateColor(this.task().due_date);
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

  getPriorityFlagColor(): string {
    return PRIORITY_FLAG_COLORS[this.task().priority] || '#9ca3af';
  }

  formatDueDate(date: string): string {
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

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarGradient(index: number): string {
    const gradients = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #3b82f6, #06b6d4)',
      'linear-gradient(135deg, #f59e0b, #ef4444)',
      'linear-gradient(135deg, #10b981, #14b8a6)',
    ];
    return gradients[index % gradients.length];
  }

  onCardClick(event: Event): void {
    // Only emit if not dragging
    if (!(event.target as HTMLElement).closest('.cdk-drag-preview')) {
      this.taskClicked.emit(this.task());
    }
  }
}
