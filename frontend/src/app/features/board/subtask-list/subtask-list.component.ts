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
  CdkDropList,
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { generateKeyBetween } from 'fractional-indexing';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import {
  SubtaskService,
  SubtaskWithAssignee,
  SubtaskProgress,
} from '../../../core/services/subtask.service';

@Component({
  selector: 'app-subtask-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    ConfirmDialog,
  ],
  providers: [ConfirmationService],
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
        <!-- Subtask items with drag-drop -->
        <div
          cdkDropList
          (cdkDropListDropped)="onReorder($event)"
          class="space-y-1"
        >
          @for (subtask of subtasks(); track subtask.id) {
            <div
              cdkDrag
              [cdkDragDisabled]="editingId() === subtask.id"
              class="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--muted)] transition-colors"
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

              <!-- Assignee avatar -->
              @if (subtask.assignee_name) {
                <span
                  class="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-medium flex items-center justify-center"
                  [title]="subtask.assignee_name"
                >
                  {{ getInitials(subtask.assignee_name) }}
                </span>
              }

              <!-- Due date -->
              @if (subtask.due_date && !subtask.is_completed) {
                <span
                  class="shrink-0 text-xs whitespace-nowrap"
                  [class]="getDueDateClass(subtask.due_date)"
                >
                  {{ formatDueDate(subtask.due_date) }}
                </span>
              }

              <!-- Promote to task button (visible on hover) -->
              <button
                (click)="onPromote(subtask)"
                class="opacity-0 group-hover:opacity-100 p-1 text-[var(--muted-foreground)] hover:text-primary transition-all"
                title="Promote to task"
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
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              </button>

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
    <p-confirmDialog />
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
  private subtaskService = inject(SubtaskService);
  private confirmationService = inject(ConfirmationService);

  taskId = input.required<string>();

  loading = signal(true);
  subtasks = signal<SubtaskWithAssignee[]>([]);
  progress = signal<SubtaskProgress>({ completed: 0, total: 0 });
  newSubtaskTitle = signal('');
  editingId = signal<string | null>(null);
  editingTitle = signal('');
  errorMessage = signal<string | null>(null);

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

  onToggle(subtask: SubtaskWithAssignee): void {
    const snapshot = this.subtasks();
    const snapshotProgress = this.progress();
    const newCompleted = !subtask.is_completed;

    // Optimistic: toggle locally
    this.subtasks.update((list) =>
      list.map((s) =>
        s.id === subtask.id ? { ...s, is_completed: newCompleted } : s,
      ),
    );
    this.updateProgress(newCompleted ? 1 : -1);

    this.subtaskService.toggle(subtask.id).subscribe({
      next: (updated) => {
        this.subtasks.update((list) =>
          list.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
        );
      },
      error: () => {
        this.subtasks.set(snapshot);
        this.progress.set(snapshotProgress);
        this.showError('Failed to update subtask');
      },
    });
  }

  onAdd(): void {
    const title = this.newSubtaskTitle().trim();
    if (!title) return;

    const snapshot = this.subtasks();
    const snapshotProgress = this.progress();
    const savedTitle = title;

    // Optimistic: insert temp subtask
    const tempId = crypto.randomUUID();
    const tempSubtask: SubtaskWithAssignee = {
      id: tempId,
      task_id: this.taskId(),
      title,
      is_completed: false,
      position: 'zzz',
      assigned_to_id: null,
      completed_at: null,
      due_date: null,
      assignee_name: null,
      assignee_avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.subtasks.update((list) => [...list, tempSubtask]);
    this.progress.update((p) => ({ ...p, total: p.total + 1 }));
    this.newSubtaskTitle.set('');

    this.subtaskService.create(this.taskId(), title).subscribe({
      next: (created) => {
        const withAssignee: SubtaskWithAssignee = {
          ...created,
          assignee_name: null,
          assignee_avatar_url: null,
        };
        // Replace temp with real
        this.subtasks.update((list) =>
          list.map((s) => (s.id === tempId ? withAssignee : s)),
        );
      },
      error: () => {
        this.subtasks.set(snapshot);
        this.progress.set(snapshotProgress);
        this.newSubtaskTitle.set(savedTitle);
        this.showError('Failed to add subtask');
      },
    });
  }

  onDelete(subtask: SubtaskWithAssignee): void {
    const snapshot = this.subtasks();
    const snapshotProgress = this.progress();

    // Optimistic: remove immediately
    this.subtasks.update((list) => list.filter((s) => s.id !== subtask.id));
    this.progress.update((p) => ({
      completed: subtask.is_completed ? p.completed - 1 : p.completed,
      total: p.total - 1,
    }));

    this.subtaskService.delete(subtask.id).subscribe({
      error: () => {
        this.subtasks.set(snapshot);
        this.progress.set(snapshotProgress);
        this.showError('Failed to delete subtask');
      },
    });
  }

  onPromote(subtask: SubtaskWithAssignee): void {
    this.confirmationService.confirm({
      message: `Promote "${subtask.title}" to a full task? It will be created in the same board column.`,
      header: 'Promote to Task',
      icon: 'pi pi-arrow-up',
      acceptLabel: 'Promote',
      rejectLabel: 'Cancel',
      accept: () => {
        const snapshot = this.subtasks();
        const snapshotProgress = this.progress();

        // Optimistic: remove from list
        this.subtasks.update((list) => list.filter((s) => s.id !== subtask.id));
        this.progress.update((p) => ({
          completed: subtask.is_completed ? p.completed - 1 : p.completed,
          total: p.total - 1,
        }));

        this.subtaskService.promote(subtask.id).subscribe({
          error: () => {
            this.subtasks.set(snapshot);
            this.progress.set(snapshotProgress);
            this.showError('Failed to promote subtask');
          },
        });
      },
    });
  }

  onReorder(event: CdkDragDrop<SubtaskWithAssignee[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const items = [...this.subtasks()];
    const movedItem = items[event.previousIndex];

    // Optimistic reorder
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.subtasks.set(items);

    // Calculate new fractional position
    const prevPos =
      event.currentIndex > 0 ? items[event.currentIndex - 1].position : null;
    const nextPos =
      event.currentIndex < items.length - 1
        ? items[event.currentIndex + 1].position
        : null;

    const newPosition = generateKeyBetween(prevPos, nextPos);

    this.subtaskService.reorder(movedItem.id, newPosition).subscribe({
      next: (updated) => {
        this.subtasks.update((list) =>
          list.map((s) =>
            s.id === updated.id ? { ...s, position: updated.position } : s,
          ),
        );
      },
      error: () => {
        // Revert on error
        this.loadSubtasks();
      },
    });
  }

  startEdit(subtask: SubtaskWithAssignee): void {
    this.editingId.set(subtask.id);
    this.editingTitle.set(subtask.title);
  }

  saveEdit(subtask: SubtaskWithAssignee): void {
    const newTitle = this.editingTitle().trim();
    if (!newTitle || newTitle === subtask.title) {
      this.cancelEdit();
      return;
    }

    const snapshot = this.subtasks();

    // Optimistic: update title locally
    this.subtasks.update((list) =>
      list.map((s) => (s.id === subtask.id ? { ...s, title: newTitle } : s)),
    );
    this.cancelEdit();

    this.subtaskService.update(subtask.id, { title: newTitle }).subscribe({
      next: (updated) => {
        this.subtasks.update((list) =>
          list.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
        );
      },
      error: () => {
        this.subtasks.set(snapshot);
        this.showError('Failed to update subtask');
      },
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingTitle.set('');
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatDueDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = date.getTime() - today.getTime();
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
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'text-red-600 dark:text-red-400 font-medium';
    if (diffDays === 0) return 'text-amber-600 dark:text-amber-400 font-medium';
    return 'text-[var(--muted-foreground)]';
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }

  private loadSubtasks(): void {
    this.loading.set(true);
    this.subtaskService.list(this.taskId()).subscribe({
      next: (response) => {
        this.subtasks.set(response.subtasks);
        this.progress.set(response.progress);
        this.loading.set(false);
      },
      error: () => {
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
