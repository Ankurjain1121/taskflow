import {
  Component,
  inject,
  model,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

export interface CreateWorkspaceDialogResult {
  name: string;
  description?: string;
}

@Component({
  selector: 'app-create-workspace-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      [appendTo]="'body'"
      (onShow)="onDialogShow()"
    >
      <p class="text-sm text-[var(--muted-foreground)] mb-4">
        Workspaces help you organize your projects and collaborate with your
        team.
      </p>
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <!-- Workspace Name -->
        <div class="flex flex-col gap-1 mb-4">
          <label
            for="wsName"
            class="text-sm font-medium text-[var(--foreground)]"
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
            <small class="text-[var(--destructive)]">Workspace name is required</small>
          }
          @if (
            form.get('name')?.hasError('minlength') && form.get('name')?.touched
          ) {
            <small class="text-[var(--destructive)]"
              >Workspace name must be at least 2 characters</small
            >
          }
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-1">
          <label
            for="wsDescription"
            class="text-sm font-medium text-[var(--foreground)]"
            >Description (optional)</label
          >
          <textarea
            id="wsDescription"
            formControlName="description"
            placeholder="Describe what this workspace is for..."
            rows="3"
            class="w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-primary/50"
          ></textarea>
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
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100),
        CreateWorkspaceDialogComponent.noWhitespaceOnly,
      ],
    ],
    description: [''],
  });

  private static noWhitespaceOnly(
    control: AbstractControl,
  ): ValidationErrors | null {
    if (typeof control.value === 'string' && control.value.trim().length === 0) {
      return { whitespace: true };
    }
    return null;
  }

  isSubmitting = false;

  onDialogShow(): void {
    this.form.reset({ name: '', description: '' });
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

    if (this.form.value.description?.trim()) {
      result.description = this.form.value.description.trim();
    }

    this.visible.set(false);
    this.created.emit(result);
  }
}
