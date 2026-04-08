import {
  Component,
  input,
  output,
  signal,
  computed,
  HostListener,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { FocusTask } from '../dashboard.types';

@Component({
  selector: 'app-focus-mode',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="fixed inset-0 z-[100] flex flex-col focus-mode-overlay"
        style="background: var(--background)"
        role="dialog"
        aria-label="Focus Mode"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-8 py-4"
          style="border-bottom: 1px solid var(--border)"
        >
          <h2 class="text-lg font-bold" style="color: var(--foreground)">
            <i class="pi pi-bolt text-primary mr-2"></i>
            Focus Mode
          </h2>
          <button
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors btn-press"
            style="background: var(--muted); color: var(--muted-foreground)"
            (click)="close()"
            aria-label="Exit focus mode"
          >
            <i class="pi pi-times text-xs"></i>
            Exit
            <kbd
              class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
              style="background: var(--border); color: var(--muted-foreground)"
            >
              Esc
            </kbd>
          </button>
        </div>

        <!-- Task cards -->
        <div class="flex-1 overflow-y-auto px-8 py-8">
          @if (tasks().length > 0) {
            <div class="max-w-3xl mx-auto space-y-4">
              @for (task of tasks(); track task.id; let i = $index) {
                <div
                  class="focus-mode-card widget-card p-6 cursor-pointer transition-all"
                  [class.ring-2]="selectedIndex() === i"
                  [class.ring-primary]="selectedIndex() === i"
                  [class.opacity-40]="completedIds().has(task.id)"
                  (click)="selectIndex(i)"
                >
                  <div class="flex items-start gap-4">
                    <!-- Priority indicator -->
                    <div
                      class="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                      [class]="getPriorityClass(task.priority)"
                    ></div>

                    <div class="flex-1 min-w-0">
                      <h3
                        class="text-lg font-semibold"
                        style="color: var(--foreground)"
                      >
                        {{ task.title }}
                      </h3>
                      <div class="flex items-center gap-3 mt-2 text-sm" style="color: var(--muted-foreground)">
                        <span class="flex items-center gap-1.5">
                          <span
                            class="w-2 h-2 rounded-full"
                            [style.background]="task.project_color || 'var(--primary)'"
                          ></span>
                          {{ task.project_name }}
                        </span>
                        @if (task.due_date) {
                          <span class="flex items-center gap-1">
                            <i class="pi pi-calendar text-xs"></i>
                            {{ formatDueDate(task) }}
                          </span>
                        }
                      </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <button
                        class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors btn-press"
                        style="background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--success)"
                        (click)="onComplete(task.id); $event.stopPropagation()"
                        [disabled]="completedIds().has(task.id)"
                      >
                        <i class="pi pi-check mr-1"></i>
                        Done
                      </button>
                      <button
                        class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors btn-press"
                        style="background: var(--muted); color: var(--muted-foreground)"
                        (click)="onOpen(task.id); $event.stopPropagation()"
                        aria-label="Open task"
                      >
                        <i class="pi pi-arrow-right"></i>
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="flex flex-col items-center justify-center h-full gap-4">
              <i class="pi pi-check-circle text-4xl" style="color: var(--success)"></i>
              <p class="text-lg font-medium" style="color: var(--muted-foreground)">
                No focus tasks right now. You're all set!
              </p>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    @media (prefers-reduced-motion: no-preference) {
      .focus-mode-overlay {
        animation: fadeIn 0.3s ease-out;
      }
      .focus-mode-card {
        animation: fadeInUp 0.4s ease-out both;
      }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class FocusModeComponent {
  private router = inject(Router);

  readonly visible = input(false);
  readonly tasks = input<FocusTask[]>([]);

  readonly closed = output<void>();
  readonly taskCompleted = output<string>();

  readonly selectedIndex = signal(0);
  readonly completedIds = signal(new Set<string>());

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible()) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  selectIndex(i: number): void {
    this.selectedIndex.set(i);
  }

  onComplete(taskId: string): void {
    this.completedIds.update((ids) => {
      const next = new Set(ids);
      next.add(taskId);
      return next;
    });
    this.taskCompleted.emit(taskId);
  }

  onOpen(taskId: string): void {
    this.router.navigate(['/task', taskId]);
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'bg-[var(--destructive)]';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-[var(--primary)]';
      default:
        return 'bg-[var(--muted-foreground)]';
    }
  }

  formatDueDate(task: FocusTask): string {
    if (task.days_overdue !== null && task.days_overdue > 0) {
      return `${task.days_overdue}d overdue`;
    }
    if (task.days_overdue !== null && task.days_overdue === 0) {
      return 'Due today';
    }
    if (!task.due_date) return '';
    const due = new Date(task.due_date);
    return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  readonly taskCount = computed(() => this.tasks().length);
}
