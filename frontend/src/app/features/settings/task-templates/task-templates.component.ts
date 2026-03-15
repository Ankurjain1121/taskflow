import {
  Component,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

import {
  TaskTemplateService,
  TaskTemplate,
  CreateTaskTemplateRequest,
  UpdateTaskTemplateRequest,
} from '../../../core/services/task-template.service';

@Component({
  selector: 'app-task-templates',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    Dialog,
    InputTextModule,
    Textarea,
    Select,
    Tag,
    ConfirmDialog,
    Toast,
  ],
  providers: [ConfirmationService, MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-[var(--foreground)]">
            Task Templates
          </h2>
          <p class="mt-1 text-sm text-[var(--muted-foreground)]">
            Manage reusable task templates. Use them when creating new tasks to
            save time.
          </p>
        </div>
        <button
          pButton
          label="New Template"
          icon="pi pi-plus"
          (click)="onCreateTemplate()"
          class="p-button-sm"
        ></button>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-8">
          <svg
            class="animate-spin h-6 w-6 text-primary"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      } @else if (templates().length === 0) {
        <div
          class="text-center py-12 bg-[var(--card)] rounded-lg border border-[var(--border)]"
        >
          <i
            class="pi pi-copy text-4xl text-[var(--muted-foreground)] mb-3"
          ></i>
          <h3 class="text-base font-medium text-[var(--foreground)] mb-1">
            No templates yet
          </h3>
          <p class="text-sm text-[var(--muted-foreground)]">
            Create a template or save a task as a template from the board view.
          </p>
        </div>
      } @else {
        <div class="space-y-3">
          @for (template of templates(); track template.id) {
            <div
              class="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 flex items-start gap-4 hover:shadow-sm transition-shadow"
            >
              <div class="flex-1 min-w-0">
                @if (editingId() === template.id) {
                  <div class="space-y-2">
                    <input
                      pInputText
                      [(ngModel)]="editName"
                      class="w-full text-sm"
                      placeholder="Template name"
                    />
                    <textarea
                      pTextarea
                      [(ngModel)]="editDescription"
                      rows="2"
                      class="w-full text-sm"
                      placeholder="Description (optional)"
                    ></textarea>
                    <div class="flex gap-2">
                      <button
                        pButton
                        label="Save"
                        icon="pi pi-check"
                        class="p-button-sm p-button-text"
                        (click)="onSaveEdit(template.id)"
                      ></button>
                      <button
                        pButton
                        label="Cancel"
                        class="p-button-sm p-button-text p-button-secondary"
                        (click)="editingId.set(null)"
                      ></button>
                    </div>
                  </div>
                } @else {
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-medium text-[var(--foreground)]">{{
                      template.name
                    }}</span>
                    <p-tag
                      [value]="template.scope"
                      [severity]="getScopeSeverity(template.scope)"
                      class="text-xs"
                    />
                  </div>
                  <p class="text-sm text-[var(--muted-foreground)] mb-1">
                    {{ template.task_title }}
                  </p>
                  @if (template.description) {
                    <p class="text-xs text-[var(--muted-foreground)]">
                      {{ template.description }}
                    </p>
                  }
                  <p class="text-xs text-[var(--muted-foreground)] mt-1">
                    Created {{ formatDate(template.created_at) }}
                  </p>
                }
              </div>
              @if (editingId() !== template.id) {
                <div class="flex gap-1">
                  <button
                    pButton
                    [rounded]="true"
                    [text]="true"
                    (click)="onEditTemplate(template)"
                    pTooltip="Edit"
                  >
                    <i class="pi pi-pencil text-sm"></i>
                  </button>
                  <button
                    pButton
                    [rounded]="true"
                    [text]="true"
                    (click)="onDeleteTemplate(template)"
                    pTooltip="Delete"
                  >
                    <i class="pi pi-trash text-sm text-red-500"></i>
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- Create Template Dialog -->
    <p-dialog
      header="Create Task Template"
      [(visible)]="showCreateDialog"
      [modal]="true"
      [style]="{ width: '480px' }"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-[var(--foreground)]"
            >Template Name</label
          >
          <input
            pInputText
            [(ngModel)]="newName"
            placeholder="e.g. Bug Report Template"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-[var(--foreground)]"
            >Scope</label
          >
          <p-select
            [(ngModel)]="newScope"
            [options]="scopeOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            styleClass="w-full"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-[var(--foreground)]"
            >Task Title</label
          >
          <input
            pInputText
            [(ngModel)]="newTaskTitle"
            placeholder="Default task title"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-[var(--foreground)]"
            >Task Description</label
          >
          <textarea
            pTextarea
            [(ngModel)]="newTaskDescription"
            rows="3"
            placeholder="Default task description"
            class="w-full"
          ></textarea>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-[var(--foreground)]"
            >Priority</label
          >
          <p-select
            [(ngModel)]="newTaskPriority"
            [options]="priorityOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            styleClass="w-full"
          />
        </div>
      </div>
      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <button
            pButton
            label="Cancel"
            [text]="true"
            (click)="showCreateDialog = false"
          ></button>
          <button
            pButton
            label="Create"
            [disabled]="!newName.trim() || !newTaskTitle.trim() || saving()"
            [loading]="saving()"
            (click)="onConfirmCreate()"
          ></button>
        </div>
      </ng-template>
    </p-dialog>

    <p-confirmDialog />
    <p-toast />
  `,
})
export class TaskTemplatesComponent implements OnInit {
  private templateService = inject(TaskTemplateService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  loading = signal(true);
  saving = signal(false);
  templates = signal<TaskTemplate[]>([]);
  editingId = signal<string | null>(null);
  editName = '';
  editDescription = '';

  // Create dialog
  showCreateDialog = false;
  newName = '';
  newScope = 'personal';
  newTaskTitle = '';
  newTaskDescription = '';
  newTaskPriority = 'medium';

  scopeOptions = [
    { label: 'Personal', value: 'personal' },
    { label: 'Project', value: 'board' },
    { label: 'Workspace', value: 'workspace' },
  ];

  priorityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' },
  ];

  ngOnInit(): void {
    this.loadTemplates();
  }

  getScopeSeverity(
    scope: string,
  ):
    | 'success'
    | 'info'
    | 'warn'
    | 'danger'
    | 'secondary'
    | 'contrast'
    | undefined {
    switch (scope) {
      case 'personal':
        return 'info';
      case 'board':
        return 'warn';
      case 'workspace':
        return 'success';
      default:
        return 'secondary';
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }

  onCreateTemplate(): void {
    this.newName = '';
    this.newScope = 'personal';
    this.newTaskTitle = '';
    this.newTaskDescription = '';
    this.newTaskPriority = 'medium';
    this.showCreateDialog = true;
  }

  onConfirmCreate(): void {
    if (!this.newName.trim() || !this.newTaskTitle.trim()) return;

    this.saving.set(true);
    const req: CreateTaskTemplateRequest = {
      name: this.newName.trim(),
      scope: this.newScope as 'personal' | 'board' | 'workspace',
      task_title: this.newTaskTitle.trim(),
      task_description: this.newTaskDescription.trim() || undefined,
      task_priority: this.newTaskPriority || undefined,
    };

    this.templateService.create(req).subscribe({
      next: (template) => {
        this.templates.update((list) => [template, ...list]);
        this.showCreateDialog = false;
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Created',
          detail: 'Template created successfully.',
          life: 3000,
        });
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to create template.',
          life: 3000,
        });
      },
    });
  }

  onEditTemplate(template: TaskTemplate): void {
    this.editingId.set(template.id);
    this.editName = template.name;
    this.editDescription = template.description || '';
  }

  onSaveEdit(id: string): void {
    const req: UpdateTaskTemplateRequest = {
      name: this.editName.trim(),
      description: this.editDescription.trim() || undefined,
    };

    this.templateService.update(id, req).subscribe({
      next: (updated) => {
        this.templates.update((list) =>
          list.map((t) => (t.id === updated.id ? updated : t)),
        );
        this.editingId.set(null);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to update template.',
          life: 3000,
        });
      },
    });
  }

  onDeleteTemplate(template: TaskTemplate): void {
    this.confirmationService.confirm({
      message: `Delete "${template.name}"? This cannot be undone.`,
      header: 'Delete Template',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.templateService.delete(template.id).subscribe({
          next: () => {
            this.templates.update((list) =>
              list.filter((t) => t.id !== template.id),
            );
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to delete template.',
              life: 3000,
            });
          },
        });
      },
    });
  }

  private loadTemplates(): void {
    this.loading.set(true);
    this.templateService.list().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
