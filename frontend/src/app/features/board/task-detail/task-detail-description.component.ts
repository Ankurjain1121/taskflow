import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RichTextEditorComponent } from '../../../shared/components/rich-text-editor/rich-text-editor.component';

@Component({
  selector: 'app-task-detail-description',
  standalone: true,
  imports: [CommonModule, RichTextEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <label
        class="block text-sm font-medium text-[var(--muted-foreground)] mb-1"
        >Description</label
      >
      @if (editing()) {
        <app-rich-text-editor
          [content]="draft()"
          placeholder="Add a description..."
          (contentChanged)="draft.set($event)"
        />
        <div class="flex items-center gap-2 mt-2">
          <button
            (click)="onSave()"
            class="px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] bg-[var(--primary)] hover:opacity-90 rounded-md"
          >
            Save
          </button>
          <button
            (click)="onCancel()"
            class="px-3 py-1.5 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-md"
          >
            Cancel
          </button>
        </div>
      } @else {
        <div
          (click)="startEditing()"
          class="min-h-[60px] px-3 py-2 rounded-md border border-transparent hover:border-[var(--border)] hover:bg-[var(--muted)] cursor-text transition-colors"
        >
          @if (description()) {
            <app-rich-text-editor
              [content]="description()!"
              [readonly]="true"
            />
          } @else {
            <p class="text-sm text-[var(--muted-foreground)] italic">
              Click to add a description...
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class TaskDetailDescriptionComponent {
  description = input<string | null>(null);

  descriptionChanged = output<string>();

  editing = signal(false);
  draft = signal('');

  startEditing(): void {
    this.draft.set(this.description() || '');
    this.editing.set(true);
  }

  onSave(): void {
    const newDesc = this.draft();
    if (newDesc !== (this.description() || '')) {
      this.descriptionChanged.emit(newDesc);
    }
    this.editing.set(false);
  }

  onCancel(): void {
    this.editing.set(false);
    this.draft.set('');
  }
}
