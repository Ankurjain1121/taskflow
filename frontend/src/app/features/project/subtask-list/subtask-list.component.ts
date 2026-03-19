import {
  Component,
  input,
  output,
  signal,
  inject,
  DestroyRef,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { generateKeyBetween } from 'fractional-indexing';
import {
  CdkDropList,
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  TaskService,
  Task,
  ChildTaskListResponse,
} from '../../../core/services/task.service';
import { Column } from '../../../core/services/project.service';

@Component({
  selector: 'app-subtask-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <!-- Header with progress -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <svg
            class="w-5 h-5 text-[var(--muted-foreground)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <h3 class="text-sm font-medium text-[var(--card-foreground)]">
            Subtasks
          </h3>
        </div>
        @if (progress().total > 0) {
          <span class="text-xs text-[var(--muted-foreground)]">
            {{ progress().completed }}/{{ progress().total }} completed
          </span>
        }
      </div>

      <!-- Progress bar -->
      @if (progress().total > 0) {
        <div class="w-full bg-[var(--muted)] rounded-full h-1.5">
          <div
            class="h-1.5 rounded-full transition-all duration-300"
            [class]="progressPercent() === 100 ? 'bg-green-500' : 'bg-primary'"
            [style.width.%]="progressPercent()"
          ></div>
        </div>
      }

      <!-- Error banner -->
      @if (errorMessage()) {
        <div
          class="p-2 rounded-md text-xs text-[var(--status-red-text)] bg-[var(--status-red-bg)] border border-[var(--status-red-border)]"
        >
          {{ errorMessage() }}
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center justify-center py-4">
          <svg
            class="animate-spin h-5 w-5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      } @else {
        <!-- Child task items with drag-drop -->
        <div
          cdkDropList
          (cdkDropListDropped)="onReorder($event)"
          class="space-y-1"
        >
          @for (child of children(); track child.id) {
            <div
              cdkDrag
              class="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--muted)] transition-colors cursor-pointer"
            >
              <!-- Drag placeholder -->
              <div
                class="border-2 border-dashed border-[var(--border)] rounded-md px-2 py-1.5"
                *cdkDragPlaceholder
              ></div>

              <!-- Drag handle -->
              <div
                cdkDragHandle
                class="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-opacity"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="9" cy="6" r="1.5" />
                  <circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" />
                  <circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" />
                  <circle cx="15" cy="18" r="1.5" />
                </svg>
              </div>

              <!-- Priority dot -->
              <span class="w-2 h-2 rounded-full shrink-0" [style.background]="getPriorityDotColor(child.priority)"></span>

              <!-- Checkbox for complete/uncomplete -->
              <input
                type="checkbox"
                [checked]="isChildDone(child)"
                (change)="onToggleComplete(child)"
                class="h-4 w-4 rounded border-[var(--border)] text-primary focus:ring-ring cursor-pointer"
              />

              <!-- Title (click to navigate) -->
              <span
                (click)="navigateToChild(child)"
                class="flex-1 text-sm hover:text-primary truncate"
                [class.line-through]="isChildDone(child)"
                [style.color]="isChildDone(child) ? 'var(--muted-foreground)' : 'var(--foreground)'"
              >
                {{ child.title }}
              </span>

              <!-- Assignee avatars -->
              @for (a of child.assignees || []; track a.id) {
                <span
                  class="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-medium flex items-center justify-center"
                  [title]="a.display_name"
                >
                  {{ getInitials(a.display_name) }}
                </span>
              }

              <!-- Due date -->
              @if (child.due_date && !isChildDone(child)) {
                <span
                  class="shrink-0 text-xs whitespace-nowrap"
                  [class]="getDueDateClass(child.due_date)"
                >
                  {{ formatDueDate(child.due_date) }}
                </span>
              }

              <!-- Delete button -->
              <button
                (click)="onDelete(child); $event.stopPropagation()"
                class="opacity-0 group-hover:opacity-100 p-1 text-[var(--muted-foreground)] hover:text-red-500 transition-all"
                title="Delete subtask"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          }
        </div>

        <!-- Add new subtask input -->
        <div class="flex items-center gap-2 px-2 py-1.5">
          <svg
            class="w-4 h-4 text-[var(--muted-foreground)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          <input
            type="text"
            [ngModel]="newSubtaskTitle()"
            (ngModelChange)="newSubtaskTitle.set($event)"
            (keydown.enter)="onAdd()"
            placeholder="Add a subtask..."
            class="flex-1 text-sm border-0 focus:ring-0 px-0 py-0 bg-transparent text-[var(--foreground)] placeholder-[var(--muted-foreground)]"
          />
        </div>
      }
    </div>
  `,
  styles: [
    `
      @reference "tailwindcss";
      .cdk-drag-preview {
        @apply shadow-md rounded-md bg-[var(--card)] px-2 py-1.5;
      }
      .cdk-drag-animating {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }
      .cdk-drop-list-dragging .cdk-drag {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }
    `,
  ],
})
export class SubtaskListComponent implements OnInit, OnChanges {
  private taskService = inject(TaskService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private taskId$ = new Subject<string>();

  taskId = input.required<string>();
  boardColumns = input<Column[]>([]);
  childrenLoaded = output<number>();

  loading = signal(true);
  children = signal<Task[]>([]);
  progress = signal<{ completed: number; total: number }>({ completed: 0, total: 0 });
  newSubtaskTitle = signal('');
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.taskId$.pipe(
      switchMap(id => this.loadChildrenForId(id)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (response) => {
        this.children.set(response.children);
        this.progress.set(response.progress);
        this.childrenLoaded.emit(response.children.length);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showError('Failed to load subtasks');
      },
    });
    this.taskId$.next(this.taskId());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['taskId'] && !changes['taskId'].firstChange) {
      this.taskId$.next(this.taskId());
    }
  }

  progressPercent(): number {
    const p = this.progress();
    if (p.total === 0) return 0;
    return Math.round((p.completed / p.total) * 100);
  }

  isChildDone(child: Task): boolean {
    const cols = this.boardColumns();
    if (!cols?.length) return false;
    const col = cols.find(c => c.id === (child.status_id ?? child.column_id));
    return col?.status_mapping?.done === true;
  }

  navigateToChild(child: Task): void {
    this.router.navigate(['/task', child.id]);
  }

  getPriorityDotColor(priority: string): string {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  }

  onToggleComplete(child: Task): void {
    const done = this.isChildDone(child);
    const snapshot = this.children();
    const snapshotProgress = this.progress();

    if (done) {
      this.taskService.uncompleteTask(child.id).subscribe({
        next: () => this.loadChildren(),
        error: () => {
          this.children.set(snapshot);
          this.progress.set(snapshotProgress);
          this.showError('Failed to update task');
        },
      });
    } else {
      this.taskService.completeTask(child.id).subscribe({
        next: () => this.loadChildren(),
        error: () => {
          this.children.set(snapshot);
          this.progress.set(snapshotProgress);
          this.showError('Failed to update task');
        },
      });
    }
  }

  onAdd(): void {
    const title = this.newSubtaskTitle().trim();
    if (!title) return;

    const savedTitle = title;
    this.newSubtaskTitle.set('');

    this.taskService.createChild(this.taskId(), { title }).subscribe({
      next: () => this.loadChildren(),
      error: () => {
        this.newSubtaskTitle.set(savedTitle);
        this.showError('Failed to add subtask');
      },
    });
  }

  onDelete(child: Task): void {
    if (!confirm('Delete this subtask?')) return;
    const snapshot = this.children();
    const snapshotProgress = this.progress();

    this.children.update(list => list.filter(c => c.id !== child.id));
    this.progress.update(p => ({
      completed: this.isChildDone(child) ? p.completed - 1 : p.completed,
      total: p.total - 1,
    }));

    this.taskService.deleteTask(child.id).subscribe({
      error: () => {
        this.children.set(snapshot);
        this.progress.set(snapshotProgress);
        this.showError('Failed to delete subtask');
      },
    });
  }

  onReorder(event: CdkDragDrop<Task[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const snapshot = [...this.children()];
    const items = [...this.children()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.children.set(items);

    // Calculate new position between neighbors
    const moved = items[event.currentIndex];
    const prev = event.currentIndex > 0 ? items[event.currentIndex - 1] : null;
    const next = event.currentIndex < items.length - 1 ? items[event.currentIndex + 1] : null;

    let newPosition: string;
    try {
      const prevPos = prev?.position ?? null;
      const nextPos = next?.position ?? null;
      newPosition = generateKeyBetween(prevPos, nextPos);
    } catch {
      // Fallback to string concatenation if positions are malformed
      newPosition = prev ? prev.position + 'a' : 'a0';
    }

    this.taskService.moveTask(moved.id, { status_id: moved.status_id ?? undefined, position: newPosition }).subscribe({
      error: () => {
        this.children.set(snapshot);
        this.showError('Failed to reorder');
      },
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatDueDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const diffTime = dateOnly.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }

  getDueDateClass(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const diffTime = dateOnly.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'text-red-600 dark:text-red-400 font-medium';
    if (diffDays === 0) return 'text-amber-600 dark:text-amber-400 font-medium';
    return 'text-[var(--muted-foreground)]';
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }

  private loadChildrenForId(taskId: string) {
    this.loading.set(true);
    return this.taskService.listChildren(taskId);
  }

  private loadChildren(): void {
    this.taskId$.next(this.taskId());
  }
}
