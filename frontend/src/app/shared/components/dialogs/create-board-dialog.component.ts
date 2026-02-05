import { Component, inject } from '@angular/core';
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

export interface CreateBoardDialogData {
  workspaceId: string;
  workspaceName: string;
}

export interface CreateBoardDialogResult {
  name: string;
  description?: string;
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

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Description (optional)</mat-label>
          <textarea
            matInput
            formControlName="description"
            placeholder="Describe the purpose of this board"
            rows="3"
            maxlength="500"
          ></textarea>
        </mat-form-field>
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
        min-width: 400px;
      }

      mat-spinner {
        display: inline-block;
        margin-right: 8px;
      }
    `,
  ],
})
export class CreateBoardDialogComponent {
  data = inject<CreateBoardDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<CreateBoardDialogComponent>);
  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
  });

  isSubmitting = false;

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

    this.dialogRef.close(result);
  }
}
