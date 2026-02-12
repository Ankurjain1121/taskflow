import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

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
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Create Task Group</h2>

    <mat-dialog-content class="!py-4">
      <div class="space-y-4">
        <!-- Group name -->
        <mat-form-field class="w-full" appearance="outline">
          <mat-label>Group Name</mat-label>
          <input
            matInput
            [(ngModel)]="groupName"
            placeholder="e.g., Frontend Tasks"
            autofocus
            (keydown.enter)="onCreate()"
          />
        </mat-form-field>

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
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="!groupName.trim()"
        (click)="onCreate()"
      >
        Create Group
      </button>
    </mat-dialog-actions>
  `,
})
export class CreateTaskGroupDialogComponent {
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

  constructor(
    private dialogRef: MatDialogRef<CreateTaskGroupDialogComponent, CreateTaskGroupDialogResult>
  ) {}

  onCreate() {
    if (!this.groupName.trim()) {
      return;
    }

    this.dialogRef.close({
      name: this.groupName.trim(),
      color: this.selectedColor(),
    });
  }

  onCancel() {
    this.dialogRef.close();
  }
}
