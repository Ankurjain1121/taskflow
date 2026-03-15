import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDropList,
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPreview,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { generateKeyBetween } from 'fractional-indexing';
import {
  ProjectService,
  Column,
  ColumnStatusMapping,
} from '../../../core/services/board.service';
import { COLUMN_HEADER_COLORS } from '../../../shared/utils/task-colors';

@Component({
  selector: 'app-column-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPreview,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-lg shadow" style="background: var(--card)">
      <div class="px-6 py-4" style="border-bottom: 1px solid var(--border)">
        <h3 class="text-lg font-medium" style="color: var(--foreground)">
          Columns
        </h3>
        <p class="text-sm mt-1" style="color: var(--muted-foreground)">
          Drag to reorder. Click on a column to edit its properties.
        </p>
      </div>

      <div class="px-6 py-4">
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
        } @else {
          <!-- Column List -->
          <div
            cdkDropList
            [cdkDropListData]="columns()"
            (cdkDropListDropped)="onDrop($event)"
            class="space-y-2"
          >
            @for (column of columns(); track column.id) {
              <div
                cdkDrag
                class="flex items-center gap-3 p-3 rounded-lg transition-colors"
                style="background: var(--muted); border: 1px solid var(--border)"
              >
                <!-- Drag Handle -->
                <button
                  cdkDragHandle
                  class="p-1 cursor-grab"
                  style="color: var(--muted-foreground)"
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
                      d="M4 8h16M4 16h16"
                    />
                  </svg>
                </button>

                <!-- Color Swatch -->
                <div class="relative">
                  <button
                    (click)="toggleColorPicker(column.id)"
                    class="w-8 h-8 rounded-md border-2 border-white shadow"
                    [style.background-color]="column.color"
                  ></button>

                  @if (editingColorId() === column.id) {
                    <div
                      class="absolute top-full left-0 mt-2 p-2 rounded-lg shadow-lg z-10"
                      style="background: var(--card); border: 1px solid var(--border)"
                    >
                      <div class="grid grid-cols-4 gap-1">
                        @for (color of availableColors; track color) {
                          <button
                            (click)="onColorChange(column, color)"
                            class="w-6 h-6 rounded"
                            [style.background-color]="color"
                            [class.ring-2]="column.color === color"
                            [class.ring-offset-1]="column.color === color"
                            [class.ring-ring]="column.color === color"
                          ></button>
                        }
                      </div>
                    </div>
                  }
                </div>

                <!-- Name (Inline Editable) -->
                <input
                  type="text"
                  [ngModel]="column.name"
                  (ngModelChange)="onNameChange(column, $event)"
                  (blur)="saveName(column)"
                  class="flex-1 text-sm font-medium bg-transparent border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 px-1 py-0.5"
                  style="color: var(--foreground)"
                />

                <!-- Status Mapping Badge -->
                @if (column.status_mapping?.done) {
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    style="background: var(--status-green-bg); color: var(--status-green-text)"
                  >
                    Done
                  </span>
                }

                <!-- Status Toggle -->
                <button
                  (click)="toggleDoneStatus(column)"
                  class="px-2 py-1 text-xs rounded"
                  [style.background]="
                    column.status_mapping?.done
                      ? 'var(--status-green-bg)'
                      : 'var(--muted)'
                  "
                  [style.color]="
                    column.status_mapping?.done
                      ? 'var(--status-green-text)'
                      : 'var(--muted-foreground)'
                  "
                  [title]="
                    column.status_mapping?.done
                      ? 'Remove done status'
                      : 'Mark as done column'
                  "
                >
                  @if (column.status_mapping?.done) {
                    <svg
                      class="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  } @else {
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                </button>

                <!-- Delete Button -->
                <button
                  (click)="onDelete(column)"
                  [disabled]="deleting() === column.id"
                  class="p-1 hover:text-red-600 transition-colors disabled:opacity-50"
                  style="color: var(--muted-foreground)"
                  title="Delete column"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>

                <!-- Drag Preview -->
                <div
                  *cdkDragPreview
                  class="flex items-center gap-3 p-3 rounded-lg shadow-lg"
                  style="background: var(--card); border: 1px solid var(--primary)"
                >
                  <div
                    class="w-4 h-4 rounded"
                    [style.background-color]="column.color"
                  ></div>
                  <span class="text-sm font-medium">{{ column.name }}</span>
                </div>
              </div>
            }
          </div>

          <!-- Add Column Form -->
          <div class="mt-4 pt-4" style="border-top: 1px solid var(--border)">
            <form (ngSubmit)="onAddColumn()" class="flex items-center gap-3">
              <div class="relative">
                <button
                  type="button"
                  (click)="toggleNewColorPicker()"
                  class="w-8 h-8 rounded-md border-2"
                  style="border-color: var(--border)"
                  [style.background-color]="newColumnColor()"
                ></button>

                @if (showNewColorPicker()) {
                  <div
                    class="absolute top-full left-0 mt-2 p-2 rounded-lg shadow-lg z-10"
                    style="background: var(--card); border: 1px solid var(--border)"
                  >
                    <div class="grid grid-cols-4 gap-1">
                      @for (color of availableColors; track color) {
                        <button
                          type="button"
                          (click)="onNewColorSelect(color)"
                          class="w-6 h-6 rounded"
                          [style.background-color]="color"
                          [class.ring-2]="newColumnColor() === color"
                          [class.ring-offset-1]="newColumnColor() === color"
                          [class.ring-ring]="newColumnColor() === color"
                        ></button>
                      }
                    </div>
                  </div>
                }
              </div>

              <input
                type="text"
                [(ngModel)]="newColumnName"
                name="newColumnName"
                placeholder="New column name"
                class="flex-1 text-sm rounded-md shadow-sm focus:border-primary focus:ring-ring"
                style="border-color: var(--border); background: var(--card); color: var(--foreground)"
              />

              <label
                class="inline-flex items-center gap-2 text-sm"
                style="color: var(--foreground)"
              >
                <input
                  type="checkbox"
                  [(ngModel)]="newColumnIsDone"
                  name="newColumnIsDone"
                  class="w-4 h-4 text-primary rounded focus:ring-ring"
                  style="border-color: var(--border)"
                />
                Done column
              </label>

              <button
                type="submit"
                [disabled]="!newColumnName.trim() || adding()"
                class="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (adding()) {
                  <svg
                    class="animate-spin h-4 w-4"
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
                } @else {
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
                }
                Add Column
              </button>
            </form>
          </div>

          <!-- Error Message -->
          @if (errorMessage()) {
            <div
              class="mt-4 p-3 rounded-md text-sm"
              style="background: var(--status-red-bg); border: 1px solid var(--status-red-border); color: var(--status-red-text)"
            >
              {{ errorMessage() }}
            </div>
          }
        }
      </div>
    </div>
  `,
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class ColumnManagerComponent implements OnInit {
  private projectService = inject(ProjectService);

  boardId = input.required<string>();

  loading = signal(true);
  adding = signal(false);
  deleting = signal<string | null>(null);
  columns = signal<Column[]>([]);
  editingColorId = signal<string | null>(null);
  showNewColorPicker = signal(false);
  newColumnColor = signal('#6366f1');
  errorMessage = signal<string | null>(null);

  newColumnName = '';
  newColumnIsDone = false;

  availableColors = COLUMN_HEADER_COLORS;

  private pendingNames = new Map<string, string>();

  ngOnInit(): void {
    this.loadColumns();
  }

  onDrop(event: CdkDragDrop<Column[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const columns = [...this.columns()];
    moveItemInArray(columns, event.previousIndex, event.currentIndex);
    this.columns.set(columns);

    const movedColumn = columns[event.currentIndex];

    this.projectService
      .reorderColumn(movedColumn.id, { new_index: event.currentIndex })
      .subscribe({
        next: () => this.loadColumns(),
        error: () => {
          this.loadColumns();
        },
      });
  }

  toggleColorPicker(columnId: string): void {
    this.editingColorId.update((id) => (id === columnId ? null : columnId));
    this.showNewColorPicker.set(false);
  }

  toggleNewColorPicker(): void {
    this.showNewColorPicker.update((v) => !v);
    this.editingColorId.set(null);
  }

  onColorChange(column: Column, color: string): void {
    this.editingColorId.set(null);

    const snapshot = this.columns();

    // Optimistic: update color locally
    this.columns.update((cols) =>
      cols.map((c) => (c.id === column.id ? { ...c, color } : c)),
    );

    this.projectService.updateColumn(column.id, { color }).subscribe({
      next: (updated) => {
        this.columns.update((cols) =>
          cols.map((c) => (c.id === column.id ? updated : c)),
        );
      },
      error: () => {
        this.columns.set(snapshot);
        this.showError('Failed to update column color');
      },
    });
  }

  onNewColorSelect(color: string): void {
    this.newColumnColor.set(color);
    this.showNewColorPicker.set(false);
  }

  onNameChange(column: Column, name: string): void {
    this.pendingNames.set(column.id, name);
  }

  saveName(column: Column): void {
    const name = this.pendingNames.get(column.id);
    if (!name || name === column.name) {
      this.pendingNames.delete(column.id);
      return;
    }

    const snapshot = this.columns();

    // Optimistic: update name locally
    this.columns.update((cols) =>
      cols.map((c) => (c.id === column.id ? { ...c, name } : c)),
    );
    this.pendingNames.delete(column.id);

    this.projectService.updateColumn(column.id, { name }).subscribe({
      next: (updated) => {
        this.columns.update((cols) =>
          cols.map((c) => (c.id === column.id ? updated : c)),
        );
      },
      error: () => {
        this.columns.set(snapshot);
        this.showError('Failed to update column name');
      },
    });
  }

  toggleDoneStatus(column: Column): void {
    const newMapping: ColumnStatusMapping = column.status_mapping?.done
      ? {}
      : { done: true };

    const snapshot = this.columns();

    // Optimistic: toggle status_mapping locally
    this.columns.update((cols) =>
      cols.map((c) =>
        c.id === column.id ? { ...c, status_mapping: newMapping } : c,
      ),
    );

    this.projectService
      .updateColumn(column.id, { status_mapping: newMapping })
      .subscribe({
        next: (updated) => {
          this.columns.update((cols) =>
            cols.map((c) => (c.id === column.id ? updated : c)),
          );
        },
        error: () => {
          this.columns.set(snapshot);
          this.showError('Failed to update column status');
        },
      });
  }

  onDelete(column: Column): void {
    if (!confirm(`Delete column "${column.name}"?`)) return;

    const snapshot = this.columns();
    this.errorMessage.set(null);

    // Optimistic: remove immediately
    this.columns.update((cols) => cols.filter((c) => c.id !== column.id));

    this.projectService.deleteColumn(column.id).subscribe({
      error: (err) => {
        this.columns.set(snapshot);

        if (err.status === 409) {
          this.showError(
            'Cannot delete column with tasks. Move or delete tasks first.',
          );
        } else {
          this.showError('Failed to delete column');
        }
      },
    });
  }

  onAddColumn(): void {
    if (!this.newColumnName.trim()) return;

    const snapshot = this.columns();
    const savedName = this.newColumnName;
    const savedColor = this.newColumnColor();
    const savedIsDone = this.newColumnIsDone;
    this.errorMessage.set(null);

    const columns = this.columns();
    const lastColumn = columns[columns.length - 1];
    const position = lastColumn
      ? generateKeyBetween(lastColumn.position, null)
      : 'a0';

    // Optimistic: insert temp column, clear form
    const tempId = crypto.randomUUID();
    const tempColumn: Column = {
      id: tempId,
      board_id: this.boardId(),
      name: this.newColumnName.trim(),
      position,
      color: this.newColumnColor(),
      status_mapping: this.newColumnIsDone ? { done: true } : null,
      wip_limit: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.columns.update((cols) => [...cols, tempColumn]);
    this.newColumnName = '';
    this.newColumnIsDone = false;
    this.newColumnColor.set('#6366f1');

    this.projectService
      .createColumn(this.boardId(), {
        name: tempColumn.name,
        color: savedColor,
        status_mapping: savedIsDone ? { done: true } : undefined,
      })
      .subscribe({
        next: (newColumn) => {
          this.columns.update((cols) =>
            cols.map((c) => (c.id === tempId ? newColumn : c)),
          );
        },
        error: () => {
          this.columns.set(snapshot);
          this.newColumnName = savedName;
          this.newColumnIsDone = savedIsDone;
          this.newColumnColor.set(savedColor);
          this.showError('Failed to create column');
        },
      });
  }

  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('[class*="color"]') && !target.closest('button')) {
      this.editingColorId.set(null);
      this.showNewColorPicker.set(false);
    }
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }

  private loadColumns(): void {
    this.loading.set(true);

    this.projectService.listColumns(this.boardId()).subscribe({
      next: (columns) => {
        this.columns.set(
          columns.sort((a, b) => a.position.localeCompare(b.position)),
        );
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load columns:', err);
        this.loading.set(false);
      },
    });
  }
}
