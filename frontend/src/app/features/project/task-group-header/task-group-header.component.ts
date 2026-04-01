import {
  Component,
  input,
  output,
  signal,
  inject,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { Popover } from 'primeng/popover';
import { Menu } from 'primeng/menu';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MenuItem, ConfirmationService } from 'primeng/api';
import { TaskGroupWithStats } from '../../../core/services/task-group.service';

@Component({
  selector: 'app-task-group-header',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    Tooltip,
    Popover,
    Menu,
    ConfirmDialog,
  ],
  providers: [ConfirmationService],
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
          pButton
          [rounded]="true"
          [text]="true"
          (click)="onToggleCollapse()"
          [pTooltip]="
            groupData().group.collapsed ? 'Expand group' : 'Collapse group'
          "
          class="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <i
            [class]="
              groupData().group.collapsed
                ? 'pi pi-chevron-right'
                : 'pi pi-chevron-down'
            "
          ></i>
        </button>

        <!-- Group name (editable) -->
        @if (isEditing()) {
          <input
            type="text"
            [(ngModel)]="editedName"
            (blur)="saveNameEdit()"
            (keydown.enter)="saveNameEdit()"
            (keydown.escape)="cancelNameEdit()"
            class="px-2 py-1 text-sm font-semibold border border-[var(--border)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
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
        <div
          class="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"
        >
          <span class="px-2 py-0.5 bg-[var(--secondary)] rounded-full">
            {{ groupData().completed_count }} / {{ groupData().task_count }}
          </span>
          @if (
            groupData().estimated_hours !== null &&
            groupData().estimated_hours! > 0
          ) {
            <span
              class="px-2 py-0.5 bg-[var(--secondary)] rounded-full flex items-center gap-1"
            >
              <i class="pi pi-clock" style="font-size: 0.75rem"></i>
              {{ groupData().estimated_hours!.toFixed(1) }}h
            </span>
          }
          <!-- Progress percentage -->
          <span
            class="px-2 py-0.5 rounded-full font-medium"
            [ngClass]="completionBadgeClass()"
          >
            {{ completionPercentage() }}%
          </span>
        </div>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-1">
        <!-- Color picker button -->
        <button
          pButton
          [rounded]="true"
          [text]="true"
          pTooltip="Change color"
          aria-label="Change color"
          (click)="colorPopover.toggle($event)"
          class="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <i class="pi pi-palette"></i>
        </button>

        <!-- More options -->
        <button
          pButton
          [rounded]="true"
          [text]="true"
          pTooltip="More options"
          aria-label="More options"
          (click)="moreMenu.toggle($event)"
          class="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <i class="pi pi-ellipsis-v"></i>
        </button>
      </div>
    </div>

    <!-- Color popover -->
    <p-popover #colorPopover>
      <div class="px-4 py-2">
        <div class="text-xs font-medium text-[var(--muted-foreground)] mb-2">
          GROUP COLOR
        </div>
        <div class="grid grid-cols-6 gap-2">
          @for (color of predefinedColors; track color) {
            <button
              class="w-8 h-8 rounded-full border-2 hover:scale-110 transition-transform cursor-pointer"
              (click)="onColorChange(color); colorPopover.hide()"
              [style.background-color]="color"
              [class.ring-2]="groupData().group.color === color"
              [class.ring-offset-2]="groupData().group.color === color"
              [class.ring-gray-800]="groupData().group.color === color"
            ></button>
          }
        </div>
      </div>
    </p-popover>

    <!-- More options menu -->
    <p-menu #moreMenu [model]="moreMenuItems" [popup]="true" />
    <p-confirmDialog />
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class TaskGroupHeaderComponent {
  private confirmationService = inject(ConfirmationService);

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

  // Menu items for the "more" menu
  moreMenuItems: MenuItem[] = [
    {
      label: 'Rename group',
      icon: 'pi pi-pencil',
      command: () => this.startNameEdit(),
    },
    {
      label: 'Delete group',
      icon: 'pi pi-trash',
      styleClass: 'text-red-600',
      command: () => this.onDelete(),
    },
  ];

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
  completionBadgeClass(): string {
    const pct = this.completionPercentage();
    if (pct === 100)
      return 'bg-[var(--status-green-bg)] text-[var(--status-green-text)]';
    if (pct > 0)
      return 'bg-[var(--status-blue-bg)] text-[var(--status-blue-text)]';
    return 'bg-[var(--secondary)] text-[var(--muted-foreground)]';
  }

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
    if (
      this.editedName.trim() &&
      this.editedName !== this.groupData().group.name
    ) {
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
    this.confirmationService.confirm({
      message: `Delete group "${this.groupData().group.name}"? Tasks will be moved to "Ungrouped".`,
      header: 'Delete Group',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.delete.emit();
      },
    });
  }
}
