import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import {
  CustomFieldService,
  BoardCustomField,
  CustomFieldType,
  CreateCustomFieldRequest,
  UpdateCustomFieldRequest,
} from '../../../core/services/custom-field.service';

@Component({
  selector: 'app-custom-fields-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-[var(--card-foreground)]">
          Custom Fields
        </h3>
        <button
          (click)="toggleCreateForm()"
          class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Field
        </button>
      </div>

      <!-- Create Form -->
      @if (showCreateForm()) {
        <div
          class="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 shadow-sm"
        >
          <div class="space-y-3">
            <input
              type="text"
              [(ngModel)]="newName"
              placeholder="Field name"
              class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
            />
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label
                  class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                  >Type</label
                >
                <select
                  [(ngModel)]="newFieldType"
                  class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                >
                  @for (ft of fieldTypeOptions; track ft.value) {
                    <option [value]="ft.value">{{ ft.label }}</option>
                  }
                </select>
              </div>
              <div class="flex items-end">
                <label
                  class="inline-flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    [(ngModel)]="newIsRequired"
                    class="rounded border-[var(--border)] text-primary focus:ring-ring"
                  />
                  Required
                </label>
              </div>
            </div>
            @if (newFieldType === 'dropdown') {
              <div>
                <label
                  class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                  >Options (one per line)</label
                >
                <textarea
                  [(ngModel)]="newOptions"
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  rows="3"
                  class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                ></textarea>
              </div>
            }
            <div class="flex justify-end gap-2 pt-2">
              <button
                (click)="cancelCreate()"
                class="px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-md"
              >
                Cancel
              </button>
              <button
                (click)="createField()"
                [disabled]="!newName.trim()"
                class="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center justify-center py-8">
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
      } @else if (fields().length === 0 && !showCreateForm()) {
        <app-empty-state
          variant="custom-fields"
          (ctaClicked)="toggleCreateForm()"
        />
      } @else {
        <!-- Fields List -->
        <div class="space-y-2">
          @for (field of fields(); track field.id) {
            <div
              class="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              @if (editingId() === field.id) {
                <!-- Edit Mode -->
                <div class="p-4 space-y-3">
                  <input
                    type="text"
                    [(ngModel)]="editName"
                    placeholder="Field name"
                    class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                  />
                  @if (field.field_type === 'dropdown') {
                    <div>
                      <label
                        class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                        >Options (one per line)</label
                      >
                      <textarea
                        [(ngModel)]="editOptions"
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                        rows="3"
                        class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                      ></textarea>
                    </div>
                  }
                  <label
                    class="inline-flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      [(ngModel)]="editIsRequired"
                      class="rounded border-[var(--border)] text-primary focus:ring-ring"
                    />
                    Required
                  </label>
                  <div class="flex justify-end gap-2 pt-2">
                    <button
                      (click)="cancelEdit()"
                      class="px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      (click)="saveEdit(field.id)"
                      [disabled]="!editName.trim()"
                      class="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  </div>
                </div>
              } @else {
                <!-- View Mode -->
                <div class="p-4 flex items-center justify-between">
                  <div class="flex items-center gap-3 min-w-0">
                    <div
                      class="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                      [class.bg-blue-100]="field.field_type === 'text'"
                      [class.bg-purple-100]="field.field_type === 'number'"
                      [class.bg-green-100]="field.field_type === 'date'"
                      [class.bg-orange-100]="field.field_type === 'dropdown'"
                      [class.bg-pink-100]="field.field_type === 'checkbox'"
                    >
                      <span
                        class="text-xs font-bold"
                        [class.text-blue-600]="field.field_type === 'text'"
                        [class.text-purple-600]="field.field_type === 'number'"
                        [class.text-green-600]="field.field_type === 'date'"
                        [class.text-orange-600]="
                          field.field_type === 'dropdown'
                        "
                        [class.text-pink-600]="field.field_type === 'checkbox'"
                        >{{ getFieldTypeIcon(field.field_type) }}</span
                      >
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="text-sm font-medium text-[var(--card-foreground)] truncate"
                          >{{ field.name }}</span
                        >
                        @if (field.is_required) {
                          <span
                            class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700"
                          >
                            Required
                          </span>
                        }
                      </div>
                      <span
                        class="text-xs text-[var(--muted-foreground)] capitalize"
                        >{{ field.field_type }}</span
                      >
                    </div>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <button
                      (click)="startEdit(field)"
                      class="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded"
                      title="Edit"
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
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <button
                      (click)="confirmDelete(field)"
                      class="p-1.5 text-[var(--muted-foreground)] hover:text-red-600 rounded"
                      title="Delete"
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
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CustomFieldsManagerComponent implements OnInit, OnChanges {
  private customFieldService = inject(CustomFieldService);

  boardId = input.required<string>();

  fields = signal<BoardCustomField[]>([]);
  loading = signal(true);
  showCreateForm = signal(false);
  editingId = signal<string | null>(null);

  fieldTypeOptions: { value: CustomFieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'checkbox', label: 'Checkbox' },
  ];

  // Create form fields
  newName = '';
  newFieldType: CustomFieldType = 'text';
  newOptions = '';
  newIsRequired = false;

  // Edit form fields
  editName = '';
  editOptions = '';
  editIsRequired = false;

  ngOnInit(): void {
    this.loadFields();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['boardId'] && !changes['boardId'].firstChange) {
      this.loadFields();
    }
  }

  toggleCreateForm(): void {
    this.showCreateForm.update((v) => !v);
    if (!this.showCreateForm()) {
      this.resetCreateForm();
    }
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
    this.resetCreateForm();
  }

  createField(): void {
    if (!this.newName.trim()) return;

    const req: CreateCustomFieldRequest = {
      name: this.newName.trim(),
      field_type: this.newFieldType,
      is_required: this.newIsRequired,
    };

    if (this.newFieldType === 'dropdown' && this.newOptions.trim()) {
      const options = this.newOptions
        .split('\n')
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
      req.options = options;
    }

    this.customFieldService.createField(this.boardId(), req).subscribe({
      next: (field) => {
        this.fields.update((f) => [...f, field]);
        this.showCreateForm.set(false);
        this.resetCreateForm();
      },
      error: (err) => console.error('Failed to create custom field:', err),
    });
  }

  startEdit(field: BoardCustomField): void {
    this.editingId.set(field.id);
    this.editName = field.name;
    this.editIsRequired = field.is_required;
    if (field.field_type === 'dropdown' && field.options) {
      const opts = Array.isArray(field.options) ? field.options : [];
      this.editOptions = opts.join('\n');
    } else {
      this.editOptions = '';
    }
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(fieldId: string): void {
    if (!this.editName.trim()) return;

    const req: UpdateCustomFieldRequest = {
      name: this.editName.trim(),
      is_required: this.editIsRequired,
    };

    const field = this.fields().find((f) => f.id === fieldId);
    if (field?.field_type === 'dropdown' && this.editOptions.trim()) {
      const options = this.editOptions
        .split('\n')
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
      req.options = options;
    }

    this.customFieldService.updateField(fieldId, req).subscribe({
      next: (updated) => {
        this.fields.update((fields) =>
          fields.map((f) => (f.id === fieldId ? updated : f)),
        );
        this.editingId.set(null);
      },
      error: (err) => console.error('Failed to update custom field:', err),
    });
  }

  confirmDelete(field: BoardCustomField): void {
    if (
      !confirm(
        `Delete custom field "${field.name}"? All task values for this field will be removed.`,
      )
    ) {
      return;
    }

    this.customFieldService.deleteField(field.id).subscribe({
      next: () => {
        this.fields.update((f) => f.filter((cf) => cf.id !== field.id));
      },
      error: (err) => console.error('Failed to delete custom field:', err),
    });
  }

  getFieldTypeIcon(fieldType: CustomFieldType): string {
    switch (fieldType) {
      case 'text':
        return 'Aa';
      case 'number':
        return '#';
      case 'date':
        return 'D';
      case 'dropdown':
        return 'V';
      case 'checkbox':
        return '?';
      default:
        return '?';
    }
  }

  private loadFields(): void {
    this.loading.set(true);
    this.customFieldService.listBoardFields(this.boardId()).subscribe({
      next: (fields) => {
        this.fields.set(fields);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load custom fields:', err);
        this.loading.set(false);
      },
    });
  }

  private resetCreateForm(): void {
    this.newName = '';
    this.newFieldType = 'text';
    this.newOptions = '';
    this.newIsRequired = false;
  }
}
