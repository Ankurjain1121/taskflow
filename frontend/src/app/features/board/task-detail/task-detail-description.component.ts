import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Textarea } from 'primeng/textarea';

@Component({
  selector: 'app-task-detail-description',
  standalone: true,
  imports: [CommonModule, FormsModule, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <label class="block text-sm font-medium text-gray-500 mb-1"
        >Description</label
      >
      @if (editing()) {
        <textarea
          pTextarea
          [ngModel]="draft()"
          (ngModelChange)="draft.set($event)"
          (blur)="onSave()"
          rows="6"
          class="w-full"
          placeholder="Add a description..."
          autofocus
        ></textarea>
        <div class="flex items-center gap-2 mt-2">
          <button
            (click)="onSave()"
            class="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary hover:brightness-90 rounded-md"
          >
            Save
          </button>
          <button
            (click)="onCancel()"
            class="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
        </div>
      } @else {
        <div
          (click)="startEditing()"
          class="min-h-[60px] px-3 py-2 rounded-md border border-transparent hover:border-gray-300 hover:bg-gray-50 cursor-text transition-colors"
        >
          @if (description()) {
            <p class="text-sm text-gray-700 whitespace-pre-wrap">
              {{ description() }}
            </p>
          } @else {
            <p class="text-sm text-gray-400 italic">
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
