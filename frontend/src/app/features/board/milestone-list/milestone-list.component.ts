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
  MilestoneService,
  Milestone,
  CreateMilestoneRequest,
  UpdateMilestoneRequest,
} from '../../../core/services/milestone.service';

@Component({
  selector: 'app-milestone-list',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-[var(--card-foreground)]">
          Milestones
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
          Add Milestone
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
              placeholder="Milestone name"
              class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
            />
            <textarea
              [(ngModel)]="newDescription"
              placeholder="Description (optional)"
              rows="2"
              class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
            ></textarea>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label
                  class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                  >Due Date</label
                >
                <input
                  type="date"
                  [(ngModel)]="newDueDate"
                  class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label
                  class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                  >Color</label
                >
                <div class="flex flex-wrap gap-1.5 mt-1">
                  @for (color of presetColors; track color) {
                    <button
                      (click)="newColor = color"
                      class="w-6 h-6 rounded-full border-2 transition-transform"
                      [style.background-color]="color"
                      [class.border-gray-800]="newColor === color"
                      [class.border-transparent]="newColor !== color"
                      [class.scale-110]="newColor === color"
                    ></button>
                  }
                </div>
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button
                (click)="cancelCreate()"
                class="px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-md"
              >
                Cancel
              </button>
              <button
                (click)="createMilestone()"
                [disabled]="!newName.trim()"
                class="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary hover:brightness-90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
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
      } @else if (milestones().length === 0 && !showCreateForm()) {
        <app-empty-state
          variant="milestones"
          (ctaClicked)="toggleCreateForm()"
        />
      } @else {
        <!-- Milestone Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (milestone of milestones(); track milestone.id) {
            <div
              class="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <!-- Color bar -->
              <div
                class="h-1.5"
                [style.background-color]="milestone.color"
              ></div>

              @if (editingId() === milestone.id) {
                <!-- Edit Mode -->
                <div class="p-4 space-y-3">
                  <input
                    type="text"
                    [(ngModel)]="editName"
                    placeholder="Milestone name"
                    class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                  />
                  <textarea
                    [(ngModel)]="editDescription"
                    placeholder="Description (optional)"
                    rows="2"
                    class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                  ></textarea>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                        >Due Date</label
                      >
                      <input
                        type="date"
                        [(ngModel)]="editDueDate"
                        class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label
                        class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                        >Color</label
                      >
                      <div class="flex flex-wrap gap-1.5 mt-1">
                        @for (color of presetColors; track color) {
                          <button
                            (click)="editColor = color"
                            class="w-6 h-6 rounded-full border-2 transition-transform"
                            [style.background-color]="color"
                            [class.border-gray-800]="editColor === color"
                            [class.border-transparent]="editColor !== color"
                            [class.scale-110]="editColor === color"
                          ></button>
                        }
                      </div>
                    </div>
                  </div>
                  <div class="flex justify-end gap-2 pt-2">
                    <button
                      (click)="cancelEdit()"
                      class="px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      (click)="saveEdit(milestone.id)"
                      [disabled]="!editName.trim()"
                      class="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary hover:brightness-90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  </div>
                </div>
              } @else {
                <!-- View Mode -->
                <div class="p-4">
                  <div class="flex items-start justify-between mb-2">
                    <h4
                      (click)="startEdit(milestone)"
                      class="text-sm font-semibold text-[var(--card-foreground)] cursor-pointer hover:text-primary"
                    >
                      {{ milestone.name }}
                    </h4>
                    <div class="flex items-center gap-1">
                      <button
                        (click)="startEdit(milestone)"
                        class="p-1 text-gray-400 hover:text-gray-600 rounded"
                        title="Edit"
                      >
                        <svg
                          class="w-3.5 h-3.5"
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
                        (click)="confirmDelete(milestone)"
                        class="p-1 text-gray-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <svg
                          class="w-3.5 h-3.5"
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

                  @if (milestone.description) {
                    <p
                      class="text-xs text-[var(--muted-foreground)] mb-3 line-clamp-2"
                    >
                      {{ milestone.description }}
                    </p>
                  }

                  @if (milestone.due_date) {
                    <div
                      class="flex items-center gap-1 text-xs mb-3"
                      [class]="getDueDateClass(milestone.due_date)"
                    >
                      <svg
                        class="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {{ formatDate(milestone.due_date) }}
                    </div>
                  }

                  <!-- Progress Bar -->
                  <div class="mt-2">
                    <div
                      class="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1"
                    >
                      <span
                        >{{ milestone.completed_tasks }}/{{
                          milestone.total_tasks
                        }}
                        tasks</span
                      >
                      <span>{{ getProgressPercent(milestone) }}%</span>
                    </div>
                    <div class="w-full bg-[var(--secondary)] rounded-full h-2">
                      <div
                        class="h-2 rounded-full transition-all duration-300"
                        [style.width.%]="getProgressPercent(milestone)"
                        [style.background-color]="milestone.color"
                      ></div>
                    </div>
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
export class MilestoneListComponent implements OnInit, OnChanges {
  private milestoneService = inject(MilestoneService);

  boardId = input.required<string>();

  milestones = signal<Milestone[]>([]);
  loading = signal(true);
  showCreateForm = signal(false);
  editingId = signal<string | null>(null);

  presetColors = [
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
  ];

  // Create form fields
  newName = '';
  newDescription = '';
  newDueDate = '';
  newColor = '#6366f1';

  // Edit form fields
  editName = '';
  editDescription = '';
  editDueDate = '';
  editColor = '#6366f1';

  ngOnInit(): void {
    this.loadMilestones();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['boardId'] && !changes['boardId'].firstChange) {
      this.loadMilestones();
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

  createMilestone(): void {
    if (!this.newName.trim()) return;

    const req: CreateMilestoneRequest = {
      name: this.newName.trim(),
      color: this.newColor,
    };

    if (this.newDescription.trim()) {
      req.description = this.newDescription.trim();
    }

    if (this.newDueDate) {
      req.due_date = new Date(this.newDueDate).toISOString();
    }

    this.milestoneService.create(this.boardId(), req).subscribe({
      next: (milestone) => {
        // Add with default progress values
        const milestoneWithProgress: Milestone = {
          ...milestone,
          total_tasks: 0,
          completed_tasks: 0,
        };
        this.milestones.update((m) => [...m, milestoneWithProgress]);
        this.showCreateForm.set(false);
        this.resetCreateForm();
      },
      error: (err) => console.error('Failed to create milestone:', err),
    });
  }

  startEdit(milestone: Milestone): void {
    this.editingId.set(milestone.id);
    this.editName = milestone.name;
    this.editDescription = milestone.description || '';
    this.editDueDate = milestone.due_date
      ? milestone.due_date.split('T')[0]
      : '';
    this.editColor = milestone.color;
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(milestoneId: string): void {
    if (!this.editName.trim()) return;

    const req: UpdateMilestoneRequest = {
      name: this.editName.trim(),
      description: this.editDescription.trim() || undefined,
      color: this.editColor,
    };

    if (this.editDueDate) {
      req.due_date = new Date(this.editDueDate).toISOString();
    }

    this.milestoneService.update(milestoneId, req).subscribe({
      next: (updated) => {
        this.milestones.update((milestones) =>
          milestones.map((m) =>
            m.id === milestoneId ? { ...m, ...updated } : m,
          ),
        );
        this.editingId.set(null);
      },
      error: (err) => console.error('Failed to update milestone:', err),
    });
  }

  confirmDelete(milestone: Milestone): void {
    if (
      !confirm(
        `Delete milestone "${milestone.name}"? Tasks will be unassigned from this milestone.`,
      )
    ) {
      return;
    }

    this.milestoneService.delete(milestone.id).subscribe({
      next: () => {
        this.milestones.update((m) => m.filter((ms) => ms.id !== milestone.id));
      },
      error: (err) => console.error('Failed to delete milestone:', err),
    });
  }

  getProgressPercent(milestone: Milestone): number {
    if (milestone.total_tasks === 0) return 0;
    return Math.round(
      (milestone.completed_tasks / milestone.total_tasks) * 100,
    );
  }

  getDueDateClass(dueDate: string): string {
    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil(
      (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) return 'text-red-600';
    if (diffDays <= 3) return 'text-orange-500';
    return 'text-gray-500';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private loadMilestones(): void {
    this.loading.set(true);
    this.milestoneService.list(this.boardId()).subscribe({
      next: (milestones) => {
        this.milestones.set(milestones);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load milestones:', err);
        this.loading.set(false);
      },
    });
  }

  private resetCreateForm(): void {
    this.newName = '';
    this.newDescription = '';
    this.newDueDate = '';
    this.newColor = '#6366f1';
  }
}
