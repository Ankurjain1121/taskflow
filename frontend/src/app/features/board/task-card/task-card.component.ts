import {
  Component,
  input,
  output,
  signal,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { Task, Label, Assignee } from '../../../core/services/task.service';
import {
  getPriorityColor,
  getPriorityLabel,
  getDueDateColor,
  isOverdue,
  isToday,
} from '../../../shared/utils/task-colors';
import { SubtaskService, SubtaskProgress } from '../../../core/services/subtask.service';
import { TimeTrackingService } from '../../../core/services/time-tracking.service';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, CdkDrag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      cdkDrag
      [cdkDragData]="task()"
      (click)="onCardClick($event)"
      class="task-card rounded-lg border border-gray-200/80 cursor-pointer group relative overflow-hidden"
      [style.border-left]="'4px solid ' + getBorderColor()"
      [class.task-card--urgent]="task().priority === 'urgent'"
      [class.task-card--high]="task().priority === 'high'"
      [class.task-card--medium]="task().priority === 'medium'"
      [class.task-card--low]="task().priority === 'low'"
    >
      <!-- Celebration Overlay -->
      @if (isCelebrating()) {
        <div class="absolute inset-0 bg-emerald-50/80 dark:bg-emerald-900/30 flex items-center justify-center z-10 rounded-lg">
          <div class="animate-celebrate-check">
            <svg class="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
        </div>
      }

      <div class="p-3.5">
        <!-- Blocked Indicator -->
        @if (isBlocked()) {
          <div class="flex items-center gap-1.5 mb-2.5 px-2 py-1 bg-red-50 rounded-lg text-xs font-semibold text-red-600 border border-red-100">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Blocked
          </div>
        }

        <!-- Title -->
        <h4 class="text-sm font-semibold text-gray-800 line-clamp-2 mb-2.5 leading-snug tracking-tight">
          {{ task().title }}
        </h4>

        <!-- Running Timer Indicator -->
        @if (hasRunningTimer()) {
          <div class="flex items-center gap-1.5 mb-2.5 px-2 py-1 bg-emerald-50 rounded-lg text-xs font-semibold text-emerald-700 border border-emerald-100">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ timerElapsed() }}
          </div>
        }

        <!-- Labels -->
        @if (task().labels && task().labels!.length > 0) {
          <div class="flex flex-wrap gap-1.5 mb-3">
            @for (label of task().labels!.slice(0, 3); track label.id) {
              <span
                class="label-chip inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide"
                [style.background-color]="label.color + '18'"
                [style.color]="label.color"
                [style.border]="'1px solid ' + label.color + '30'"
              >
                {{ label.name }}
              </span>
            }
            @if (task().labels!.length > 3) {
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-gray-400 bg-gray-100">
                +{{ task().labels!.length - 3 }}
              </span>
            }
          </div>
        }

        <!-- Bottom Row -->
        <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100">
          <div class="flex items-center gap-2">
            <!-- Priority Badge -->
            <span
              [class]="
                'priority-badge inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase ' +
                priorityColors.bg +
                ' ' +
                priorityColors.text
              "
            >
              {{ priorityLabel }}
            </span>

            <!-- Due Date -->
            @if (task().due_date) {
              <span
                [class]="
                  'flex items-center gap-1 text-[11px] font-medium ' + dueDateColorClass
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
                [class.text-emerald-600]="subtaskProgress()!.completed === subtaskProgress()!.total"
                [class.text-gray-400]="subtaskProgress()!.completed !== subtaskProgress()!.total"
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
                {{ subtaskProgress()!.completed }}/{{ subtaskProgress()!.total }}
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
                    class="assignee-avatar w-7 h-7 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                    [title]="assignee.display_name"
                    [style.z-index]="3 - i"
                    [style.background]="assignee.avatar_url ? 'transparent' : getAvatarGradient(i)"
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
                    class="w-7 h-7 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 shadow-sm"
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
      <div *cdkDragPreview class="drag-preview rounded-xl shadow-2xl p-4 w-64 border border-gray-200/50">
        <div class="flex items-center gap-2 mb-1">
          <span
            class="w-2 h-2 rounded-full"
            [style.background-color]="getBorderColor()"
          ></span>
          <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {{ priorityLabel }}
          </span>
        </div>
        <h4 class="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">
          {{ task().title }}
        </h4>
      </div>

      <!-- Drag Placeholder -->
      <div
        *cdkDragPlaceholder
        class="bg-indigo-50/50 rounded-lg border-2 border-dashed border-indigo-200"
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
        background: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03);
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .task-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08), 0 4px 10px rgba(0, 0, 0, 0.04);
      }

      .task-card--urgent {
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.03) 0%, white 60%);
      }

      .task-card--high {
        background: linear-gradient(135deg, rgba(249, 115, 22, 0.03) 0%, white 60%);
      }

      .task-card--medium {
        background: linear-gradient(135deg, rgba(234, 179, 8, 0.02) 0%, white 60%);
      }

      .task-card--low {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, white 60%);
      }

      .priority-badge {
        letter-spacing: 0.04em;
        line-height: 1;
        padding-top: 3px;
        padding-bottom: 3px;
      }

      .label-chip {
        letter-spacing: 0.02em;
        backdrop-filter: blur(4px);
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
export class TaskCardComponent implements OnInit, OnDestroy {
  private subtaskService = inject(SubtaskService);
  private timeTrackingService = inject(TimeTrackingService);

  task = input.required<Task>();
  isBlocked = input<boolean>(false);
  isCelebrating = input<boolean>(false);

  taskClicked = output<Task>();

  subtaskProgress = signal<SubtaskProgress | null>(null);
  hasRunningTimer = signal(false);
  timerElapsed = signal('');
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadSubtaskProgress();
    this.checkRunningTimer();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

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

  private loadSubtaskProgress(): void {
    this.subtaskService.list(this.task().id).subscribe({
      next: (response) => {
        if (response.progress.total > 0) {
          this.subtaskProgress.set(response.progress);
        }
      },
      error: () => {
        // Silently ignore - subtask progress is optional
      },
    });
  }

  private checkRunningTimer(): void {
    this.timeTrackingService.listEntries(this.task().id).subscribe({
      next: (entries) => {
        const running = entries.find((e) => e.is_running);
        if (running) {
          this.hasRunningTimer.set(true);
          this.startTimerDisplay(running.started_at);
        }
      },
      error: () => {
        // Silently ignore
      },
    });
  }

  private startTimerDisplay(startedAt: string): void {
    const update = () => {
      const diffSec = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const h = Math.floor(diffSec / 3600);
      const m = Math.floor((diffSec % 3600) / 60);
      const s = diffSec % 60;
      this.timerElapsed.set(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    update();
    this.timerInterval = setInterval(update, 1000);
  }
}
