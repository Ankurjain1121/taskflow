import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ProjectGroupService,
  ProjectGroupWithCount,
} from '../../../core/services/project-group.service';

const PRESET_COLORS = [
  '#BF7B54', // warm earth primary
  '#10B981', // emerald
  '#3B82F6', // blue
  '#F59E0B', // amber
  '#EF4444', // rose
  '#8B5CF6', // violet
  '#14B8A6', // teal
  '#6B7280', // slate
];

@Component({
  selector: 'app-project-groups-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  styles: [
    `
      :host {
        display: block;
      }
      h3 {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--foreground);
        margin: 0 0 0.25rem;
      }
      .subtitle {
        font-size: 0.75rem;
        color: var(--muted-foreground);
        margin: 0 0 1rem;
      }
      .create-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        padding: 0.75rem;
        background: var(--muted);
        border: 1px dashed var(--border);
        border-radius: 0.625rem;
        margin-bottom: 1rem;
      }
      .create-row input[type='text'] {
        flex: 1;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        color: var(--foreground);
        font-family: inherit;
      }
      .color-swatches {
        display: inline-flex;
        gap: 0.25rem;
      }
      .swatch {
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 9999px;
        border: 2px solid transparent;
        cursor: pointer;
      }
      .swatch.active {
        border-color: var(--foreground);
      }
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.5rem 0.85rem;
        border-radius: 0.5rem;
        font-size: 0.8rem;
        font-weight: 500;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--foreground);
        cursor: pointer;
      }
      .btn-primary {
        background: var(--primary);
        color: var(--primary-foreground, #fff);
        border-color: var(--primary);
      }
      .btn-danger {
        color: var(--destructive, #dc2626);
        border-color: var(--destructive, #dc2626);
      }
      .list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .group-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.625rem;
      }
      .group-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 0;
        flex: 1;
      }
      .dot {
        flex-shrink: 0;
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 9999px;
      }
      .group-name {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--foreground);
      }
      .group-name-input {
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 0.375rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
        color: var(--foreground);
        font-family: inherit;
      }
      .group-count {
        font-size: 0.75rem;
        color: var(--muted-foreground);
        margin-left: 0.5rem;
      }
      .group-actions {
        display: flex;
        gap: 0.25rem;
        flex-shrink: 0;
      }
      .icon-btn {
        width: 1.75rem;
        height: 1.75rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.375rem;
        border: 0;
        background: transparent;
        color: var(--muted-foreground);
        cursor: pointer;
      }
      .icon-btn:hover {
        background: var(--muted);
        color: var(--foreground);
      }
      .icon-btn.danger:hover {
        color: var(--destructive, #dc2626);
      }
      .empty {
        text-align: center;
        padding: 2rem 1rem;
        color: var(--muted-foreground);
        font-size: 0.875rem;
        background: var(--muted);
        border-radius: 0.75rem;
      }
      .error {
        color: var(--destructive, #dc2626);
        font-size: 0.8rem;
        margin-top: 0.5rem;
      }
    `,
  ],
  template: `
    <h3>Project Groups</h3>
    <p class="subtitle">
      Organize projects into collections like "Q3 Launches" or "Client X". A
      project can belong to at most one group, or stay ungrouped.
    </p>

    <div class="create-row">
      <input
        type="text"
        placeholder="New group name"
        [(ngModel)]="newName"
        (keydown.enter)="create()"
        maxlength="100"
      />
      <div class="color-swatches" role="radiogroup" aria-label="Color">
        @for (c of presetColors; track c) {
          <button
            type="button"
            class="swatch"
            [class.active]="newColor() === c"
            [style.background]="c"
            (click)="newColor.set(c)"
            [attr.aria-label]="'Color ' + c"
            [attr.aria-pressed]="newColor() === c"
          ></button>
        }
      </div>
      <button
        type="button"
        class="btn btn-primary"
        [disabled]="saving() || !newName.trim()"
        (click)="create()"
      >
        + Add Group
      </button>
    </div>

    @if (errorMessage()) {
      <div class="error" role="alert">{{ errorMessage() }}</div>
    }

    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (groups().length === 0) {
      <div class="empty">
        No groups yet. Create your first one above.
      </div>
    } @else {
      <div class="list">
        @for (g of groups(); track g.id) {
          <div class="group-row">
            <div class="group-left">
              <span class="dot" [style.background]="g.color"></span>
              @if (editingId() === g.id) {
                <input
                  class="group-name-input"
                  [(ngModel)]="editName"
                  (keydown.enter)="saveEdit(g.id)"
                  (keydown.escape)="cancelEdit()"
                  autofocus
                />
              } @else {
                <span class="group-name">{{ g.name }}</span>
                <span class="group-count"
                  >· {{ g.project_count }}
                  {{ g.project_count === 1 ? 'project' : 'projects' }}</span
                >
              }
            </div>
            <div class="group-actions">
              @if (editingId() === g.id) {
                <button
                  type="button"
                  class="icon-btn"
                  (click)="saveEdit(g.id)"
                  aria-label="Save"
                >
                  <i class="pi pi-check"></i>
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  (click)="cancelEdit()"
                  aria-label="Cancel"
                >
                  <i class="pi pi-times"></i>
                </button>
              } @else {
                <button
                  type="button"
                  class="icon-btn"
                  (click)="startEdit(g)"
                  aria-label="Rename"
                >
                  <i class="pi pi-pencil"></i>
                </button>
                <button
                  type="button"
                  class="icon-btn danger"
                  (click)="remove(g)"
                  [attr.aria-label]="'Delete ' + g.name"
                >
                  <i class="pi pi-trash"></i>
                </button>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class ProjectGroupsTabComponent implements OnInit {
  private readonly svc = inject(ProjectGroupService);
  private readonly destroyRef = inject(DestroyRef);

  workspaceId = input.required<string>();

  readonly presetColors = PRESET_COLORS;
  readonly groups = signal<ProjectGroupWithCount[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);

  newName = '';
  readonly newColor = signal<string>(PRESET_COLORS[0]);
  editName = '';

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.svc
      .list(this.workspaceId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups) => {
          this.groups.set(groups);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set('Failed to load project groups');
        },
      });
  }

  create(): void {
    const name = this.newName.trim();
    if (!name) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    this.svc
      .create(this.workspaceId(), { name, color: this.newColor() })
      .subscribe({
        next: () => {
          this.newName = '';
          this.saving.set(false);
          this.reloadNoSpinner();
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(
            err?.error?.error?.message ?? 'Failed to create group',
          );
        },
      });
  }

  startEdit(g: ProjectGroupWithCount): void {
    this.editingId.set(g.id);
    this.editName = g.name;
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(id: string): void {
    const name = this.editName.trim();
    if (!name) return;
    this.svc.update(id, { name }).subscribe({
      next: () => {
        this.editingId.set(null);
        this.reloadNoSpinner();
      },
      error: () => {
        this.errorMessage.set('Failed to rename group');
      },
    });
  }

  remove(g: ProjectGroupWithCount): void {
    const msg =
      g.project_count > 0
        ? `Delete group "${g.name}"? The ${g.project_count} project(s) inside will become ungrouped — they won't be deleted.`
        : `Delete group "${g.name}"?`;
    if (!confirm(msg)) return;
    this.svc.delete(g.id).subscribe({
      next: () => this.reloadNoSpinner(),
      error: () => this.errorMessage.set('Failed to delete group'),
    });
  }

  private reloadNoSpinner(): void {
    this.svc.list(this.workspaceId()).subscribe({
      next: (groups) => this.groups.set(groups),
    });
  }
}
