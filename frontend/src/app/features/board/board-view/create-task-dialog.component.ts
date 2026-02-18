import { Component, inject, signal, input, output, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { MultiSelect } from 'primeng/multiselect';

import { TaskPriority } from '../../../core/services/task.service';

export interface CreateTaskDialogData {
  columnId: string;
  columnName: string;
  members: { id: string; name: string; avatar_url?: string }[];
  labels: { id: string; name: string; color: string }[];
  milestones: { id: string; name: string; color: string }[];
  groups: { id: string; name: string; color: string }[];
}

export interface CreateTaskDialogResult {
  title: string;
  description?: string;
  priority: TaskPriority;
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  group_id?: string;
  milestone_id?: string;
  assignee_ids?: string[];
  label_ids?: string[];
}

@Component({
  selector: 'app-create-task-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    Dialog,
    InputTextModule,
    Textarea,
    Select,
    DatePicker,
    InputNumber,
    MultiSelect,
  ],
  template: `
    <p-dialog
      header="Create New Task"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '540px' }"
      [closable]="true"
      (onShow)="onDialogShow()"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <!-- Column info -->
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Adding to column: <span class="font-medium">{{ columnName() }}</span>
        </p>

        <!-- Title -->
        <div class="flex flex-col gap-1">
          <label
            for="taskTitle"
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >Title</label
          >
          <input
            pInputText
            id="taskTitle"
            formControlName="title"
            placeholder="Enter task title"
            class="w-full"
          />
          @if (
            form.controls.title.hasError('required') &&
            form.controls.title.touched
          ) {
            <small class="text-red-500">Title is required</small>
          }
          @if (form.controls.title.hasError('maxlength')) {
            <small class="text-red-500"
              >Title must be less than 200 characters</small
            >
          }
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-1">
          <label
            for="taskDesc"
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >Description</label
          >
          <textarea
            pTextarea
            id="taskDesc"
            formControlName="description"
            placeholder="Enter task description (optional)"
            rows="3"
            class="w-full"
          ></textarea>
        </div>

        <!-- Priority -->
        <div class="flex flex-col gap-1">
          <label
            for="taskPriority"
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >Priority</label
          >
          <p-select
            inputId="taskPriority"
            formControlName="priority"
            [options]="priorities"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            styleClass="w-full"
          >
            <ng-template #selectedItem let-selected>
              <div class="flex items-center gap-2" *ngIf="selected">
                <span
                  class="w-2 h-2 rounded-full inline-block"
                  [style.background-color]="selected.color"
                ></span>
                {{ selected.label }}
              </div>
            </ng-template>
            <ng-template #item let-priority>
              <div class="flex items-center gap-2">
                <span
                  class="w-2 h-2 rounded-full inline-block"
                  [style.background-color]="priority.color"
                ></span>
                {{ priority.label }}
              </div>
            </ng-template>
          </p-select>
        </div>

        <!-- Date Row: Start Date and Due Date side by side -->
        <div class="grid grid-cols-2 gap-4">
          <!-- Start Date -->
          <div class="flex flex-col gap-1">
            <label
              for="startDate"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Start Date</label
            >
            <p-datePicker
              inputId="startDate"
              formControlName="startDate"
              placeholder="Select start date"
              [showIcon]="true"
              dateFormat="yy-mm-dd"
              styleClass="w-full"
            />
          </div>

          <!-- Due Date -->
          <div class="flex flex-col gap-1">
            <label
              for="dueDate"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Due Date</label
            >
            <p-datePicker
              inputId="dueDate"
              formControlName="dueDate"
              placeholder="Select due date"
              [showIcon]="true"
              dateFormat="yy-mm-dd"
              styleClass="w-full"
            />
          </div>
        </div>

        <!-- Estimated Hours -->
        <div class="flex flex-col gap-1">
          <label
            for="estHours"
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >Estimated Hours</label
          >
          <p-inputNumber
            inputId="estHours"
            formControlName="estimatedHours"
            placeholder="e.g., 4"
            [min]="0"
            [max]="9999"
            [step]="0.5"
            suffix=" hrs"
            [minFractionDigits]="0"
            [maxFractionDigits]="1"
            styleClass="w-full"
          />
          @if (form.controls.estimatedHours.hasError('min')) {
            <small class="text-red-500">Hours must be 0 or greater</small>
          }
          @if (form.controls.estimatedHours.hasError('max')) {
            <small class="text-red-500">Hours must be less than 10,000</small>
          }
        </div>

        <!-- Assignees -->
        @if (members().length > 0) {
          <div class="flex flex-col gap-1">
            <label
              for="assignees"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Assignees</label
            >
            <p-multiSelect
              inputId="assignees"
              formControlName="assigneeIds"
              [options]="members()"
              optionLabel="name"
              optionValue="id"
              placeholder="Select assignees"
              styleClass="w-full"
              [showClear]="true"
            >
              <ng-template #item let-member>
                <div class="flex items-center gap-2">
                  <div
                    class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-medium"
                  >
                    {{ member.name.charAt(0).toUpperCase() }}
                  </div>
                  {{ member.name }}
                </div>
              </ng-template>
            </p-multiSelect>
          </div>
        }

        <!-- Labels -->
        @if (labels().length > 0) {
          <div class="flex flex-col gap-1">
            <label
              for="taskLabels"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Labels</label
            >
            <p-multiSelect
              inputId="taskLabels"
              formControlName="labelIds"
              [options]="labels()"
              optionLabel="name"
              optionValue="id"
              placeholder="Select labels"
              styleClass="w-full"
              [showClear]="true"
            >
              <ng-template #item let-label>
                <div class="flex items-center gap-2">
                  <span
                    class="w-3 h-3 rounded-full inline-block"
                    [style.background-color]="label.color"
                  ></span>
                  {{ label.name }}
                </div>
              </ng-template>
            </p-multiSelect>
          </div>
        }

        <!-- Milestone -->
        @if (milestones().length > 0) {
          <div class="flex flex-col gap-1">
            <label
              for="milestone"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Milestone</label
            >
            <p-select
              inputId="milestone"
              formControlName="milestoneId"
              [options]="milestoneOptions()"
              optionLabel="name"
              optionValue="id"
              placeholder="Select milestone"
              class="w-full"
              styleClass="w-full"
              [showClear]="true"
            >
              <ng-template #item let-ms>
                <div class="flex items-center gap-2">
                  @if (ms.color) {
                    <span
                      class="w-3 h-3 rounded-full inline-block"
                      [style.background-color]="ms.color"
                    ></span>
                  }
                  {{ ms.name }}
                </div>
              </ng-template>
            </p-select>
          </div>
        }

        <!-- Task Group -->
        @if (groups().length > 1) {
          <div class="flex flex-col gap-1">
            <label
              for="taskGroup"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Group</label
            >
            <p-select
              inputId="taskGroup"
              formControlName="groupId"
              [options]="groupOptions()"
              optionLabel="name"
              optionValue="id"
              placeholder="Select group"
              class="w-full"
              styleClass="w-full"
              [showClear]="true"
            >
              <ng-template #item let-group>
                <div class="flex items-center gap-2">
                  @if (group.color) {
                    <span
                      class="w-3 h-3 rounded-full inline-block"
                      [style.background-color]="group.color"
                    ></span>
                  }
                  {{ group.name }}
                </div>
              </ng-template>
            </p-select>
          </div>
        }
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
            label="Create Task"
            (onClick)="onSave()"
            [disabled]="form.invalid || saving()"
            [loading]="saving()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class CreateTaskDialogComponent {
  private fb = inject(FormBuilder);

  /** Two-way bound visibility */
  visible = model(false);

  /** Input data for the dialog */
  columnId = input<string>('');
  columnName = input<string>('');
  members = input<{ id: string; name: string; avatar_url?: string }[]>([]);
  labels = input<{ id: string; name: string; color: string }[]>([]);
  milestones = input<{ id: string; name: string; color: string }[]>([]);
  groups = input<{ id: string; name: string; color: string }[]>([]);

  /** Emits result when dialog closes with a value */
  created = output<CreateTaskDialogResult>();

  saving = signal(false);

  priorities = [
    { value: 'low', label: 'Low', color: '#60a5fa' },
    { value: 'medium', label: 'Medium', color: '#facc15' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'urgent', label: 'Urgent', color: '#ef4444' },
  ];

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    priority: ['medium' as TaskPriority],
    startDate: [null as Date | null],
    dueDate: [null as Date | null],
    estimatedHours: [
      null as number | null,
      [Validators.min(0), Validators.max(9999)],
    ],
    assigneeIds: [[] as string[]],
    labelIds: [[] as string[]],
    milestoneId: ['' as string],
    groupId: ['' as string],
  });

  milestoneOptions = signal<{ id: string; name: string; color: string }[]>([]);
  groupOptions = signal<{ id: string; name: string; color: string }[]>([]);

  onDialogShow(): void {
    this.form.reset({
      title: '',
      description: '',
      priority: 'medium',
      startDate: null,
      dueDate: null,
      estimatedHours: null,
      assigneeIds: [],
      labelIds: [],
      milestoneId: '',
      groupId: '',
    });
    this.milestoneOptions.set(this.milestones());
    this.groupOptions.set(this.groups());
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onSave(): void {
    if (this.form.invalid) return;

    const values = this.form.getRawValue();
    const result: CreateTaskDialogResult = {
      title: values.title.trim(),
      priority: values.priority,
    };

    if (values.description?.trim()) {
      result.description = values.description.trim();
    }

    if (values.startDate) {
      result.start_date = values.startDate.toISOString().split('T')[0];
    }

    if (values.dueDate) {
      result.due_date = values.dueDate.toISOString().split('T')[0];
    }

    if (values.estimatedHours != null && values.estimatedHours > 0) {
      result.estimated_hours = values.estimatedHours;
    }

    if (values.assigneeIds?.length) {
      result.assignee_ids = values.assigneeIds;
    }

    if (values.labelIds?.length) {
      result.label_ids = values.labelIds;
    }

    if (values.milestoneId) {
      result.milestone_id = values.milestoneId;
    }

    if (values.groupId) {
      result.group_id = values.groupId;
    }

    this.visible.set(false);
    this.created.emit(result);
  }
}
