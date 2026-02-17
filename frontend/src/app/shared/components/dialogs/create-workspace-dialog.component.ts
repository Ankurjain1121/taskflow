import { Component, inject, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

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
    ButtonModule,
    Dialog,
    InputTextModule,
  ],
  template: `
    <p-dialog
      header="Create New Workspace"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '460px' }"
      [closable]="true"
      (onShow)="onDialogShow()"
    >
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Workspaces help you organize your projects and collaborate with your
        team.
      </p>
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <!-- Workspace Name -->
        <div class="flex flex-col gap-1 mb-4">
          <label
            for="wsName"
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >Workspace Name</label
          >
          <input
            pInputText
            id="wsName"
            formControlName="name"
            placeholder="e.g., Marketing Team"
            maxlength="100"
            class="w-full"
          />
          @if (
            form.get('name')?.hasError('required') && form.get('name')?.touched
          ) {
            <small class="text-red-500">Workspace name is required</small>
          }
          @if (
            form.get('name')?.hasError('minlength') && form.get('name')?.touched
          ) {
            <small class="text-red-500"
              >Workspace name must be at least 2 characters</small
            >
          }
        </div>

        <!-- URL Slug -->
        <div class="flex flex-col gap-1">
          <label
            for="wsSlug"
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >URL Slug (optional)</label
          >
          <input
            pInputText
            id="wsSlug"
            formControlName="slug"
            placeholder="e.g., marketing-team"
            maxlength="50"
            class="w-full"
          />
          <small class="text-gray-500 dark:text-gray-400"
            >Letters, numbers, and hyphens only</small
          >
          @if (
            form.get('slug')?.hasError('pattern') && form.get('slug')?.touched
          ) {
            <small class="text-red-500"
              >Slug can only contain letters, numbers, and hyphens</small
            >
          }
        </div>
      </form>

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="onCancel()"
            [disabled]="isSubmitting"
          />
          <p-button
            label="Create Workspace"
            (onClick)="onSubmit()"
            [disabled]="form.invalid || isSubmitting"
            [loading]="isSubmitting"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class CreateWorkspaceDialogComponent {
  private fb = inject(FormBuilder);

  /** Two-way bound visibility */
  visible = model(false);

  /** Emits result when dialog closes with a value */
  created = output<CreateWorkspaceDialogResult>();

  form: FormGroup = this.fb.group({
    name: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    ],
    slug: ['', [Validators.maxLength(50), Validators.pattern(/^[a-z0-9-]*$/)]],
  });

  isSubmitting = false;

  onDialogShow(): void {
    this.form.reset({ name: '', slug: '' });
  }

  onCancel(): void {
    this.visible.set(false);
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

    this.visible.set(false);
    this.created.emit(result);
  }
}
