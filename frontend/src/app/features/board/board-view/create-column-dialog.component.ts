import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { COLUMN_HEADER_COLORS } from '../../../shared/utils/task-colors';

export interface CreateColumnDialogResult {
  name: string;
  color: string;
  isDone: boolean;
}

@Component({
  selector: 'app-create-column-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
  ],
  template: `
    <h2 mat-dialog-title>Create New Column</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="flex flex-col gap-4">
        <!-- Name -->
        <mat-form-field appearance="outline">
          <mat-label>Column Name</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="e.g., In Progress, Review, Done"
            cdkFocusInitial
          />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Column name is required</mat-error>
          }
          @if (form.controls.name.hasError('maxlength')) {
            <mat-error>Name must be less than 50 characters</mat-error>
          }
        </mat-form-field>

        <!-- Color Picker -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Column Color
          </label>
          <div class="flex flex-wrap gap-2">
            @for (color of availableColors; track color) {
              <button
                type="button"
                (click)="selectColor(color)"
                class="w-8 h-8 rounded-md transition-all"
                [style.background-color]="color"
                [class.ring-2]="selectedColor() === color"
                [class.ring-offset-2]="selectedColor() === color"
                [class.ring-indigo-500]="selectedColor() === color"
              ></button>
            }
          </div>
        </div>

        <!-- Done Column Checkbox -->
        <div class="pt-2">
          <mat-checkbox formControlName="isDone">
            <span class="text-sm">
              Mark as "Done" column
              <span class="text-gray-500 ml-1">
                (Tasks moved here are considered completed)
              </span>
            </span>
          </mat-checkbox>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="form.invalid || saving()"
        (click)="onSave()"
      >
        @if (saving()) {
          <span class="flex items-center gap-2">
            <svg
              class="animate-spin h-4 w-4"
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
            Creating...
          </span>
        } @else {
          Create Column
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 400px;
      }
    `,
  ],
})
export class CreateColumnDialogComponent {
  private dialogRef = inject(MatDialogRef<CreateColumnDialogComponent>);
  private fb = inject(FormBuilder);

  saving = signal(false);
  selectedColor = signal(COLUMN_HEADER_COLORS[0]);
  availableColors = COLUMN_HEADER_COLORS;

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(50)]],
    isDone: [false],
  });

  selectColor(color: string): void {
    this.selectedColor.set(color);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.form.invalid) return;

    const values = this.form.getRawValue();
    const result: CreateColumnDialogResult = {
      name: values.name.trim(),
      color: this.selectedColor(),
      isDone: values.isDone,
    };

    this.dialogRef.close(result);
  }
}
