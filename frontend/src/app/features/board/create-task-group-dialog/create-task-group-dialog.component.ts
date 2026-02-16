import {
  Component,
  signal,
  model,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

export interface CreateTaskGroupDialogResult {
  name: string;
  color: string;
}

@Component({
  selector: 'app-create-task-group-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    Dialog,
    InputTextModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="Create Task Group"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '460px' }"
      [closable]="true"
      (onShow)="onDialogShow()"
    >
      <div class="space-y-4">
        <!-- Group name -->
        <div class="flex flex-col gap-1">
          <label for="groupName" class="text-sm font-medium text-gray-700">Group Name</label>
          <input
            pInputText
            id="groupName"
            [(ngModel)]="groupName"
            placeholder="e.g., Frontend Tasks"
            class="w-full"
            (keydown.enter)="onCreate()"
          />
        </div>

        <!-- Color selection -->
        <div>
          <div class="text-sm font-medium text-gray-700 mb-2">Color</div>
          <div class="grid grid-cols-7 gap-2">
            @for (color of predefinedColors; track color) {
              <button
                type="button"
                (click)="selectedColor.set(color)"
                [style.background-color]="color"
                class="w-10 h-10 rounded-full border-2 hover:scale-110 transition-transform"
                [class.ring-2]="selectedColor() === color"
                [class.ring-offset-2]="selectedColor() === color"
                [class.ring-gray-800]="selectedColor() === color"
              >
              </button>
            }
          </div>
        </div>

        <!-- Preview -->
        <div class="mt-4 p-3 rounded-lg border" [style.border-color]="selectedColor()">
          <div class="flex items-center gap-2">
            <div
              class="w-3 h-3 rounded-full"
              [style.background-color]="selectedColor()"
            ></div>
            <div class="text-sm font-medium" [style.color]="selectedColor()">
              {{ groupName || 'New Group' }}
            </div>
          </div>
        </div>
      </div>

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="onCancel()"
          />
          <p-button
            label="Create Group"
            (onClick)="onCreate()"
            [disabled]="!groupName.trim()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class CreateTaskGroupDialogComponent {
  /** Two-way bound visibility */
  visible = model(false);

  /** Output event replacing MatDialogRef.close(result) */
  created = output<CreateTaskGroupDialogResult>();

  groupName = '';
  selectedColor = signal('#6366f1');

  predefinedColors = [
    '#6366f1', // Indigo
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#84cc16', // Lime
    '#22c55e', // Green
    '#10b981', // Emerald
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#64748b', // Slate
    '#6b7280', // Gray
  ];

  onDialogShow(): void {
    this.groupName = '';
    this.selectedColor.set('#6366f1');
  }

  onCreate(): void {
    if (!this.groupName.trim()) {
      return;
    }

    const result: CreateTaskGroupDialogResult = {
      name: this.groupName.trim(),
      color: this.selectedColor(),
    };

    this.visible.set(false);
    this.created.emit(result);
  }

  onCancel(): void {
    this.visible.set(false);
  }
}
