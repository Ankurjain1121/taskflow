import {
  Component,
  inject,
  signal,
  input,
  output,
  model,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';

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
    ButtonModule,
    Dialog,
    InputTextModule,
    Textarea,
    Select,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="Save Project as Template"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '500px' }"
      [closable]="true"
      (onShow)="onDialogShow()"
    >
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Save "{{ boardName() }}" as a reusable template. The template will
        include all columns and tasks.
      </p>
      <form [formGroup]="form" class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label
            for="templateName"
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >Template Name</label
          >
          <input
            pInputText
            id="templateName"
            formControlName="name"
            placeholder="e.g. Sprint Project Template"
            class="w-full"
          />
          @if (
            form.controls['name'].hasError('required') &&
            form.controls['name'].touched
          ) {
            <small class="text-red-500">Name is required</small>
          }
        </div>

        <div class="flex flex-col gap-1">
          <label
            for="templateDesc"
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >Description</label
          >
          <textarea
            pTextarea
            id="templateDesc"
            formControlName="description"
            rows="3"
            placeholder="Describe what this template is for..."
            class="w-full"
          ></textarea>
        </div>

        <div class="flex flex-col gap-1">
          <label
            for="templateCategory"
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >Category</label
          >
          <p-select
            id="templateCategory"
            formControlName="category"
            [options]="categoryOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select a category"
            class="w-full"
            styleClass="w-full"
            [showClear]="true"
          />
        </div>
      </form>

      @if (errorMessage()) {
        <div
          class="mt-2 p-3 rounded text-sm"
          style="
            background: var(--status-red-bg);
            border: 1px solid var(--status-red-border);
            color: var(--status-red-text);
          "
        >
          {{ errorMessage() }}
        </div>
      }

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="onCancel()"
            [disabled]="saving()"
          />
          <p-button
            label="Save as Template"
            (onClick)="onSave()"
            [disabled]="form.invalid || saving()"
            [loading]="saving()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class SaveTemplateDialogComponent {
  private fb = inject(FormBuilder);
  private templateService = inject(ProjectTemplateService);

  /** Two-way bound visibility */
  visible = model(false);

  /** Input data for the dialog */
  boardId = input<string>('');
  boardName = input<string>('');

  /** Emits result when dialog closes with a value */
  saved = output<SaveTemplateDialogResult>();

  categoryOptions = TEMPLATE_CATEGORIES.map((cat) => ({
    label: cat,
    value: cat,
  }));

  saving = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    category: [null as string | null],
  });

  onDialogShow(): void {
    this.form.reset({
      name: this.boardName() + ' Template',
      description: '',
      category: null,
    });
    this.errorMessage.set(null);
  }

  onCancel(): void {
    this.visible.set(false);
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
      .saveBoardAsTemplate(this.boardId(), request)
      .subscribe({
        next: (template) => {
          this.saving.set(false);
          this.visible.set(false);
          this.saved.emit({ templateId: template.id });
        },
        error: () => {
          this.errorMessage.set(
            'Failed to save board as template. Please try again.',
          );
          this.saving.set(false);
        },
      });
  }
}
