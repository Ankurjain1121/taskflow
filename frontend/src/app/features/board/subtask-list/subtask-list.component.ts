import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SubtaskService,
  Subtask,
  SubtaskProgress,
} from '../../../core/services/subtask.service';

@Component({
  selector: 'app-subtask-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
        <!-- Subtask items -->
        <div class="space-y-1">
          @for (subtask of subtasks(); track subtask.id) {
            <div
              class="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--muted)] transition-colors"
            >
              <!-- Checkbox -->
              <input
                type="checkbox"
                [checked]="subtask.is_completed"
                (change)="onToggle(subtask)"
                class="h-4 w-4 rounded border-[var(--border)] text-primary focus:ring-ring cursor-pointer"
              />

              <!-- Title (editable on click) -->
              @if (editingId() === subtask.id) {
                <input
                  type="text"
                  [ngModel]="editingTitle()"
                  (ngModelChange)="editingTitle.set($event)"
                  (blur)="saveEdit(subtask)"
                  (keydown.enter)="saveEdit(subtask)"
                  (keydown.escape)="cancelEdit()"
                  class="flex-1 text-sm border-0 border-b border-[var(--border)] focus:ring-0 focus:border-primary px-0 py-0 bg-transparent text-[var(--foreground)]"
                  #editInput
                />
              } @else {
                <span
                  (dblclick)="startEdit(subtask)"
                  class="flex-1 text-sm cursor-default select-none"
                  [class.line-through]="subtask.is_completed"
                  [style.color]="
                    subtask.is_completed
                      ? 'var(--muted-foreground)'
                      : 'var(--foreground)'
                  "
                >
                  {{ subtask.title }}
                </span>
              }

              <!-- Delete button (visible on hover) -->
              <button
                (click)="onDelete(subtask)"
                class="opacity-0 group-hover:opacity-100 p-1 text-[var(--muted-foreground)] hover:text-red-500 transition-all"
                title="Delete subtask"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
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
})
export class SubtaskListComponent implements OnInit, OnChanges {
  private subtaskService = inject(SubtaskService);

  taskId = input.required<string>();

  loading = signal(true);
  subtasks = signal<Subtask[]>([]);
  progress = signal<SubtaskProgress>({ completed: 0, total: 0 });
  newSubtaskTitle = signal('');
  editingId = signal<string | null>(null);
  editingTitle = signal('');

  ngOnInit(): void {
    this.loadSubtasks();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['taskId'] && !changes['taskId'].firstChange) {
      this.loadSubtasks();
    }
  }

  progressPercent(): number {
    const p = this.progress();
    if (p.total === 0) return 0;
    return Math.round((p.completed / p.total) * 100);
  }

  onToggle(subtask: Subtask): void {
    this.subtaskService.toggle(subtask.id).subscribe({
      next: (updated) => {
        this.subtasks.update((list) =>
          list.map((s) => (s.id === updated.id ? updated : s)),
        );
        this.updateProgress(updated.is_completed ? 1 : -1);
      },
      error: (err) => console.error('Failed to toggle subtask:', err),
    });
  }

  onAdd(): void {
    const title = this.newSubtaskTitle().trim();
    if (!title) return;

    this.subtaskService.create(this.taskId(), title).subscribe({
      next: (subtask) => {
        this.subtasks.update((list) => [...list, subtask]);
        this.progress.update((p) => ({ ...p, total: p.total + 1 }));
        this.newSubtaskTitle.set('');
      },
      error: (err) => console.error('Failed to create subtask:', err),
    });
  }

  onDelete(subtask: Subtask): void {
    this.subtaskService.delete(subtask.id).subscribe({
      next: () => {
        this.subtasks.update((list) => list.filter((s) => s.id !== subtask.id));
        this.progress.update((p) => ({
          completed: subtask.is_completed ? p.completed - 1 : p.completed,
          total: p.total - 1,
        }));
      },
      error: (err) => console.error('Failed to delete subtask:', err),
    });
  }

  startEdit(subtask: Subtask): void {
    this.editingId.set(subtask.id);
    this.editingTitle.set(subtask.title);
  }

  saveEdit(subtask: Subtask): void {
    const newTitle = this.editingTitle().trim();
    if (!newTitle || newTitle === subtask.title) {
      this.cancelEdit();
      return;
    }

    this.subtaskService.update(subtask.id, newTitle).subscribe({
      next: (updated) => {
        this.subtasks.update((list) =>
          list.map((s) => (s.id === updated.id ? updated : s)),
        );
        this.cancelEdit();
      },
      error: (err) => {
        console.error('Failed to update subtask:', err);
        this.cancelEdit();
      },
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingTitle.set('');
  }

  private loadSubtasks(): void {
    this.loading.set(true);
    this.subtaskService.list(this.taskId()).subscribe({
      next: (response) => {
        this.subtasks.set(response.subtasks);
        this.progress.set(response.progress);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load subtasks:', err);
        this.loading.set(false);
      },
    });
  }

  private updateProgress(delta: number): void {
    this.progress.update((p) => ({
      ...p,
      completed: p.completed + delta,
    }));
  }
}
