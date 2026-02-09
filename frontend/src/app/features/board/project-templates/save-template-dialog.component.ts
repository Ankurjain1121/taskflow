import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  ProjectTemplateService,
  SaveAsTemplateRequest,
} from '../../../core/services/project-template.service';

export interface SaveTemplateDialogData {
  boardId: string;
  boardName: string;
}

export interface SaveTemplateDialogResult {
  templateId: string;
}

const TEMPLATE_CATEGORIES = [
  'Software Development',
  'Marketing',
  'Design',
  'Operations',
  'HR',
  'Sales',
  'Project Management',
  'Other',
];

@Component({
  selector: 'app-save-template-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Save Board as Template</h2>
    <mat-dialog-content class="min-w-[440px]">
      <p class="text-gray-600 mb-4">
        Save "{{ data.boardName }}" as a reusable template. The template will
        include all columns and tasks.
      </p>
      <form [formGroup]="form" class="flex flex-col gap-4">
        <mat-form-field appearance="outline">
          <mat-label>Template Name</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="e.g. Sprint Board Template"
          />
          @if (form.controls['name'].hasError('required')) {
            <mat-error>Name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea
            matInput
            formControlName="description"
            rows="3"
            placeholder="Describe what this template is for..."
          ></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select formControlName="category">
            <mat-option [value]="null">None</mat-option>
            @for (cat of categories; track cat) {
              <mat-option [value]="cat">{{ cat }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </form>

      @if (errorMessage()) {
        <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {{ errorMessage() }}
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()" [disabled]="saving()">
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="form.invalid || saving()"
        (click)="onSave()"
      >
        @if (saving()) {
          <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
          Saving...
        } @else {
          Save as Template
        }
      </button>
    </mat-dialog-actions>
  `,
})
export class SaveTemplateDialogComponent {
  data = inject<SaveTemplateDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<SaveTemplateDialogComponent>);
  private fb = inject(FormBuilder);
  private templateService = inject(ProjectTemplateService);

  categories = TEMPLATE_CATEGORIES;
  saving = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    name: [this.data.boardName + ' Template', Validators.required],
    description: [''],
    category: [null as string | null],
  });

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onSave(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const request: SaveAsTemplateRequest = {
      name: this.form.value.name!,
      description: this.form.value.description || undefined,
      category: this.form.value.category || undefined,
    };

    this.templateService
      .saveBoardAsTemplate(this.data.boardId, request)
      .subscribe({
        next: (template) => {
          this.saving.set(false);
          this.dialogRef.close({
            templateId: template.id,
          } as SaveTemplateDialogResult);
        },
        error: (err) => {
          console.error('Failed to save template:', err);
          this.errorMessage.set(
            'Failed to save board as template. Please try again.'
          );
          this.saving.set(false);
        },
      });
  }
}
