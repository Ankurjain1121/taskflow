import {
  Component,
  inject,
  signal,
  input,
  output,
  model,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { RadioButton } from 'primeng/radiobutton';
import { ProgressSpinner } from 'primeng/progressspinner';
import { HttpClient } from '@angular/common/http';

export interface CreateProjectDialogData {
  workspaceId: string;
  workspaceName: string;
}

export interface CreateProjectDialogResult {
  name: string;
  description?: string;
  template?: string;
}

export interface BoardTemplateColumn {
  name: string;
  color: string;
  is_done: boolean;
}

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  columns: BoardTemplateColumn[];
}

@Component({
  selector: 'app-create-project-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    Dialog,
    InputTextModule,
    Textarea,
    RadioButton,
    ProgressSpinner,
  ],
  template: `
    <p-dialog
      header="Create New Project"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '520px' }"
      [closable]="true"
      (onShow)="onDialogShow()"
    >
      <p class="text-sm text-[var(--muted-foreground)] mb-4">
        Create a new project in {{ workspaceName() }}
      </p>
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <!-- Project Name -->
        <div class="flex flex-col gap-1 mb-4">
          <label
            for="boardName"
            class="text-sm font-medium text-[var(--foreground)]"
            >Project Name</label
          >
          <input
            pInputText
            id="boardName"
            formControlName="name"
            placeholder="e.g., Product Roadmap"
            maxlength="100"
            class="w-full"
          />
          @if (
            form.get('name')?.hasError('required') && form.get('name')?.touched
          ) {
            <small class="text-[var(--destructive)]">Project name is required</small>
          }
          @if (
            form.get('name')?.hasError('minlength') && form.get('name')?.touched
          ) {
            <small class="text-[var(--destructive)]"
              >Project name must be at least 2 characters</small
            >
          }
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-1 mb-4">
          <label
            for="boardDesc"
            class="text-sm font-medium text-[var(--foreground)]"
            >Description (optional)</label
          >
          <textarea
            pTextarea
            id="boardDesc"
            formControlName="description"
            placeholder="Describe the purpose of this project"
            rows="3"
            maxlength="500"
            class="w-full"
          ></textarea>
        </div>

        <!-- Template Picker -->
        <div class="mb-2">
          <label
            class="text-sm font-medium text-[var(--foreground)] mb-3 block"
          >
            Choose a template
          </label>

          @if (loadingTemplates()) {
            <div class="flex justify-center py-4">
              <p-progressSpinner
                [style]="{ width: '24px', height: '24px' }"
                strokeWidth="4"
              />
            </div>
          } @else {
            <div class="flex flex-col gap-2">
              @for (template of templates(); track template.id) {
                <label
                  class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all"
                  [style.border-color]="
                    form.get('template')?.value === template.id
                      ? 'var(--primary)'
                      : 'var(--border)'
                  "
                  [style.background]="
                    form.get('template')?.value === template.id
                      ? 'color-mix(in srgb, var(--primary) 10%, transparent)'
                      : ''
                  "
                >
                  <p-radioButton
                    [value]="template.id"
                    formControlName="template"
                  />
                  <div class="flex-1 min-w-0">
                    <div
                      class="font-medium text-[var(--card-foreground)] text-sm"
                    >
                      {{ template.name }}
                    </div>
                    <div class="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {{ template.description }}
                    </div>
                    @if (template.columns.length > 0) {
                      <div class="flex flex-wrap gap-1.5 mt-2">
                        @for (col of template.columns; track col.name) {
                          <span
                            class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)]"
                          >
                            <span
                              class="w-2 h-2 rounded-full inline-block flex-shrink-0"
                              [style.background-color]="col.color"
                            ></span>
                            {{ col.name }}
                          </span>
                        }
                      </div>
                    } @else {
                      <div
                        class="text-xs text-[var(--muted-foreground)] mt-2 italic"
                      >
                        No predefined columns
                      </div>
                    }
                  </div>
                </label>
              }
            </div>
          }
        </div>

        <!-- Selected template preview -->
        @if (selectedTemplate() && selectedTemplate()!.columns.length > 0) {
          <div
            class="mt-4 p-3 bg-[var(--secondary)] rounded-lg border border-[var(--border)]"
          >
            <div
              class="text-xs font-medium text-[var(--muted-foreground)] mb-2"
            >
              Column Preview
            </div>
            <div class="flex items-center gap-1 overflow-x-auto">
              @for (
                col of selectedTemplate()!.columns;
                track col.name;
                let last = $last
              ) {
                <div class="flex items-center gap-1 flex-shrink-0">
                  <div
                    class="px-3 py-1.5 rounded text-xs font-medium text-white"
                    [style.background-color]="col.color"
                  >
                    {{ col.name }}
                  </div>
                  @if (!last) {
                    <svg
                      class="w-3 h-3 text-[var(--muted-foreground)] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  }
                </div>
              }
            </div>
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
            [disabled]="isSubmitting"
          />
          <p-button
            label="Create Project"
            (onClick)="onSubmit()"
            [disabled]="form.invalid || isSubmitting"
            [loading]="isSubmitting"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class CreateProjectDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  /** Two-way bound visibility */
  visible = model(false);

  /** Input data for the dialog */
  workspaceId = input<string>('');
  workspaceName = input<string>('');

  /** Emits result when dialog closes with a value */
  created = output<CreateProjectDialogResult>();

  templates = signal<BoardTemplate[]>([]);
  loadingTemplates = signal(true);
  selectedTemplate = signal<BoardTemplate | null>(null);

  form: FormGroup = this.fb.group({
    name: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    ],
    description: ['', [Validators.maxLength(500)]],
    template: ['kanban'],
  });

  isSubmitting = false;

  ngOnInit(): void {
    // Watch template selection changes
    this.form.get('template')?.valueChanges.subscribe((templateId: string) => {
      const found = this.templates().find((t) => t.id === templateId) || null;
      this.selectedTemplate.set(found);
    });
  }

  onDialogShow(): void {
    this.form.reset({ name: '', description: '', template: 'kanban' });
    this.loadTemplates();
  }

  private loadTemplates(): void {
    this.loadingTemplates.set(true);
    this.http.get<BoardTemplate[]>('/api/project-blueprints').subscribe({
      next: (templates) => {
        this.templates.set(templates);
        const kanban = templates.find((t) => t.id === 'kanban') || null;
        this.selectedTemplate.set(kanban);
        this.loadingTemplates.set(false);
      },
      error: () => {
        // Fallback: use hardcoded defaults if API fails
        const fallback: BoardTemplate[] = [
          {
            id: 'blank',
            name: 'Blank Project',
            description: 'Start from scratch',
            columns: [],
          },
          {
            id: 'kanban',
            name: 'Basic Kanban',
            description: 'Simple To Do, In Progress, Done workflow',
            columns: [
              { name: 'To Do', color: '#6B7280', is_done: false },
              { name: 'In Progress', color: '#3B82F6', is_done: false },
              { name: 'Done', color: '#10B981', is_done: true },
            ],
          },
          {
            id: 'scrum',
            name: 'Scrum Board',
            description: 'Backlog through Done with review stage',
            columns: [
              { name: 'Backlog', color: '#6B7280', is_done: false },
              { name: 'Review', color: '#8B5CF6', is_done: false },
              { name: 'In Progress', color: '#3B82F6', is_done: false },
              { name: 'Review', color: '#F59E0B', is_done: false },
              { name: 'Done', color: '#10B981', is_done: true },
            ],
          },
        ];
        this.templates.set(fallback);
        const kanban = fallback.find((t) => t.id === 'kanban') || null;
        this.selectedTemplate.set(kanban);
        this.loadingTemplates.set(false);
      },
    });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const result: CreateProjectDialogResult = {
      name: this.form.value.name.trim(),
    };

    if (this.form.value.description?.trim()) {
      result.description = this.form.value.description.trim();
    }

    if (this.form.value.template) {
      result.template = this.form.value.template;
    }

    this.visible.set(false);
    this.created.emit(result);
  }
}
