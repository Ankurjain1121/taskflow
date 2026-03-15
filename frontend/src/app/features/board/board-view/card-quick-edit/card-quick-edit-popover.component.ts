import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { CardQuickEditService } from './card-quick-edit.service';
import { ProjectStateService } from '../board-state.service';
import { PriorityPickerComponent } from './pickers/priority-picker.component';
import { LabelPickerComponent } from './pickers/label-picker.component';
import { AssigneePickerComponent } from './pickers/assignee-picker.component';
import { DueDatePickerComponent } from './pickers/due-date-picker.component';
import { TaskPriority } from '../../../../core/services/task.service';

@Component({
  selector: 'app-card-quick-edit-popover',
  standalone: true,
  imports: [
    CommonModule,
    A11yModule,
    PriorityPickerComponent,
    LabelPickerComponent,
    AssigneePickerComponent,
    DueDatePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      cdkTrapFocus
      cdkTrapFocusAutoCapture
      class="bg-[var(--card)] rounded-lg shadow-xl border border-[var(--border)] w-64 overflow-hidden"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="'Edit ' + (service.currentField() ?? 'field')"
      (keydown.escape)="service.close()"
    >
      <div
        class="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between"
      >
        <span class="text-sm font-medium text-[var(--foreground)]">
          {{ fieldLabel() }}
        </span>
        <button
          (click)="service.close()"
          class="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          aria-label="Close"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div class="overflow-y-auto max-h-72">
        @switch (service.currentField()) {
          @case ('priority') {
            <app-priority-picker
              [currentPriority]="service.currentTask()?.priority ?? null"
              (prioritySelected)="onPrioritySelected($event)"
            />
          }
          @case ('assignee') {
            <app-assignee-picker
              [members]="service.projectMembers()"
              [selectedIds]="currentAssigneeIds()"
              (assigneesChanged)="onAssigneesChanged($event)"
            />
          }
          @case ('due-date') {
            <app-due-date-picker
              [currentDate]="service.currentTask()?.due_date ?? null"
              (dateSelected)="onDateSelected($event)"
            />
          }
          @case ('label') {
            <app-label-picker
              [labels]="service.availableLabels()"
              [selectedIds]="currentLabelIds()"
              (labelsChanged)="onLabelsChanged($event)"
            />
          }
        }
      </div>
    </div>
  `,
})
export class CardQuickEditPopoverComponent {
  readonly service = inject(CardQuickEditService);
  private readonly boardState = inject(ProjectStateService);

  readonly fieldLabel = computed(() => {
    switch (this.service.currentField()) {
      case 'priority':
        return 'Set Priority';
      case 'assignee':
        return 'Assignees';
      case 'due-date':
        return 'Due Date';
      case 'label':
        return 'Labels';
      default:
        return 'Edit';
    }
  });

  readonly currentAssigneeIds = computed(() =>
    (this.service.currentTask()?.assignees ?? []).map((a) => a.id),
  );

  readonly currentLabelIds = computed(() =>
    (this.service.currentTask()?.labels ?? []).map((l) => l.id),
  );

  onPrioritySelected(priority: TaskPriority | null): void {
    const task = this.service.currentTask();
    if (!task || !priority) {
      this.service.close();
      return;
    }
    this.boardState.optimisticUpdateTask(task.id, { priority }, { priority });
    this.service.close();
  }

  onAssigneesChanged(newIds: string[]): void {
    const task = this.service.currentTask();
    if (!task) return;
    const oldIds = (task.assignees ?? []).map((a) => a.id);
    for (const id of newIds) {
      if (!oldIds.includes(id)) {
        this.boardState.optimisticAssignUser(task.id, id);
      }
    }
    for (const id of oldIds) {
      if (!newIds.includes(id)) {
        this.boardState.optimisticUnassignUser(task.id, id);
      }
    }
  }

  onDateSelected(date: string | null): void {
    const task = this.service.currentTask();
    if (!task) return;
    this.boardState.optimisticUpdateTask(
      task.id,
      { due_date: date },
      date ? { due_date: date } : { due_date: null, clear_due_date: true },
    );
    this.service.close();
  }

  onLabelsChanged(newIds: string[]): void {
    const task = this.service.currentTask();
    if (!task) return;
    const oldIds = (task.labels ?? []).map((l) => l.id);
    for (const id of newIds) {
      if (!oldIds.includes(id)) {
        this.boardState.optimisticAddLabel(task.id, id);
      }
    }
    for (const id of oldIds) {
      if (!newIds.includes(id)) {
        this.boardState.optimisticRemoveLabel(task.id, id);
      }
    }
  }
}
