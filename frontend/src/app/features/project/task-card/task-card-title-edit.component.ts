import {
  Component,
  ElementRef,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Task } from '../../../core/services/task.service';

@Component({
  selector: 'app-task-card-title-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!isEditing()) {
      <div class="flex items-start gap-1.5 group/title mb-2.5">
        <h4
          class="text-sm font-semibold text-[var(--card-foreground)] line-clamp-2 leading-snug tracking-tight flex-1 min-w-0"
        >
          {{ task().title }}
        </h4>
        <button
          (click)="onEditStart($event)"
          class="flex-shrink-0 mt-0.5 opacity-0 group-hover/title:opacity-100 transition-opacity duration-150 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          title="Edit title"
          aria-label="Edit task title"
        >
          <i class="pi pi-pencil text-xs"></i>
        </button>
      </div>
    }
    @if (isEditing()) {
      <input
        #titleInput
        type="text"
        [value]="editValue()"
        (input)="onInput($event)"
        (blur)="onSave()"
        (keydown.enter)="onSave()"
        (keydown.escape)="onCancel()"
        (click)="$event.stopPropagation()"
        maxlength="200"
        aria-label="Edit task title"
        class="w-full text-sm font-semibold mb-2.5
               bg-[var(--card)] text-[var(--card-foreground)]
               border border-[var(--border)] rounded-md px-2 py-1
               focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0
               transition-shadow duration-150"
      />
    }
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
export class TaskCardTitleEditComponent {
  task = input.required<Task>();
  isEditing = input<boolean>(false);

  titleChanged = output<{ taskId: string; title: string }>();
  editStarted = output<void>();
  editCancelled = output<void>();

  editValue = signal('');
  titleInput = viewChild<ElementRef>('titleInput');
  private isSaving = false;

  onEditStart(event: MouseEvent): void {
    event.stopPropagation();
    this.isSaving = false;
    this.editValue.set(this.task().title);
    this.editStarted.emit();
    setTimeout(() => {
      const el = this.titleInput()?.nativeElement as
        | HTMLInputElement
        | undefined;
      el?.select();
    }, 0);
  }

  onInput(event: Event): void {
    this.editValue.set((event.target as HTMLInputElement).value);
  }

  onSave(): void {
    if (this.isSaving) return;
    const newTitle = this.editValue().trim();
    if (!newTitle) {
      this.onCancel();
      return;
    }
    if (newTitle !== this.task().title) {
      this.isSaving = true;
      this.titleChanged.emit({ taskId: this.task().id, title: newTitle });
    }
    this.editCancelled.emit();
  }

  onCancel(): void {
    this.isSaving = false;
    this.editCancelled.emit();
  }
}
