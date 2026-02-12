import {
  Component,
  input,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService, TaskPriority } from '../../../core/services/task.service';
import { Milestone } from '../../../core/services/milestone.service';
import { TaskGroupWithStats } from '../../../core/services/task-group.service';
import { Column } from '../../../core/services/board.service';

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
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-lg shadow-2xl px-5 py-3 flex items-center gap-4"
    >
      <span class="text-sm font-medium">
        {{ selectedCount() }} task{{ selectedCount() > 1 ? 's' : '' }} selected
      </span>

      <div class="w-px h-6 bg-gray-600"></div>

      <!-- Move to Column -->
      <div class="relative">
        <select
          class="bg-gray-800 text-white text-sm rounded px-2 py-1.5 border border-gray-600 cursor-pointer"
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
          class="bg-gray-800 text-white text-sm rounded px-2 py-1.5 border border-gray-600 cursor-pointer"
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
            class="bg-gray-800 text-white text-sm rounded px-2 py-1.5 border border-gray-600 cursor-pointer"
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
            class="bg-gray-800 text-white text-sm rounded px-2 py-1.5 border border-gray-600 cursor-pointer"
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

      <!-- Delete -->
      <button
        (click)="onDelete()"
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 rounded transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        Delete
      </button>

      <!-- Cancel Selection -->
      <button
        (click)="onCancel()"
        class="ml-2 text-gray-400 hover:text-white transition-colors"
        title="Cancel selection"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `,
})
export class BulkActionsBarComponent {
  selectedCount = input.required<number>();
  columns = input<Column[]>([]);
  milestones = input<Milestone[]>([]);
  groups = input<TaskGroupWithStats[]>([]);

  actionEmitter = output<BulkAction>({ alias: 'bulkAction' });
  cancelEmitter = output<void>({ alias: 'cancelSelection' });

  onMoveToColumn(columnId: string): void {
    if (columnId) {
      this.actionEmitter.emit({ type: 'move', column_id: columnId });
    }
  }

  onSetPriority(priority: string): void {
    if (priority) {
      this.actionEmitter.emit({ type: 'priority', priority: priority as TaskPriority });
    }
  }

  onSetMilestone(value: string): void {
    if (value === '__clear') {
      this.actionEmitter.emit({ type: 'milestone', clear_milestone: true });
    } else if (value) {
      this.actionEmitter.emit({ type: 'milestone', milestone_id: value });
    }
  }

  onMoveToGroup(value: string): void {
    if (value === '__clear') {
      this.actionEmitter.emit({ type: 'group', clear_group: true });
    } else if (value) {
      this.actionEmitter.emit({ type: 'group', group_id: value });
    }
  }

  onDelete(): void {
    this.actionEmitter.emit({ type: 'delete' });
  }

  onCancel(): void {
    this.cancelEmitter.emit();
  }
}
