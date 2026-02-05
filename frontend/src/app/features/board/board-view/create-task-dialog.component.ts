import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { TaskPriority } from '../../../core/services/task.service';

export interface CreateTaskDialogData {
  columnId: string;
  columnName: string;
}

export interface CreateTaskDialogResult {
  title: string;
  description?: string;
  priority: TaskPriority;
  due_date?: string;
}

@Component({
  selector: 'app-create-task-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  template: `
    <h2 mat-dialog-title>Create New Task</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="flex flex-col gap-4">
        <!-- Column info -->
        <p class="text-sm text-gray-500">
          Adding to column: <span class="font-medium">{{ data.columnName }}</span>
        </p>

        <!-- Title -->
        <mat-form-field appearance="outline">
          <mat-label>Title</mat-label>
          <input
            matInput
            formControlName="title"
            placeholder="Enter task title"
            cdkFocusInitial
          />
          @if (form.controls.title.hasError('required')) {
            <mat-error>Title is required</mat-error>
          }
          @if (form.controls.title.hasError('maxlength')) {
            <mat-error>Title must be less than 200 characters</mat-error>
          }
        </mat-form-field>

        <!-- Description -->
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea
            matInput
            formControlName="description"
            placeholder="Enter task description (optional)"
            rows="3"
          ></textarea>
        </mat-form-field>

        <!-- Priority -->
        <mat-form-field appearance="outline">
          <mat-label>Priority</mat-label>
          <mat-select formControlName="priority">
            @for (priority of priorities; track priority.value) {
              <mat-option [value]="priority.value">
                <div class="flex items-center gap-2">
                  <span
                    class="w-2 h-2 rounded-full"
                    [style.background-color]="priority.color"
                  ></span>
                  {{ priority.label }}
                </div>
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <!-- Due Date -->
        <mat-form-field appearance="outline">
          <mat-label>Due Date</mat-label>
          <input
            matInput
            [matDatepicker]="picker"
            formControlName="dueDate"
            placeholder="Select a due date (optional)"
          />
          <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>
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
          Create Task
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
export class CreateTaskDialogComponent {
  data = inject<CreateTaskDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<CreateTaskDialogComponent>);
  private fb = inject(FormBuilder);

  saving = signal(false);

  priorities = [
    { value: 'low', label: 'Low', color: '#60a5fa' },
    { value: 'medium', label: 'Medium', color: '#facc15' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'urgent', label: 'Urgent', color: '#ef4444' },
  ];

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    priority: ['medium' as TaskPriority],
    dueDate: [null as Date | null],
  });

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.form.invalid) return;

    const values = this.form.getRawValue();
    const result: CreateTaskDialogResult = {
      title: values.title.trim(),
      priority: values.priority,
    };

    if (values.description?.trim()) {
      result.description = values.description.trim();
    }

    if (values.dueDate) {
      result.due_date = values.dueDate.toISOString().split('T')[0];
    }

    this.dialogRef.close(result);
  }
}
