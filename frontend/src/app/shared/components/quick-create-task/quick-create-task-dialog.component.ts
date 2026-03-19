import {
  Component,
  inject,
  signal,
  computed,
  model,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';
import {
  TaskService,
  TaskPriority,
  CreateTaskRequest,
} from '../../../core/services/task.service';
import { PRIORITY_COLORS } from '../../constants/priority-colors';

@Component({
  selector: 'app-quick-create-task-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Dialog,
    InputTextModule,
    Select,
    DatePicker,
    ButtonModule,
  ],
  template: `
    <p-dialog
      header="Quick Create Task"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '460px' }"
      [closable]="true"
      (onShow)="onDialogShow()"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <!-- Project selector -->
        <div class="flex flex-col gap-1">
          <label
            for="qcProject"
            class="text-sm font-medium text-[var(--foreground)]"
            >Project</label
          >
          <p-select
            inputId="qcProject"
            formControlName="projectId"
            [options]="projectOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="Select a project"
            class="w-full"
            styleClass="w-full"
          />
          @if (
            form.controls.projectId.hasError('required') &&
            form.controls.projectId.touched
          ) {
            <small class="text-red-500">Project is required</small>
          }
        </div>

        <!-- Title -->
        <div class="flex flex-col gap-1">
          <label
            for="qcTitle"
            class="text-sm font-medium text-[var(--foreground)]"
            >Title</label
          >
          <input
            pInputText
            id="qcTitle"
            formControlName="title"
            placeholder="What needs to be done?"
            class="w-full"
            (keydown.enter)="onSave()"
          />
          @if (
            form.controls.title.hasError('required') &&
            form.controls.title.touched
          ) {
            <small class="text-red-500">Title is required</small>
          }
        </div>

        <!-- Priority + Due date row -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label
              for="qcPriority"
              class="text-sm font-medium text-[var(--foreground)]"
              >Priority</label
            >
            <p-select
              inputId="qcPriority"
              formControlName="priority"
              [options]="priorities"
              optionLabel="label"
              optionValue="value"
              class="w-full"
              styleClass="w-full"
            >
              <ng-template #selectedItem let-selected>
                @if (selected) {
                  <div class="flex items-center gap-2">
                    <span
                      class="w-2 h-2 rounded-full inline-block"
                      [style.background-color]="selected.color"
                    ></span>
                    {{ selected.label }}
                  </div>
                }
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

          <div class="flex flex-col gap-1">
            <label
              for="qcDueDate"
              class="text-sm font-medium text-[var(--foreground)]"
              >Due Date</label
            >
            <p-datePicker
              inputId="qcDueDate"
              formControlName="dueDate"
              placeholder="Optional"
              [showIcon]="true"
              dateFormat="yy-mm-dd"
              styleClass="w-full"
            />
          </div>
        </div>
      </form>

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="visible.set(false)"
          />
          <p-button
            label="Create Task"
            icon="pi pi-plus"
            (onClick)="onSave()"
            [disabled]="form.invalid || saving()"
            [loading]="saving()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class QuickCreateTaskDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly wsContext = inject(WorkspaceContextService);
  private readonly taskService = inject(TaskService);
  private readonly messageService = inject(MessageService);

  visible = model(false);
  saving = signal(false);

  readonly priorities = [
    { value: 'low', label: 'Low', color: PRIORITY_COLORS['low'] },
    { value: 'medium', label: 'Medium', color: PRIORITY_COLORS['medium'] },
    { value: 'high', label: 'High', color: PRIORITY_COLORS['high'] },
    { value: 'urgent', label: 'Urgent', color: PRIORITY_COLORS['urgent'] },
  ];

  readonly projectOptions = computed(() =>
    this.wsContext.getOrderedProjects(),
  );

  readonly form = this.fb.nonNullable.group({
    projectId: ['', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    priority: ['medium' as TaskPriority],
    dueDate: [null as Date | null],
  });

  onDialogShow(): void {
    this.form.reset({
      projectId: '',
      title: '',
      priority: 'medium',
      dueDate: null,
    });
    // Auto-select first project if available
    const projects = this.projectOptions();
    if (projects.length > 0) {
      this.form.patchValue({ projectId: projects[0].id });
    }
  }

  onSave(): void {
    if (this.form.invalid || this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const values = this.form.getRawValue();
    this.saving.set(true);

    const request: CreateTaskRequest = {
      title: values.title.trim(),
      priority: values.priority,
    };

    if (values.dueDate) {
      request.due_date = values.dueDate.toISOString().split('T')[0];
    }

    this.taskService.createTask(values.projectId, request).subscribe({
      next: (task) => {
        this.saving.set(false);
        this.visible.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Task Created',
          detail: `"${task.title}" has been created`,
          life: 3000,
        });
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to create task. Please try again.',
          life: 5000,
        });
      },
    });
  }
}
