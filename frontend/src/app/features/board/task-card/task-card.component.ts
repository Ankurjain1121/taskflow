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
      class="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer group"
      [style.border-left]="'4px solid ' + getBorderColor()"
    >
      <div class="p-3">
        <!-- Blocked Indicator -->
        @if (isBlocked()) {
          <div class="flex items-center gap-1 mb-2 px-1.5 py-0.5 bg-red-50 rounded text-xs font-medium text-red-600">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Blocked
          </div>
        }

        <!-- Title -->
        <h4 class="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
          {{ task().title }}
        </h4>

        <!-- Running Timer Indicator -->
        @if (hasRunningTimer()) {
          <div class="flex items-center gap-1.5 mb-2 px-1.5 py-0.5 bg-green-50 rounded text-xs font-medium text-green-700">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ timerElapsed() }}
          </div>
        }

        <!-- Labels -->
        @if (task().labels && task().labels!.length > 0) {
          <div class="flex flex-wrap gap-1 mb-2">
            @for (label of task().labels!.slice(0, 3); track label.id) {
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                [style.background-color]="label.color + '20'"
                [style.color]="label.color"
              >
                {{ label.name }}
              </span>
            }
            @if (task().labels!.length > 3) {
              <span class="text-xs text-gray-500">
                +{{ task().labels!.length - 3 }}
              </span>
            }
          </div>
        }

        <!-- Bottom Row -->
        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center gap-2">
            <!-- Priority Badge -->
            <span
              [class]="
                'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ' +
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
                  'flex items-center gap-1 text-xs ' + dueDateColorClass
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
                class="flex items-center gap-1 text-xs"
                [class.text-green-600]="subtaskProgress()!.completed === subtaskProgress()!.total"
                [class.text-gray-500]="subtaskProgress()!.completed !== subtaskProgress()!.total"
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
                    class="w-6 h-6 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600"
                    [title]="assignee.display_name"
                    [style.z-index]="3 - i"
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
                    class="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600"
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
      <div *cdkDragPreview class="bg-white rounded-lg shadow-lg p-3 w-64">
        <h4 class="text-sm font-medium text-gray-900 line-clamp-2">
          {{ task().title }}
        </h4>
      </div>

      <!-- Drag Placeholder -->
      <div
        *cdkDragPlaceholder
        class="bg-gray-100 rounded-lg border-2 border-dashed border-gray-300"
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
    `,
  ],
})
export class TaskCardComponent implements OnInit, OnDestroy {
  private subtaskService = inject(SubtaskService);
  private timeTrackingService = inject(TimeTrackingService);

  task = input.required<Task>();
  isBlocked = input<boolean>(false);

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
