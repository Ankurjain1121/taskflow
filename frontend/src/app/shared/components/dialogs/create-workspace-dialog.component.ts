import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface CreateWorkspaceDialogResult {
  name: string;
  slug?: string;
}

@Component({
  selector: 'app-create-workspace-dialog',
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
    <h2 mat-dialog-title>Create New Workspace</h2>
    <mat-dialog-content>
      <p class="text-sm text-gray-500 mb-4">
        Workspaces help you organize your projects and collaborate with your team.
      </p>
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="w-full mb-4">
          <mat-label>Workspace Name</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="e.g., Marketing Team"
            maxlength="100"
          />
          @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
            <mat-error>Workspace name is required</mat-error>
          }
          @if (form.get('name')?.hasError('minlength') && form.get('name')?.touched) {
            <mat-error>Workspace name must be at least 2 characters</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>URL Slug (optional)</mat-label>
          <input
            matInput
            formControlName="slug"
            placeholder="e.g., marketing-team"
            maxlength="50"
          />
          <mat-hint>Letters, numbers, and hyphens only</mat-hint>
          @if (form.get('slug')?.hasError('pattern') && form.get('slug')?.touched) {
            <mat-error>Slug can only contain letters, numbers, and hyphens</mat-error>
          }
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
          Create Workspace
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
export class CreateWorkspaceDialogComponent {
  private dialogRef = inject(MatDialogRef<CreateWorkspaceDialogComponent>);
  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    slug: ['', [Validators.maxLength(50), Validators.pattern(/^[a-z0-9-]*$/)]],
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

    const result: CreateWorkspaceDialogResult = {
      name: this.form.value.name.trim(),
    };

    if (this.form.value.slug?.trim()) {
      result.slug = this.form.value.slug.trim().toLowerCase();
    }

    this.dialogRef.close(result);
  }
}
