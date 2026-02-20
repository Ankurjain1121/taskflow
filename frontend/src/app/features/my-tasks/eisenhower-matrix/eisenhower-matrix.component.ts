import {
  Component,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import {
  EisenhowerService,
  EisenhowerMatrixResponse,
  EisenhowerTask,
  EisenhowerQuadrant,
} from '../../../core/services/eisenhower.service';
import { TaskService } from '../../../core/services/task.service';

interface QuadrantConfig {
  key: EisenhowerQuadrant;
  title: string;
  subtitle: string;
  bgColor: string;
  borderColor: string;
  coaching: string;
  actionLabel?: string;
}

@Component({
  selector: 'app-eisenhower-matrix',
  standalone: true,
  imports: [CommonModule, RouterModule, ConfirmDialog],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--background)]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-[var(--card-foreground)]">
              Eisenhower Matrix
            </h1>
            <p class="text-sm text-[var(--muted-foreground)] mt-1">
              Prioritize your tasks by urgency and importance
            </p>
          </div>
          <button
            (click)="resetAllOverrides()"
            class="inline-flex items-center gap-2 px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            [disabled]="loading()"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Auto-Sort
          </button>
        </div>

        <!-- Loading State -->
        @if (loading()) {
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            @for (i of [1, 2, 3, 4]; track i) {
              <div
                class="bg-[var(--card)] rounded-lg border-2 border-[var(--border)] p-6"
              >
                <div class="skeleton skeleton-text w-32 mb-2"></div>
                <div class="skeleton skeleton-text w-48 mb-4"></div>
                <div class="space-y-2">
                  @for (j of [1, 2, 3]; track j) {
                    <div class="skeleton skeleton-card h-16"></div>
                  }
                </div>
              </div>
            }
          </div>
        } @else if (matrix()) {
          <!-- 2x2 Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            @for (quadrant of quadrants; track quadrant.key) {
              <div
                class="rounded-lg border-2 p-6 transition-all"
                [class]="quadrant.borderColor"
                [style.background]="quadrant.bgColor"
              >
                <!-- Quadrant Header -->
                <div class="mb-4 pb-4 border-b border-[var(--border)]">
                  <h2
                    class="text-lg font-semibold text-[var(--card-foreground)]"
                  >
                    {{ quadrant.title }}
                  </h2>
                  <p class="text-sm text-[var(--muted-foreground)] mt-1">
                    {{ quadrant.subtitle }}
                  </p>
                  <p class="text-xs text-[var(--muted-foreground)] mt-2 italic">
                    {{ quadrant.coaching }}
                  </p>
                  <div class="mt-2 flex items-center justify-between">
                    <span
                      class="text-xs font-medium text-[var(--muted-foreground)]"
                    >
                      {{ getTasksByQuadrant(quadrant.key).length }} tasks
                    </span>
                    @if (quadrant.actionLabel) {
                      <button
                        class="text-xs font-medium text-primary hover:text-primary"
                        (click)="performQuadrantAction(quadrant.key)"
                      >
                        {{ quadrant.actionLabel }}
                      </button>
                    }
                  </div>
                </div>

                <!-- Tasks List -->
                <div class="space-y-2 max-h-96 overflow-y-auto">
                  @for (
                    task of getTasksByQuadrant(quadrant.key);
                    track task.id
                  ) {
                    <div
                      class="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer"
                      [routerLink]="['/task', task.id]"
                    >
                      <div class="flex items-start justify-between">
                        <div class="flex-1 min-w-0">
                          <h3
                            class="text-sm font-medium text-[var(--card-foreground)] truncate"
                          >
                            {{ task.title }}
                          </h3>
                          <div class="flex items-center gap-2 mt-1">
                            <span
                              class="text-xs text-[var(--muted-foreground)]"
                            >
                              {{ task.board_name }}
                            </span>
                            @if (task.due_date) {
                              <span
                                class="text-xs text-[var(--muted-foreground)]"
                                >&bull;</span
                              >
                              <span
                                class="text-xs"
                                [class]="
                                  isOverdue(task.due_date)
                                    ? 'text-red-600 font-medium'
                                    : 'text-[var(--muted-foreground)]'
                                "
                              >
                                Due {{ formatDueDate(task.due_date) }}
                              </span>
                            }
                          </div>
                        </div>
                        <span
                          class="ml-2 px-2 py-0.5 text-xs font-medium rounded"
                          [class]="getPriorityClass(task.priority)"
                        >
                          {{ task.priority }}
                        </span>
                      </div>
                    </div>
                  } @empty {
                    <div
                      class="text-center py-8 text-[var(--muted-foreground)]"
                    >
                      <p class="text-sm">No tasks in this quadrant</p>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
    <p-confirmDialog />
  `,
  styles: [
    `
      @reference "tailwindcss";
      .skeleton {
        @apply animate-pulse rounded;
        background: var(--muted);
      }
      .skeleton-text {
        @apply h-4;
      }
      .skeleton-card {
        @apply h-24;
      }
    `,
  ],
})
export class EisenhowerMatrixComponent implements OnInit {
  private eisenhowerService = inject(EisenhowerService);
  private taskService = inject(TaskService);
  private confirmationService = inject(ConfirmationService);

  loading = signal(false);
  matrix = signal<EisenhowerMatrixResponse | null>(null);

  quadrants: QuadrantConfig[] = [
    {
      key: 'do_first',
      title: 'Do First',
      subtitle: 'Urgent & Important',
      bgColor: '#fff5f5',
      borderColor: 'border-red-300',
      coaching: 'Do these tasks immediately. They require your attention now.',
    },
    {
      key: 'schedule',
      title: 'Schedule',
      subtitle: 'Not Urgent & Important',
      bgColor: '#fffdf5',
      borderColor: 'border-yellow-300',
      coaching:
        "Plan when you'll do these. They're important but not pressing.",
    },
    {
      key: 'delegate',
      title: 'Delegate',
      subtitle: 'Urgent & Not Important',
      bgColor: '#fff8f5',
      borderColor: 'border-orange-300',
      coaching: 'Can someone else handle these? Delegate if possible.',
      actionLabel: 'Reassign',
    },
    {
      key: 'eliminate',
      title: 'Eliminate',
      subtitle: 'Not Urgent & Not Important',
      bgColor: '#f8f9fa',
      borderColor: 'border-[var(--border)]',
      coaching: 'Consider removing these from your list entirely.',
      actionLabel: 'Archive',
    },
  ];

  ngOnInit() {
    this.loadMatrix();
  }

  async loadMatrix() {
    this.loading.set(true);
    try {
      const matrix = await firstValueFrom(this.eisenhowerService.getMatrix());
      this.matrix.set(matrix || null);
    } catch {
      // Matrix will show empty state
    } finally {
      this.loading.set(false);
    }
  }

  getTasksByQuadrant(quadrant: EisenhowerQuadrant): EisenhowerTask[] {
    const matrix = this.matrix();
    if (!matrix) return [];
    return matrix[quadrant] || [];
  }

  resetAllOverrides() {
    this.confirmationService.confirm({
      message:
        'Reset all manual overrides? Tasks will return to auto-computed quadrants.',
      header: 'Confirm Auto-Sort',
      icon: 'pi pi-refresh',
      acceptLabel: 'Reset',
      rejectLabel: 'Cancel',
      accept: async () => {
        try {
          await firstValueFrom(this.eisenhowerService.resetAllOverrides());
          await this.loadMatrix();
        } catch {
          // Reset failed silently - matrix keeps current state
        }
      },
    });
  }

  async performQuadrantAction(quadrant: EisenhowerQuadrant) {
    if (quadrant === 'eliminate') {
      const tasks = this.getTasksByQuadrant('eliminate');
      if (tasks.length === 0) return;

      this.confirmationService.confirm({
        message: `Archive all ${tasks.length} task(s) in the Eliminate quadrant?`,
        header: 'Confirm Archive',
        icon: 'pi pi-trash',
        acceptLabel: 'Archive All',
        rejectLabel: 'Cancel',
        accept: async () => {
          for (const task of tasks) {
            try {
              await firstValueFrom(this.taskService.deleteTask(task.id));
            } catch {
              // Skip failed deletions
            }
          }
          await this.loadMatrix();
        },
      });
    } else if (quadrant === 'delegate') {
      // Reassign requires a user picker which is not yet available
      // Show warning instead of silently failing
      this.confirmationService.confirm({
        message:
          'Reassign functionality is not yet implemented. Please reassign tasks individually from the task detail page.',
        header: 'Not Available',
        icon: 'pi pi-info-circle',
        acceptLabel: 'OK',
        rejectVisible: false,
      });
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
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }
}
