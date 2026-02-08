import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { HttpClient } from '@angular/common/http';

export interface CreateBoardDialogData {
  workspaceId: string;
  workspaceName: string;
}

export interface CreateBoardDialogResult {
  name: string;
  description?: string;
  template?: string;
}

export interface BoardTemplateColumn {
  name: string;
  color: string;
  is_done: boolean;
}

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  columns: BoardTemplateColumn[];
}

@Component({
  selector: 'app-create-board-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
  ],
  template: `
    <h2 mat-dialog-title>Create New Board</h2>
    <mat-dialog-content>
      <p class="text-sm text-gray-500 mb-4">
        Create a new board in {{ data.workspaceName }}
      </p>
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="w-full mb-4">
          <mat-label>Board Name</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="e.g., Product Roadmap"
            maxlength="100"
          />
          @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
            <mat-error>Board name is required</mat-error>
          }
          @if (form.get('name')?.hasError('minlength') && form.get('name')?.touched) {
            <mat-error>Board name must be at least 2 characters</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full mb-4">
          <mat-label>Description (optional)</mat-label>
          <textarea
            matInput
            formControlName="description"
            placeholder="Describe the purpose of this board"
            rows="3"
            maxlength="500"
          ></textarea>
        </mat-form-field>

        <!-- Template Picker -->
        <div class="mb-2">
          <label class="text-sm font-medium text-gray-700 mb-3 block">
            Choose a template
          </label>

          @if (loadingTemplates()) {
            <div class="flex justify-center py-4">
              <mat-spinner diameter="24"></mat-spinner>
            </div>
          } @else {
            <mat-radio-group formControlName="template" class="flex flex-col gap-2">
              @for (template of templates(); track template.id) {
                <label
                  class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all"
                  [class.border-blue-500]="form.get('template')?.value === template.id"
                  [class.bg-blue-50]="form.get('template')?.value === template.id"
                  [class.border-gray-200]="form.get('template')?.value !== template.id"
                  [class.hover:border-gray-300]="form.get('template')?.value !== template.id"
                >
                  <mat-radio-button [value]="template.id" class="mt-0.5">
                  </mat-radio-button>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900 text-sm">
                      {{ template.name }}
                    </div>
                    <div class="text-xs text-gray-500 mt-0.5">
                      {{ template.description }}
                    </div>
                    @if (template.columns.length > 0) {
                      <div class="flex flex-wrap gap-1.5 mt-2">
                        @for (col of template.columns; track col.name) {
                          <span
                            class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200"
                          >
                            <span
                              class="w-2 h-2 rounded-full inline-block flex-shrink-0"
                              [style.background-color]="col.color"
                            ></span>
                            {{ col.name }}
                          </span>
                        }
                      </div>
                    } @else {
                      <div class="text-xs text-gray-400 mt-2 italic">
                        No predefined columns
                      </div>
                    }
                  </div>
                </label>
              }
            </mat-radio-group>
          }
        </div>

        <!-- Selected template preview -->
        @if (selectedTemplate() && selectedTemplate()!.columns.length > 0) {
          <div class="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div class="text-xs font-medium text-gray-600 mb-2">
              Column Preview
            </div>
            <div class="flex items-center gap-1 overflow-x-auto">
              @for (col of selectedTemplate()!.columns; track col.name; let last = $last) {
                <div class="flex items-center gap-1 flex-shrink-0">
                  <div
                    class="px-3 py-1.5 rounded text-xs font-medium text-white"
                    [style.background-color]="col.color"
                  >
                    {{ col.name }}
                  </div>
                  @if (!last) {
                    <svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  }
                </div>
              }
            </div>
          </div>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="gap-2">
      <button mat-button (click)="onCancel()" [disabled]="isSubmitting">
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        (click)="onSubmit()"
        [disabled]="form.invalid || isSubmitting"
      >
        @if (isSubmitting) {
          <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
          Creating...
        } @else {
          Create Board
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 480px;
        max-height: 70vh;
      }

      mat-spinner {
        display: inline-block;
        margin-right: 8px;
      }

      /* Hide the radio button ripple overflow */
      mat-radio-button {
        --mdc-radio-state-layer-size: 24px;
      }
    `,
  ],
})
export class CreateBoardDialogComponent implements OnInit {
  data = inject<CreateBoardDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<CreateBoardDialogComponent>);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  templates = signal<BoardTemplate[]>([]);
  loadingTemplates = signal(true);

  selectedTemplate = signal<BoardTemplate | null>(null);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    template: ['kanban'],
  });

  isSubmitting = false;

  ngOnInit(): void {
    this.loadTemplates();

    // Watch template selection changes
    this.form.get('template')?.valueChanges.subscribe((templateId: string) => {
      const found = this.templates().find((t) => t.id === templateId) || null;
      this.selectedTemplate.set(found);
    });
  }

  private loadTemplates(): void {
    this.loadingTemplates.set(true);
    this.http.get<BoardTemplate[]>('/api/board-templates').subscribe({
      next: (templates) => {
        this.templates.set(templates);
        // Set initial selected template
        const kanban = templates.find((t) => t.id === 'kanban') || null;
        this.selectedTemplate.set(kanban);
        this.loadingTemplates.set(false);
      },
      error: () => {
        // Fallback: use hardcoded defaults if API fails
        const fallback: BoardTemplate[] = [
          {
            id: 'blank',
            name: 'Blank Board',
            description: 'Start from scratch',
            columns: [],
          },
          {
            id: 'kanban',
            name: 'Basic Kanban',
            description: 'Simple To Do, In Progress, Done workflow',
            columns: [
              { name: 'To Do', color: '#6B7280', is_done: false },
              { name: 'In Progress', color: '#3B82F6', is_done: false },
              { name: 'Done', color: '#10B981', is_done: true },
            ],
          },
          {
            id: 'scrum',
            name: 'Scrum Board',
            description: 'Backlog through Done with review stage',
            columns: [
              { name: 'Backlog', color: '#6B7280', is_done: false },
              { name: 'Sprint', color: '#8B5CF6', is_done: false },
              { name: 'In Progress', color: '#3B82F6', is_done: false },
              { name: 'Review', color: '#F59E0B', is_done: false },
              { name: 'Done', color: '#10B981', is_done: true },
            ],
          },
        ];
        this.templates.set(fallback);
        const kanban = fallback.find((t) => t.id === 'kanban') || null;
        this.selectedTemplate.set(kanban);
        this.loadingTemplates.set(false);
      },
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const result: CreateBoardDialogResult = {
      name: this.form.value.name.trim(),
    };

    if (this.form.value.description?.trim()) {
      result.description = this.form.value.description.trim();
    }

    if (this.form.value.template) {
      result.template = this.form.value.template;
    }

    this.dialogRef.close(result);
  }
}
