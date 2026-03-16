import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService, TaskPriority } from '../../../core/services/task.service';
import { Milestone } from '../../../core/services/milestone.service';
import { TaskGroupWithStats } from '../../../core/services/task-group.service';
import { Column } from '../../../core/services/project.service';

export interface BulkAction {
  type: 'move' | 'priority' | 'milestone' | 'group' | 'delete';
  column_id?: string;
  priority?: TaskPriority;
  milestone_id?: string;
  clear_milestone?: boolean;
  group_id?: string;
  clear_group?: boolean;
}

@Component({
  selector: 'app-bulk-actions-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[var(--foreground)] text-[var(--background)] rounded-lg shadow-2xl px-5 py-3 flex items-center gap-4"
    >
      <span class="text-sm font-medium">
        {{ selectedCount() }} task{{ selectedCount() > 1 ? 's' : '' }} selected
        @if (atLimit()) {
          <span class="text-yellow-400 ml-1">(limit reached)</span>
        }
      </span>

      <div class="w-px h-6 bg-[var(--border)]"></div>

      <!-- Move to Column -->
      <div class="relative">
        <select
          class="bg-[var(--foreground)]/90 text-[var(--background)] text-sm rounded px-2 py-1.5 border border-[var(--border)] cursor-pointer"
          [ngModel]="''"
          (ngModelChange)="onMoveToColumn($event)"
        >
          <option value="" disabled>Move to...</option>
          @for (col of columns(); track col.id) {
            <option [value]="col.id">{{ col.name }}</option>
          }
        </select>
      </div>

      <!-- Set Priority -->
      <div class="relative">
        <select
          class="bg-[var(--foreground)]/90 text-[var(--background)] text-sm rounded px-2 py-1.5 border border-[var(--border)] cursor-pointer"
          [ngModel]="''"
          (ngModelChange)="onSetPriority($event)"
        >
          <option value="" disabled>Priority...</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <!-- Set Milestone -->
      @if (milestones().length > 0) {
        <div class="relative">
          <select
            class="bg-[var(--foreground)]/90 text-[var(--background)] text-sm rounded px-2 py-1.5 border border-[var(--border)] cursor-pointer"
            [ngModel]="''"
            (ngModelChange)="onSetMilestone($event)"
          >
            <option value="" disabled>Milestone...</option>
            <option value="__clear">No Milestone</option>
            @for (ms of milestones(); track ms.id) {
              <option [value]="ms.id">{{ ms.name }}</option>
            }
          </select>
        </div>
      }

      <!-- Move to Group -->
      @if (groups().length > 1) {
        <div class="relative">
          <select
            class="bg-[var(--foreground)]/90 text-[var(--background)] text-sm rounded px-2 py-1.5 border border-[var(--border)] cursor-pointer"
            [ngModel]="''"
            (ngModelChange)="onMoveToGroup($event)"
          >
            <option value="" disabled>Group...</option>
            <option value="__clear">No Group</option>
            @for (g of groups(); track g.group.id) {
              <option [value]="g.group.id">{{ g.group.name }}</option>
            }
          </select>
        </div>
      }

      <!-- CSV Export -->
      <button
        (click)="onExport()"
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--muted)] hover:bg-[var(--secondary)] rounded transition-colors"
        title="Export selected tasks as CSV"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        CSV
      </button>

      <!-- Delete -->
      <button
        (click)="onDelete()"
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--destructive)] hover:opacity-90 rounded transition-colors"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        Delete
      </button>

      <!-- Cancel Selection -->
      <button
        (click)="onCancel()"
        class="ml-2 text-[var(--background)]/60 hover:text-[var(--background)] transition-colors"
        title="Cancel selection"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  `,
})
export class BulkActionsBarComponent {
  selectedCount = input.required<number>();
  atLimit = input<boolean>(false);
  columns = input<Column[]>([]);
  milestones = input<Milestone[]>([]);
  groups = input<TaskGroupWithStats[]>([]);

  bulkAction = output<BulkAction>();
  cancelSelection = output<void>();
  exportCsv = output<void>();

  onMoveToColumn(columnId: string): void {
    if (columnId) {
      this.bulkAction.emit({ type: 'move', column_id: columnId });
    }
  }

  onSetPriority(priority: string): void {
    if (priority) {
      this.bulkAction.emit({
        type: 'priority',
        priority: priority as TaskPriority,
      });
    }
  }

  onSetMilestone(value: string): void {
    if (value === '__clear') {
      this.bulkAction.emit({ type: 'milestone', clear_milestone: true });
    } else if (value) {
      this.bulkAction.emit({ type: 'milestone', milestone_id: value });
    }
  }

  onMoveToGroup(value: string): void {
    if (value === '__clear') {
      this.bulkAction.emit({ type: 'group', clear_group: true });
    } else if (value) {
      this.bulkAction.emit({ type: 'group', group_id: value });
    }
  }

  onExport(): void {
    this.exportCsv.emit();
  }

  onDelete(): void {
    this.bulkAction.emit({ type: 'delete' });
  }

  onCancel(): void {
    this.cancelSelection.emit();
  }
}
