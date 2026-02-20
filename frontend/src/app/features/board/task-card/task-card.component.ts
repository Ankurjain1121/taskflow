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
      class="task-card rounded-lg border border-[var(--border)] cursor-grab group relative overflow-hidden"
      [style.border-top]="'3px solid ' + getBorderColor()"
      [class.task-card--urgent]="task().priority === 'urgent'"
      [class.task-card--high]="task().priority === 'high'"
      [class.task-card--medium]="task().priority === 'medium'"
      [class.task-card--low]="task().priority === 'low'"
      [class.ring-2]="isFocused()"
      [class.ring-ring]="isFocused()"
      [class.shadow-lg]="isFocused()"
    >
      <!-- Celebration Overlay -->
      @if (isCelebrating()) {
        <div
          class="absolute inset-0 bg-[var(--status-green-bg)] flex items-center justify-center z-10 rounded-lg"
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

      <!-- Hover Quick-Action -->
      <div
        class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20"
      >
        <button
          class="w-6 h-6 rounded bg-[var(--card)]/90 shadow-sm flex items-center justify-center hover:bg-[var(--muted)] text-[var(--muted-foreground)] btn-snappy"
          (click)="$event.stopPropagation()"
        >
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
            />
          </svg>
        </button>
      </div>

      <!-- Labels -->
      @if (task().labels && task().labels!.length > 0) {
        <div class="flex flex-wrap gap-1 px-3 pt-3">
          @for (label of task().labels!; track label.id) {
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
              [style.background-color]="label.color"
              [style.text-shadow]="'1px 1px 0 rgba(0,0,0,0.2)'"
            >
              {{ label.name }}
            </span>
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
            class="flex items-center gap-1.5 mb-2.5 px-2 py-1 bg-[var(--status-red-bg)] rounded-lg text-xs font-semibold text-[var(--status-red-text)] border border-[var(--status-red-border)]"
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
          class="text-sm font-semibold text-[var(--card-foreground)] line-clamp-2 mb-2.5 leading-snug tracking-tight"
        >
          {{ task().title }}
        </h4>

        <!-- Running Timer Indicator -->
        @if (hasRunningTimer()) {
          <div
            class="flex items-center gap-1.5 mb-2.5 px-2 py-1 bg-[var(--status-green-bg)] rounded-lg text-xs font-semibold text-[var(--status-green-text)] border border-[var(--status-green-border)]"
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
          class="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--border)]"
        >
          <div class="flex items-center gap-2">
            <!-- Priority Flag Icon -->
            <svg
              class="w-3.5 h-3.5 flex-shrink-0"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M2 1v10M2 1h7l-2 3 2 3H2"
                [attr.stroke]="getPriorityFlagColor()"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span
              class="text-[10px] font-semibold uppercase tracking-wider"
              [style.color]="getPriorityFlagColor()"
            >
              {{ priorityLabel }}
            </span>

            <!-- Due Date -->
            @if (task().due_date) {
              <span
                [class]="
                  'flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ' +
                  dueDateColors.class +
                  ' ' +
                  dueDateColors.chipClass
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
                    class="assignee-avatar w-7 h-7 rounded-full ring-2 ring-[var(--card)] flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
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
                    class="w-7 h-7 rounded-full ring-2 ring-[var(--card)] bg-[var(--secondary)] flex items-center justify-center text-[10px] font-bold text-[var(--muted-foreground)] shadow-sm"
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
        class="drag-preview rounded-xl shadow-2xl p-4 w-64 border border-[var(--border)]"
      >
        <div class="flex items-center gap-2 mb-1">
          <span
            class="w-2 h-2 rounded-full"
            [style.background-color]="getBorderColor()"
          ></span>
          <span
            class="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]"
          >
            {{ priorityLabel }}
          </span>
        </div>
        <h4
          class="text-sm font-semibold text-[var(--card-foreground)] line-clamp-2 leading-snug"
        >
          {{ task().title }}
        </h4>
      </div>

      <!-- Drag Placeholder -->
      <div
        *cdkDragPlaceholder
        class="bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] rounded-lg border-2 border-dashed border-[color-mix(in_srgb,var(--primary)_30%,transparent)]"
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
        box-shadow: 0 1px 0
          color-mix(in srgb, var(--foreground) 12%, transparent);
        transition: background 0.15s ease;
      }

      .task-card:hover {
        background: var(--muted);
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
        background: color-mix(in srgb, var(--card) 92%, transparent);
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

  get dueDateColors(): { class: string; chipClass: string } {
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
