import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { TaskGroupWithStats } from '../../../core/services/task-group.service';

@Component({
  selector: 'app-task-group-header',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatMenuModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-center justify-between px-4 py-2 mb-3 rounded-lg transition-colors"
      [style.background-color]="groupData().group.color + '15'"
      [style.border-left]="'3px solid ' + groupData().group.color"
    >
      <!-- Left: Collapse button + Name -->
      <div class="flex items-center gap-2 flex-1">
        <!-- Collapse toggle -->
        <button
          mat-icon-button
          (click)="onToggleCollapse()"
          [matTooltip]="groupData().group.collapsed ? 'Expand group' : 'Collapse group'"
          class="text-gray-600 hover:text-gray-900"
        >
          <mat-icon>
            {{ groupData().group.collapsed ? 'chevron_right' : 'expand_more' }}
          </mat-icon>
        </button>

        <!-- Group name (editable) -->
        @if (isEditing()) {
          <input
            type="text"
            [(ngModel)]="editedName"
            (blur)="saveNameEdit()"
            (keydown.enter)="saveNameEdit()"
            (keydown.escape)="cancelNameEdit()"
            class="px-2 py-1 text-sm font-semibold border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            [style.color]="groupData().group.color"
            autofocus
          />
        } @else {
          <div
            class="text-sm font-semibold cursor-pointer hover:underline"
            [style.color]="groupData().group.color"
            (dblclick)="startNameEdit()"
          >
            {{ groupData().group.name }}
          </div>
        }

        <!-- Stats badge -->
        <div class="flex items-center gap-2 text-xs text-gray-600">
          <span class="px-2 py-0.5 bg-gray-100 rounded-full">
            {{ groupData().completed_count }} / {{ groupData().task_count }}
          </span>
          @if (groupData().estimated_hours != null && groupData().estimated_hours! > 0) {
            <span class="px-2 py-0.5 bg-gray-100 rounded-full flex items-center gap-1">
              <mat-icon class="!w-3 !h-3 !text-xs">schedule</mat-icon>
              {{ groupData().estimated_hours!.toFixed(1) }}h
            </span>
          }
          <!-- Progress percentage -->
          <span
            class="px-2 py-0.5 rounded-full font-medium"
            [class.bg-green-100]="completionPercentage() === 100"
            [class.text-green-700]="completionPercentage() === 100"
            [class.bg-blue-100]="completionPercentage() > 0 && completionPercentage() < 100"
            [class.text-blue-700]="completionPercentage() > 0 && completionPercentage() < 100"
            [class.bg-gray-100]="completionPercentage() === 0"
            [class.text-gray-600]="completionPercentage() === 0"
          >
            {{ completionPercentage() }}%
          </span>
        </div>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-1">
        <!-- Color picker button -->
        <button
          mat-icon-button
          [matMenuTriggerFor]="colorMenu"
          matTooltip="Change color"
          class="text-gray-600 hover:text-gray-900"
        >
          <mat-icon>palette</mat-icon>
        </button>

        <!-- More options -->
        <button
          mat-icon-button
          [matMenuTriggerFor]="moreMenu"
          matTooltip="More options"
          class="text-gray-600 hover:text-gray-900"
        >
          <mat-icon>more_vert</mat-icon>
        </button>
      </div>
    </div>

    <!-- Color menu -->
    <mat-menu #colorMenu="matMenu">
      <div class="px-4 py-2">
        <div class="text-xs font-medium text-gray-500 mb-2">GROUP COLOR</div>
        <div class="grid grid-cols-6 gap-2">
          @for (color of predefinedColors; track color) {
            <button
              mat-icon-button
              (click)="onColorChange(color); $event.stopPropagation()"
              [style.background-color]="color"
              class="w-8 h-8 rounded-full border-2 hover:scale-110 transition-transform"
              [class.ring-2]="groupData().group.color === color"
              [class.ring-offset-2]="groupData().group.color === color"
              [class.ring-gray-800]="groupData().group.color === color"
            >
            </button>
          }
        </div>
      </div>
    </mat-menu>

    <!-- More options menu -->
    <mat-menu #moreMenu="matMenu">
      <button mat-menu-item (click)="startNameEdit()">
        <mat-icon>edit</mat-icon>
        <span>Rename group</span>
      </button>
      <button mat-menu-item (click)="onDelete()">
        <mat-icon class="text-red-600">delete</mat-icon>
        <span class="text-red-600">Delete group</span>
      </button>
    </mat-menu>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class TaskGroupHeaderComponent {
  // Inputs
  groupData = input.required<TaskGroupWithStats>();

  // Outputs
  nameChange = output<string>();
  colorChange = output<string>();
  toggleCollapse = output<void>();
  delete = output<void>();

  // Local state
  isEditing = signal(false);
  editedName = '';

  // Predefined colors
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

  // Computed
  completionPercentage = () => {
    const total = this.groupData().task_count;
    if (total === 0) return 0;
    return Math.round((this.groupData().completed_count / total) * 100);
  };

  // Methods
  startNameEdit() {
    this.editedName = this.groupData().group.name;
    this.isEditing.set(true);
  }

  saveNameEdit() {
    if (this.editedName.trim() && this.editedName !== this.groupData().group.name) {
      this.nameChange.emit(this.editedName.trim());
    }
    this.isEditing.set(false);
  }

  cancelNameEdit() {
    this.isEditing.set(false);
  }

  onColorChange(color: string) {
    this.colorChange.emit(color);
  }

  onToggleCollapse() {
    this.toggleCollapse.emit();
  }

  onDelete() {
    if (confirm(`Delete group "${this.groupData().group.name}"? Tasks will be moved to "Ungrouped".`)) {
      this.delete.emit();
    }
  }
}
