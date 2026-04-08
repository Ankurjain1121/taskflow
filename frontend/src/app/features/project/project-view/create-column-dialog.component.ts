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
import { Checkbox } from 'primeng/checkbox';

import { COLUMN_HEADER_COLORS } from '../../../shared/utils/task-colors';

export interface CreateColumnDialogResult {
  name: string;
  color: string;
  isDone: boolean;
}

@Component({
  selector: 'app-create-column-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    Dialog,
    InputTextModule,
    Checkbox,
  ],
  template: `
    <p-dialog
      header="Create New Column"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '460px' }"
      [closable]="true"
      (onShow)="onDialogShow()"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <!-- Name -->
        <div class="flex flex-col gap-1">
          <label
            for="colName"
            class="text-sm font-medium text-[var(--foreground)]"
            >Column Name</label
          >
          <input
            pInputText
            id="colName"
            formControlName="name"
            placeholder="e.g., In Progress, Review, Done"
            class="w-full"
          />
          @if (
            form.controls.name.hasError('required') &&
            form.controls.name.touched
          ) {
            <small class="text-[var(--destructive)]">Column name is required</small>
          }
          @if (form.controls.name.hasError('maxlength')) {
            <small class="text-[var(--destructive)]"
              >Name must be less than 50 characters</small
            >
          }
        </div>

        <!-- Color Picker -->
        <div>
          <label
            class="block text-sm font-medium text-[var(--foreground)] mb-2"
          >
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
                [class.ring-ring]="selectedColor() === color"
              ></button>
            }
          </div>
        </div>

        <!-- Done Column Checkbox -->
        <div class="pt-2 flex items-center gap-2">
          <p-checkbox
            formControlName="isDone"
            [binary]="true"
            inputId="isDoneCol"
          />
          <label for="isDoneCol" class="text-sm cursor-pointer">
            Mark as "Done" column
            <span class="text-[var(--muted-foreground)] ml-1">
              (Tasks moved here are considered completed)
            </span>
          </label>
        </div>
      </form>

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="onCancel()"
          />
          <p-button
            label="Create Column"
            (onClick)="onSave()"
            [disabled]="form.invalid || saving()"
            [loading]="saving()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class CreateColumnDialogComponent {
  private fb = inject(FormBuilder);

  /** Two-way bound visibility */
  visible = model(false);

  /** Emits result when dialog closes with a value */
  created = output<CreateColumnDialogResult>();

  saving = signal(false);
  selectedColor = signal(COLUMN_HEADER_COLORS[0]);
  availableColors = COLUMN_HEADER_COLORS;

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(50)]],
    isDone: [false],
  });

  onDialogShow(): void {
    this.form.reset({ name: '', isDone: false });
    this.selectedColor.set(COLUMN_HEADER_COLORS[0]);
  }

  selectColor(color: string): void {
    this.selectedColor.set(color);
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onSave(): void {
    if (this.form.invalid) return;

    const values = this.form.getRawValue();
    const result: CreateColumnDialogResult = {
      name: values.name.trim(),
      color: this.selectedColor(),
      isDone: values.isDone,
    };

    this.visible.set(false);
    this.created.emit(result);
  }
}
