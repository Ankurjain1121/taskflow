import {
  Component,
  input,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
  OnInit,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ProjectService,
  Board,
} from '../../../core/services/project.service';
import { MessageService } from 'primeng/api';
import { SaveTemplateDialogComponent } from '../project-templates/save-template-dialog.component';

@Component({
  selector: 'app-board-general-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SaveTemplateDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-8">
      <!-- General Settings -->
      <section class="animate-fade-in-up">
        <div class="bg-[var(--card)] shadow rounded-lg">
          <div class="px-6 py-4 border-b border-[var(--border)]">
            <h2 class="text-lg font-medium text-[var(--foreground)]">
              General
            </h2>
          </div>
          <form
            [formGroup]="form"
            (ngSubmit)="onSave()"
            class="px-6 py-4 space-y-4"
          >
            <div>
              <label
                for="name"
                class="block text-sm font-medium text-[var(--foreground)]"
                >Name</label
              >
              <input
                type="text"
                id="name"
                formControlName="name"
                class="mt-1 block w-full rounded-md border-[var(--border)] shadow-sm focus:border-primary focus:ring-ring sm:text-sm"
              />
              @if (
                form.controls['name'].invalid &&
                form.controls['name'].touched
              ) {
                <p class="mt-1 text-sm text-red-600">
                  Name is required
                </p>
              }
            </div>

            <div>
              <label
                for="description"
                class="block text-sm font-medium text-[var(--foreground)]"
                >Description</label
              >
              <textarea
                id="description"
                formControlName="description"
                rows="3"
                class="mt-1 block w-full rounded-md border-[var(--border)] shadow-sm focus:border-primary focus:ring-ring sm:text-sm"
                placeholder="Add a description for this board..."
              ></textarea>
            </div>

            <div class="flex justify-end pt-4">
              <button
                type="submit"
                [disabled]="saving() || form.invalid || !form.dirty"
                class="btn-press inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (saving()) {
                  <svg
                    class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                  Saving...
                } @else {
                  Save Changes
                }
              </button>
            </div>
          </form>
        </div>
      </section>

      <!-- Board Color -->
      <section class="animate-fade-in-up">
        <div class="bg-[var(--card)] shadow rounded-lg">
          <div class="px-6 py-4 border-b border-[var(--border)]">
            <h2 class="text-lg font-medium text-[var(--foreground)]">
              Project Color
            </h2>
          </div>
          <div class="px-6 py-4">
            <p class="text-sm text-[var(--muted-foreground)] mb-3">
              Choose a background color for this project.
            </p>
            <div class="flex flex-wrap items-center gap-2">
              @for (color of presetColors; track color) {
                <button
                  [style.background-color]="color"
                  class="w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                  [class.ring-2]="selectedColor() === color"
                  [class.ring-primary]="selectedColor() === color"
                  [class.ring-offset-2]="selectedColor() === color"
                  (click)="selectBoardColor(color)"
                  [title]="color"
                ></button>
              }
              <button
                class="w-8 h-8 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:border-[var(--foreground)] transition-colors"
                (click)="clearBoardColor()"
                title="Clear color"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>
            <p
              class="text-sm text-[var(--muted-foreground)] mb-2 mt-4"
            >
              Gradients
            </p>
            <div class="flex flex-wrap items-center gap-2">
              @for (gradient of presetGradients; track gradient) {
                <button
                  [style.background]="gradient"
                  class="w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                  [class.ring-2]="selectedColor() === gradient"
                  [class.ring-primary]="
                    selectedColor() === gradient
                  "
                  [class.ring-offset-2]="
                    selectedColor() === gradient
                  "
                  (click)="selectBoardColor(gradient)"
                  title="Gradient"
                ></button>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- Save as Template -->
      <section class="animate-fade-in-up">
        <div class="bg-[var(--card)] shadow rounded-lg">
          <div class="px-6 py-4 border-b border-[var(--border)]">
            <h2 class="text-lg font-medium text-[var(--foreground)]">
              Template
            </h2>
          </div>
          <div class="px-6 py-4">
            <div class="flex items-center justify-between">
              <div>
                <h3
                  class="text-sm font-medium text-[var(--foreground)]"
                >
                  Save Project as Template
                </h3>
                <p class="text-sm text-[var(--muted-foreground)]">
                  Save this project's structure as a reusable template
                  including all columns and tasks.
                </p>
              </div>
              <button
                (click)="showSaveTemplateDialog.set(true)"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors"
              >
                <i class="pi pi-copy"></i>
                Save as Template
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <app-save-template-dialog
      [(visible)]="showSaveTemplateDialog"
      [boardId]="boardId()"
      [boardName]="board()?.name || ''"
      (saved)="onTemplateSaved()"
    />
  `,
})
export class BoardGeneralSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private projectService = inject(ProjectService);
  private messageService = inject(MessageService);

  board = input<Board | null>(null);
  boardId = input.required<string>();

  boardUpdated = output<Board>();
  errorOccurred = output<string>();

  saving = signal(false);
  selectedColor = signal<string | null>(null);
  showSaveTemplateDialog = signal(false);

  readonly presetColors = [
    '#6366f1',
    '#3b82f6',
    '#06b6d4',
    '#22c55e',
    '#eab308',
    '#f97316',
    '#f43f5e',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#84cc16',
    '#a855f7',
    '#ef4444',
    '#0ea5e9',
    '#10b981',
    '#f59e0b',
  ];

  readonly presetGradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    'linear-gradient(135deg, #2af598 0%, #009efd 100%)',
  ];

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  private boardEffect = effect(() => {
    const b = this.board();
    if (b) {
      this.form.patchValue({
        name: b.name,
        description: b.description || '',
      });
      this.selectedColor.set(b.background_color ?? null);
    }
  });

  ngOnInit(): void {
    // Initial form setup handled by effect
  }

  onSave(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    const { name, description } = this.form.value;

    this.projectService
      .updateBoard(this.boardId(), { name, description })
      .subscribe({
        next: (updated) => {
          this.boardUpdated.emit(updated);
          this.form.markAsPristine();
          this.saving.set(false);
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }

  selectBoardColor(color: string): void {
    this.selectedColor.set(color);
    this.projectService
      .updateBoard(this.boardId(), { background_color: color })
      .subscribe({
        next: (updated) => {
          this.boardUpdated.emit(updated);
          this.messageService.add({
            severity: 'success',
            summary: 'Color Updated',
            detail: 'Board color has been updated.',
            life: 2000,
          });
        },
        error: () => this.errorOccurred.emit('Failed to update board color'),
      });
  }

  clearBoardColor(): void {
    this.selectedColor.set(null);
    this.projectService
      .updateBoard(this.boardId(), { background_color: null })
      .subscribe({
        next: (updated) => {
          this.boardUpdated.emit(updated);
          this.messageService.add({
            severity: 'success',
            summary: 'Color Cleared',
            detail: 'Board color has been removed.',
            life: 2000,
          });
        },
        error: () => this.errorOccurred.emit('Failed to clear board color'),
      });
  }

  onTemplateSaved(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Template Saved',
      detail: 'Board saved as template successfully.',
      life: 3000,
    });
  }
}
