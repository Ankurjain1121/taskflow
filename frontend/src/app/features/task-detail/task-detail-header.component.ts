import {
  Component,
  input,
  output,
  signal,
  inject,
  Injector,
  ChangeDetectionStrategy,
  afterNextRender,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';

@Component({
  selector: 'app-task-detail-header',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .field-editable {
        cursor: pointer;
        padding: 0.25rem 0.5rem;
        margin: 0 -0.5rem;
        border-radius: 0.375rem;
        transition: background 0.15s;
      }
      .field-editable:hover {
        background: var(--surface-hover, rgba(0, 0, 0, 0.04));
      }
      .field-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--muted-foreground);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.25rem;
      }
    `,
  ],
  template: `
    <div class="p-5 pb-4">
      @if (editingField() === 'title') {
        <div data-edit-field="title">
          <input
            pInputText
            type="text"
            [ngModel]="editTitle()"
            (ngModelChange)="editTitle.set($event)"
            (blur)="saveTitle(); stopEditing()"
            (keydown.escape)="cancelEditing('title')"
            (keydown.enter)="$any($event.target).blur()"
            class="w-full text-xl font-bold border-0 p-0"
            style="
              background: transparent;
              color: var(--foreground);
            "
            placeholder="Task title"
          />
        </div>
      } @else {
        <h1
          (click)="startEditing('title')"
          class="text-xl font-bold field-editable m-0"
          style="color: var(--foreground)"
        >
          {{ editTitle() || 'Untitled' }}
        </h1>
      }
    </div>

    <div class="px-5 pb-5">
      <label class="field-label">Description</label>
      @if (editingField() === 'description') {
        <div data-edit-field="description">
          <textarea
            pTextarea
            [ngModel]="editDescription()"
            (ngModelChange)="editDescription.set($event)"
            (blur)="saveDescription(); stopEditing()"
            (keydown.escape)="cancelEditing('description')"
            rows="4"
            class="w-full mt-1"
            placeholder="Add a description..."
            [autoResize]="true"
          ></textarea>
        </div>
      } @else {
        <div
          (click)="startEditing('description')"
          class="field-editable mt-1 text-sm whitespace-pre-wrap"
          style="color: var(--foreground); min-height: 2rem;"
        >
          @if (editDescription()) {
            {{ editDescription() }}
          } @else {
            <span
              style="
                color: var(--muted-foreground);
                font-style: italic;
              "
              >Click to add a description...</span
            >
          }
        </div>
      }
    </div>
  `,
})
export class TaskDetailHeaderComponent {
  private injector = inject(Injector);

  /** Current task title — synced from parent whenever task updates */
  readonly title = input.required<string>();
  /** Current task description — synced from parent whenever task updates */
  readonly description = input.required<string>();

  /** Emits new title when user saves */
  readonly titleSaved = output<string>();
  /** Emits new description when user saves */
  readonly descriptionSaved = output<string>();

  editTitle = signal('');
  editDescription = signal('');
  editingField = signal<string | null>(null);

  constructor() {
    // Keep local edit signals in sync with parent inputs
    // (unless the user is actively editing that field)
    effect(() => {
      const t = this.title();
      if (this.editingField() !== 'title') {
        this.editTitle.set(t);
      }
    });
    effect(() => {
      const d = this.description();
      if (this.editingField() !== 'description') {
        this.editDescription.set(d);
      }
    });
  }

  /** Whether the user is actively editing a field */
  get isEditing(): boolean {
    return this.editingField() !== null;
  }

  startEditing(field: string): void {
    this.editingField.set(field);
    afterNextRender(
      () => {
        const wrapper = document.querySelector(`[data-edit-field="${field}"]`);
        if (!wrapper) return;
        const el = wrapper.querySelector('input, textarea') as HTMLElement;
        el?.focus();
      },
      { injector: this.injector },
    );
  }

  stopEditing(): void {
    this.editingField.set(null);
  }

  cancelEditing(field: string): void {
    if (field === 'title') this.editTitle.set(this.title());
    if (field === 'description') this.editDescription.set(this.description());
    this.editingField.set(null);
  }

  saveTitle(): void {
    if (this.editTitle() !== this.title()) {
      this.titleSaved.emit(this.editTitle());
    }
  }

  saveDescription(): void {
    const newDesc = this.editDescription() || '';
    if (newDesc !== this.description()) {
      this.descriptionSaved.emit(newDesc);
    }
  }
}
