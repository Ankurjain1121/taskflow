import {
  Component,
  input,
  output,
  model,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { ProjectColumn } from '../../../shared/types/project.types';

export interface TaskCreateDialogData {
  projectId: string;
  columnId: string;
  columnName: string;
  columns?: ProjectColumn[];
}

export interface TaskCreateDialogResult {
  title: string;
  description?: string;
  priority: string;
  due_date?: string;
  column_id?: string;
}

@Component({
  selector: 'app-task-create-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    Dialog,
    InputTextModule,
    Textarea,
    Select,
    DatePicker,
  ],
  template: `
    <p-dialog
      header="New Task"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '480px' }"
      [closable]="true"
      (onShow)="onDialogShow()"
    >
      <div class="flex flex-col gap-4">
        <input
          pInputText
          [(ngModel)]="title"
          placeholder="What needs to be done?"
          class="w-full"
        />

        <textarea
          pTextarea
          [(ngModel)]="description"
          rows="3"
          placeholder="Add details..."
          class="w-full"
        ></textarea>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Priority</label
            >
            <p-select
              [(ngModel)]="priority"
              [options]="priorityOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Due Date</label
            >
            <p-datepicker
              [(ngModel)]="dueDate"
              [showIcon]="true"
              dateFormat="yy-mm-dd"
              placeholder="Select date"
              class="w-full"
            />
          </div>
        </div>

        <!-- Column selector -->
        @if (columns() && columns()!.length > 1) {
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Column</label
            >
            <p-select
              [(ngModel)]="selectedColumnId"
              [options]="columnOptions()"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </div>
        } @else {
          <div class="text-sm text-gray-500 dark:text-gray-400">
            Creating in column: <strong>{{ columnName() }}</strong>
          </div>
        }
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
            label="Create Task"
            [disabled]="!title.trim()"
            (onClick)="submit()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class TaskCreateDialogComponent implements OnChanges {
  /** Two-way bound visibility */
  visible = model(false);

  /** Input data */
  columnId = input<string>('');
  columnName = input<string>('');
  columns = input<ProjectColumn[] | undefined>(undefined);

  /** Output event */
  created = output<TaskCreateDialogResult>();

  title = '';
  description = '';
  priority = 'medium';
  dueDate: Date | null = null;
  selectedColumnId = '';

  priorityOptions = [
    { label: 'Urgent', value: 'urgent' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
  ];

  columnOptions = () => {
    const cols = this.columns();
    if (!cols) return [];
    return cols.map((c) => ({
      label: c.name,
      value: c.id,
    }));
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columnId']) {
      this.selectedColumnId = this.columnId();
    }
  }

  onDialogShow(): void {
    this.title = '';
    this.description = '';
    this.priority = 'medium';
    this.dueDate = null;
    this.selectedColumnId = this.columnId();
  }

  onCancel(): void {
    this.visible.set(false);
  }

  submit(): void {
    if (!this.title.trim()) return;

    const result: TaskCreateDialogResult = {
      title: this.title.trim(),
      priority: this.priority,
    };

    if (this.description.trim()) {
      result.description = this.description.trim();
    }

    if (this.dueDate) {
      result.due_date = this.dueDate.toISOString().split('T')[0];
    }

    if (this.selectedColumnId && this.selectedColumnId !== this.columnId()) {
      result.column_id = this.selectedColumnId;
    }

    this.visible.set(false);
    this.created.emit(result);
  }
}
