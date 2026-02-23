import {
  Component,
  inject,
  signal,
  model,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import {
  WorkspaceService,
  Workspace,
} from '../../../core/services/workspace.service';

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
    TextareaModule,
  ],
  template: `
    <p-dialog
      header="Create Workspace"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '460px' }"
      [closable]="true"
      (onShow)="onDialogShow()"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label
            for="wsName"
            class="text-sm font-medium text-[var(--card-foreground)]"
            >Name</label
          >
          <input
            pInputText
            id="wsName"
            formControlName="name"
            placeholder="e.g., Marketing, Engineering"
            class="w-full"
          />
          @if (
            form.controls.name.hasError('required') &&
            form.controls.name.touched
          ) {
            <small class="text-red-500">Name is required</small>
          }
        </div>

        <div class="flex flex-col gap-1">
          <label
            for="wsDesc"
            class="text-sm font-medium text-[var(--card-foreground)]"
            >Description (optional)</label
          >
          <textarea
            pTextarea
            id="wsDesc"
            formControlName="description"
            placeholder="What is this workspace for?"
            [rows]="3"
            class="w-full"
          ></textarea>
        </div>
      </form>

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="visible.set(false)"
          />
          <p-button
            label="Create"
            (onClick)="onSave()"
            [disabled]="form.invalid || saving()"
            [loading]="saving()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class CreateWorkspaceDialogComponent {
  private fb = inject(FormBuilder);
  private workspaceService = inject(WorkspaceService);

  visible = model(false);
  created = output<Workspace>();
  saving = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
  });

  onDialogShow(): void {
    this.form.reset({ name: '', description: '' });
  }

  onSave(): void {
    if (this.form.invalid) return;
    this.saving.set(true);

    const values = this.form.getRawValue();
    this.workspaceService
      .create({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
      })
      .subscribe({
        next: (ws) => {
          this.saving.set(false);
          this.visible.set(false);
          this.created.emit(ws);
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }
}
