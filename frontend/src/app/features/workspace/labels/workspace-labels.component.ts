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
  WorkspaceService,
  WorkspaceLabel,
} from '../../../core/services/workspace.service';

const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
];

@Component({
  selector: 'app-workspace-labels',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-[var(--foreground)]">Labels</h3>
          <p class="text-sm text-[var(--muted-foreground)] mt-1">
            Manage workspace-wide labels that can be applied to tasks across all
            boards.
          </p>
        </div>
      </div>

      <!-- Create label form -->
      <div class="widget-card p-4">
        <div class="flex items-center gap-3">
          <div class="flex gap-1.5 flex-wrap">
            @for (c of presetColors; track c) {
              <button
                (click)="newColor = c"
                [class.ring-2]="newColor === c"
                [class.ring-offset-2]="newColor === c"
                class="w-6 h-6 rounded-full cursor-pointer ring-[var(--primary)]"
                [style.background]="c"
              ></button>
            }
          </div>
          <input
            type="text"
            [(ngModel)]="newName"
            placeholder="Label name..."
            class="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            (keydown.enter)="createLabel()"
          />
          <button
            (click)="createLabel()"
            [disabled]="!newName.trim() || creating()"
            class="px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-md hover:opacity-90 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <!-- Error banner -->
      @if (errorMessage()) {
        <div
          class="p-3 rounded-md text-sm text-[var(--status-red-text)] bg-[var(--status-red-bg)] border border-[var(--status-red-border)]"
        >
          {{ errorMessage() }}
        </div>
      }

      <!-- Labels list -->
      @if (loading()) {
        <div class="flex justify-center py-8">
          <svg
            class="animate-spin h-6 w-6 text-[var(--muted-foreground)]"
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
      } @else if (labels().length === 0) {
        <div class="text-center py-8 text-[var(--muted-foreground)]">
          <i class="pi pi-tags text-3xl mb-2 block opacity-40"></i>
          <p class="text-sm">No labels yet. Create your first label above.</p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (label of labels(); track label.id) {
            <div
              class="widget-card px-4 py-3 flex items-center justify-between group"
            >
              @if (editingId() === label.id) {
                <!-- Edit mode -->
                <div class="flex items-center gap-3 flex-1">
                  <div class="flex gap-1.5 flex-wrap">
                    @for (c of presetColors; track c) {
                      <button
                        (click)="editColor = c"
                        [class.ring-2]="editColor === c"
                        [class.ring-offset-2]="editColor === c"
                        class="w-5 h-5 rounded-full cursor-pointer ring-[var(--primary)]"
                        [style.background]="c"
                      ></button>
                    }
                  </div>
                  <input
                    type="text"
                    [(ngModel)]="editName"
                    class="flex-1 px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    (keydown.enter)="saveEdit(label.id)"
                    (keydown.escape)="cancelEdit()"
                  />
                  <button
                    (click)="saveEdit(label.id)"
                    class="px-3 py-1.5 text-xs font-medium text-white bg-[var(--primary)] rounded-md hover:opacity-90"
                  >
                    Save
                  </button>
                  <button
                    (click)="cancelEdit()"
                    class="px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)]"
                  >
                    Cancel
                  </button>
                </div>
              } @else {
                <!-- View mode -->
                <div class="flex items-center gap-3">
                  <span
                    class="w-4 h-4 rounded-full flex-shrink-0"
                    [style.background]="label.color"
                  ></span>
                  <span class="text-sm font-medium text-[var(--foreground)]">
                    {{ label.name }}
                  </span>
                </div>
                <div
                  class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <button
                    (click)="startEdit(label)"
                    class="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded"
                    title="Edit"
                  >
                    <i class="pi pi-pencil text-xs"></i>
                  </button>
                  <button
                    (click)="deleteLabel(label.id)"
                    class="p-1.5 text-[var(--muted-foreground)] hover:text-red-500 rounded"
                    title="Delete"
                  >
                    <i class="pi pi-trash text-xs"></i>
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class WorkspaceLabelsComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);

  workspaceId = input.required<string>();

  labels = signal<WorkspaceLabel[]>([]);
  loading = signal(true);
  creating = signal(false);
  editingId = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  presetColors = PRESET_COLORS;

  newName = '';
  newColor = PRESET_COLORS[5];
  editName = '';
  editColor = '';

  ngOnInit(): void {
    this.loadLabels();
  }

  loadLabels(): void {
    this.loading.set(true);
    this.workspaceService.listLabels(this.workspaceId()).subscribe({
      next: (labels) => {
        this.labels.set(labels);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  createLabel(): void {
    const name = this.newName.trim();
    if (!name) return;

    const snapshot = this.labels();
    const savedName = this.newName;
    const savedColor = this.newColor;

    // Optimistic: insert temp label, clear input
    const tempId = crypto.randomUUID();
    const tempLabel: WorkspaceLabel = {
      id: tempId,
      name,
      color: this.newColor,
      workspace_id: this.workspaceId(),
      board_id: null,
      created_at: new Date().toISOString(),
    };
    this.labels.update((list) => [...list, tempLabel]);
    this.newName = '';

    this.workspaceService
      .createLabel(this.workspaceId(), name, savedColor)
      .subscribe({
        next: (label) => {
          this.labels.update((list) =>
            list.map((l) => (l.id === tempId ? label : l)),
          );
        },
        error: () => {
          this.labels.set(snapshot);
          this.newName = savedName;
          this.showError('Failed to create label');
        },
      });
  }

  startEdit(label: WorkspaceLabel): void {
    this.editingId.set(label.id);
    this.editName = label.name;
    this.editColor = label.color;
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(labelId: string): void {
    const name = this.editName.trim();
    if (!name) return;

    const snapshot = this.labels();

    // Optimistic: update name+color locally, clear edit state
    this.labels.update((list) =>
      list.map((l) =>
        l.id === labelId ? { ...l, name, color: this.editColor } : l,
      ),
    );
    this.editingId.set(null);

    this.workspaceService
      .updateLabel(this.workspaceId(), labelId, name, this.editColor)
      .subscribe({
        next: (updated) => {
          this.labels.update((list) =>
            list.map((l) => (l.id === labelId ? updated : l)),
          );
        },
        error: () => {
          this.labels.set(snapshot);
          this.showError('Failed to update label');
        },
      });
  }

  deleteLabel(labelId: string): void {
    const snapshot = this.labels();

    // Optimistic: remove immediately
    this.labels.update((list) => list.filter((l) => l.id !== labelId));

    this.workspaceService.deleteLabel(this.workspaceId(), labelId).subscribe({
      error: () => {
        this.labels.set(snapshot);
        this.showError('Failed to delete label');
      },
    });
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }
}
