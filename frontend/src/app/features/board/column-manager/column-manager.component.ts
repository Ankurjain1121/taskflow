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
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { generateKeyBetween } from 'fractional-indexing';
import {
  BoardService,
  Column,
  ColumnStatusMapping,
} from '../../../core/services/board.service';
import { COLUMN_HEADER_COLORS } from '../../../shared/utils/task-colors';

@Component({
  selector: 'app-column-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-medium text-gray-900">Columns</h3>
        <p class="text-sm text-gray-500 mt-1">
          Drag to reorder. Click on a column to edit its properties.
        </p>
      </div>

      <div class="px-6 py-4">
        @if (loading()) {
          <div class="flex items-center justify-center py-8">
            <svg
              class="animate-spin h-6 w-6 text-indigo-600"
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
                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <!-- Drag Handle -->
                <button
                  cdkDragHandle
                  class="p-1 text-gray-400 hover:text-gray-600 cursor-grab"
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
                      class="absolute top-full left-0 mt-2 p-2 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                    >
                      <div class="grid grid-cols-4 gap-1">
                        @for (color of availableColors; track color) {
                          <button
                            (click)="onColorChange(column, color)"
                            class="w-6 h-6 rounded"
                            [style.background-color]="color"
                            [class.ring-2]="column.color === color"
                            [class.ring-offset-1]="column.color === color"
                            [class.ring-indigo-500]="column.color === color"
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
                  class="flex-1 text-sm font-medium text-gray-900 bg-transparent border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-indigo-500 focus:ring-0 px-1 py-0.5"
                />

                <!-- Status Mapping Badge -->
                @if (column.status_mapping?.done) {
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                  >
                    Done
                  </span>
                }

                <!-- Status Toggle -->
                <button
                  (click)="toggleDoneStatus(column)"
                  [class]="
                    'px-2 py-1 text-xs rounded ' +
                    (column.status_mapping?.done
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
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
                  class="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
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
                  class="flex items-center gap-3 p-3 bg-white rounded-lg shadow-lg border border-indigo-200"
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
          <div class="mt-4 pt-4 border-t border-gray-200">
            <form
              (ngSubmit)="onAddColumn()"
              class="flex items-center gap-3"
            >
              <div class="relative">
                <button
                  type="button"
                  (click)="toggleNewColorPicker()"
                  class="w-8 h-8 rounded-md border-2 border-gray-200"
                  [style.background-color]="newColumnColor()"
                ></button>

                @if (showNewColorPicker()) {
                  <div
                    class="absolute top-full left-0 mt-2 p-2 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
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
                          [class.ring-indigo-500]="newColumnColor() === color"
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
                class="flex-1 text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />

              <label class="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  [(ngModel)]="newColumnIsDone"
                  name="newColumnIsDone"
                  class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                Done column
              </label>

              <button
                type="submit"
                [disabled]="!newColumnName.trim() || adding()"
                class="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
              class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
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
  private boardService = inject(BoardService);

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
    const beforeColumn = columns[event.currentIndex - 1];
    const afterColumn = columns[event.currentIndex + 1];

    const beforePos = beforeColumn?.position || null;
    const afterPos = afterColumn?.position || null;

    let newPosition: string;
    try {
      newPosition = generateKeyBetween(beforePos, afterPos);
    } catch {
      newPosition = Date.now().toString();
    }

    this.boardService
      .reorderColumn(movedColumn.id, { position: newPosition })
      .subscribe({
        next: () => this.loadColumns(),
        error: (err) => {
          console.error('Failed to reorder column:', err);
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

    this.boardService.updateColumn(column.id, { color }).subscribe({
      next: (updated) => {
        this.columns.update((cols) =>
          cols.map((c) => (c.id === column.id ? updated : c))
        );
      },
      error: (err) => console.error('Failed to update color:', err),
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

    this.boardService.updateColumn(column.id, { name }).subscribe({
      next: (updated) => {
        this.columns.update((cols) =>
          cols.map((c) => (c.id === column.id ? updated : c))
        );
        this.pendingNames.delete(column.id);
      },
      error: (err) => {
        console.error('Failed to update name:', err);
        this.pendingNames.delete(column.id);
      },
    });
  }

  toggleDoneStatus(column: Column): void {
    const newMapping: ColumnStatusMapping = column.status_mapping?.done
      ? {}
      : { done: true };

    this.boardService
      .updateColumn(column.id, { status_mapping: newMapping })
      .subscribe({
        next: (updated) => {
          this.columns.update((cols) =>
            cols.map((c) => (c.id === column.id ? updated : c))
          );
        },
        error: (err) => console.error('Failed to update status mapping:', err),
      });
  }

  onDelete(column: Column): void {
    if (!confirm(`Delete column "${column.name}"?`)) return;

    this.deleting.set(column.id);
    this.errorMessage.set(null);

    this.boardService.deleteColumn(column.id).subscribe({
      next: () => {
        this.columns.update((cols) => cols.filter((c) => c.id !== column.id));
        this.deleting.set(null);
      },
      error: (err) => {
        console.error('Failed to delete column:', err);
        this.deleting.set(null);

        if (err.status === 409) {
          this.errorMessage.set(
            'Cannot delete column with tasks. Move or delete tasks first.'
          );
        } else {
          this.errorMessage.set('Failed to delete column');
        }

        setTimeout(() => this.errorMessage.set(null), 5000);
      },
    });
  }

  onAddColumn(): void {
    if (!this.newColumnName.trim()) return;

    this.adding.set(true);
    this.errorMessage.set(null);

    const columns = this.columns();
    const lastColumn = columns[columns.length - 1];
    const position = lastColumn
      ? generateKeyBetween(lastColumn.position, null)
      : 'a0';

    this.boardService
      .createColumn(this.boardId(), {
        name: this.newColumnName.trim(),
        color: this.newColumnColor(),
        status_mapping: this.newColumnIsDone ? { done: true } : undefined,
      })
      .subscribe({
        next: (newColumn) => {
          this.columns.update((cols) => [...cols, newColumn]);
          this.newColumnName = '';
          this.newColumnIsDone = false;
          this.newColumnColor.set('#6366f1');
          this.adding.set(false);
        },
        error: (err) => {
          console.error('Failed to create column:', err);
          this.adding.set(false);
          this.errorMessage.set('Failed to create column');
          setTimeout(() => this.errorMessage.set(null), 5000);
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

  private loadColumns(): void {
    this.loading.set(true);

    this.boardService.listColumns(this.boardId()).subscribe({
      next: (columns) => {
        this.columns.set(
          columns.sort((a, b) => a.position.localeCompare(b.position))
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
