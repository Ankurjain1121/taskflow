import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { Tooltip } from 'primeng/tooltip';
import {
  PositionService,
  Position,
  CreatePositionRequest,
  UpdatePositionRequest,
} from '../../../core/services/position.service';
import { BoardMember } from '../../../core/services/board.service';

@Component({
  selector: 'app-position-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    Dialog,
    InputTextModule,
    TextareaModule,
    Select,
    ConfirmDialog,
    Tooltip,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-[var(--card)] shadow rounded-lg">
      <div class="px-6 py-4 border-b border-[var(--border)]">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium text-[var(--foreground)]">
              Positions
            </h3>
            <p class="text-sm text-[var(--muted-foreground)] mt-0.5">
              Organizational roles for recurring task assignment
            </p>
          </div>
          <button
            (click)="openCreateDialog()"
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
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
            Add Position
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="px-6 py-8 text-center">
          <svg
            class="animate-spin h-6 w-6 text-primary mx-auto"
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
      }

      @if (error()) {
        <div class="px-6 py-4">
          <div
            class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800"
          >
            {{ error() }}
            <button
              (click)="loadPositions()"
              class="underline ml-2 hover:text-red-600"
            >
              Try again
            </button>
          </div>
        </div>
      }

      @if (!loading() && !error() && positions().length === 0) {
        <div class="px-6 py-8 text-center text-[var(--muted-foreground)]">
          <svg
            class="w-12 h-12 mx-auto mb-3 text-[var(--muted-foreground)] opacity-40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p class="text-sm">No positions yet</p>
          <p class="text-xs mt-1">
            Create positions to automatically assign recurring tasks to the
            right people
          </p>
        </div>
      }

      @if (!loading() && positions().length > 0) {
        <div class="divide-y divide-[var(--border)]">
          @for (pos of positions(); track pos.id) {
            <div class="px-6 py-4 hover:bg-[var(--muted)]/50 transition-colors">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <h4
                      class="text-sm font-medium text-[var(--foreground)] truncate"
                    >
                      {{ pos.name }}
                    </h4>
                    @if (pos.recurring_task_count > 0) {
                      <span
                        class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded"
                        pTooltip="Linked recurring tasks"
                      >
                        <i class="pi pi-replay text-[10px]"></i>
                        {{ pos.recurring_task_count }}
                      </span>
                    }
                  </div>
                  @if (pos.description) {
                    <p
                      class="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-1"
                    >
                      {{ pos.description }}
                    </p>
                  }

                  <!-- Holders -->
                  <div class="flex items-center gap-2 mt-2">
                    <span class="text-xs text-[var(--muted-foreground)]"
                      >Holders:</span
                    >
                    @if (pos.holders.length > 0) {
                      <div class="flex items-center -space-x-1.5">
                        @for (
                          holder of pos.holders;
                          track holder.user_id;
                          let i = $index
                        ) {
                          @if (i < 5) {
                            <div
                              class="w-6 h-6 rounded-full border-2 border-[var(--card)] bg-[var(--secondary)] flex items-center justify-center text-[10px] font-medium text-[var(--muted-foreground)] cursor-default"
                              [pTooltip]="holder.name || holder.email"
                            >
                              @if (holder.avatar_url) {
                                <img
                                  [src]="holder.avatar_url"
                                  [alt]="holder.name"
                                  class="w-full h-full rounded-full object-cover"
                                />
                              } @else {
                                {{ getInitials(holder.name || holder.email) }}
                              }
                            </div>
                          }
                        }
                        @if (pos.holders.length > 5) {
                          <div
                            class="w-6 h-6 rounded-full border-2 border-[var(--card)] bg-[var(--secondary)] flex items-center justify-center text-[10px] font-medium text-[var(--muted-foreground)]"
                          >
                            +{{ pos.holders.length - 5 }}
                          </div>
                        }
                      </div>
                    } @else {
                      <span class="text-xs text-amber-500"
                        >None (will use fallback)</span
                      >
                    }

                    <!-- Add holder button -->
                    <button
                      (click)="openAddHolderDialog(pos)"
                      class="w-6 h-6 rounded-full border border-dashed border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:border-primary hover:text-primary transition-colors"
                      pTooltip="Add holder"
                    >
                      <svg
                        class="w-3 h-3"
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
                    </button>
                  </div>

                  <!-- Fallback info -->
                  @if (pos.fallback_position_name) {
                    <div
                      class="flex items-center gap-1 mt-1 text-xs text-[var(--muted-foreground)]"
                    >
                      <svg
                        class="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                      Fallback: {{ pos.fallback_position_name }}
                    </div>
                  }
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-1 flex-shrink-0">
                  <button
                    (click)="openEditDialog(pos)"
                    class="p-1.5 text-[var(--muted-foreground)] hover:text-primary rounded transition-colors"
                    pTooltip="Edit"
                  >
                    <i class="pi pi-pencil text-xs"></i>
                  </button>
                  <button
                    (click)="onDeletePosition(pos)"
                    class="p-1.5 text-[var(--muted-foreground)] hover:text-red-500 rounded transition-colors"
                    pTooltip="Delete"
                  >
                    <i class="pi pi-trash text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Create / Edit Dialog -->
    <p-dialog
      [(visible)]="showFormDialog"
      [header]="editingPosition() ? 'Edit Position' : 'New Position'"
      [modal]="true"
      [style]="{ width: '28rem' }"
      [draggable]="false"
      [resizable]="false"
    >
      <div class="space-y-4 pt-2">
        <div>
          <label class="block text-sm font-medium text-[var(--foreground)] mb-1"
            >Name</label
          >
          <input
            pInputText
            [(ngModel)]="formName"
            class="w-full"
            placeholder="e.g. Service Manager 1"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--foreground)] mb-1"
            >Description (optional)</label
          >
          <textarea
            pTextarea
            [(ngModel)]="formDescription"
            class="w-full"
            rows="2"
            placeholder="What this position is responsible for"
          ></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--foreground)] mb-1"
            >Fallback Position (optional)</label
          >
          <p-select
            [(ngModel)]="formFallbackId"
            [options]="fallbackOptions()"
            optionLabel="label"
            optionValue="value"
            placeholder="None"
            [showClear]="true"
            styleClass="w-full"
          />
          <p class="text-xs text-[var(--muted-foreground)] mt-1">
            If this position has no holders, tasks go to the fallback
          </p>
        </div>
      </div>
      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="showFormDialog.set(false)"
          />
          <p-button
            [label]="editingPosition() ? 'Save' : 'Create'"
            (onClick)="onSavePosition()"
            [disabled]="!formName.trim() || savingForm()"
            [loading]="savingForm()"
          />
        </div>
      </ng-template>
    </p-dialog>

    <!-- Add Holder Dialog -->
    <p-dialog
      [(visible)]="showHolderDialog"
      header="Add Holder"
      [modal]="true"
      [style]="{ width: '24rem' }"
      [draggable]="false"
      [resizable]="false"
    >
      <div class="space-y-3 pt-2">
        <p class="text-sm text-[var(--muted-foreground)]">
          Select a board member to assign to this position
        </p>
        <p-select
          [(ngModel)]="selectedHolderUserId"
          [options]="availableHolderOptions()"
          optionLabel="label"
          optionValue="value"
          placeholder="Select member"
          styleClass="w-full"
        />

        @if (holderPosition()?.holders?.length) {
          <div>
            <p class="text-xs font-medium text-[var(--muted-foreground)] mb-2">
              Current holders:
            </p>
            <div class="space-y-1">
              @for (
                holder of holderPosition()?.holders ?? [];
                track holder.user_id
              ) {
                <div
                  class="flex items-center justify-between py-1 px-2 rounded bg-[var(--muted)]"
                >
                  <div class="flex items-center gap-2">
                    <div
                      class="w-5 h-5 rounded-full bg-[var(--secondary)] flex items-center justify-center text-[9px] font-medium text-[var(--muted-foreground)]"
                    >
                      {{ getInitials(holder.name || holder.email) }}
                    </div>
                    <span class="text-sm text-[var(--foreground)]">{{
                      holder.name || holder.email
                    }}</span>
                  </div>
                  <button
                    (click)="onRemoveHolder(holder.user_id)"
                    class="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              }
            </div>
          </div>
        }
      </div>
      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Close"
            [text]="true"
            severity="secondary"
            (onClick)="showHolderDialog.set(false)"
          />
          <p-button
            label="Add"
            (onClick)="onAddHolder()"
            [disabled]="!selectedHolderUserId || savingHolder()"
            [loading]="savingHolder()"
          />
        </div>
      </ng-template>
    </p-dialog>

    <p-confirmDialog />
  `,
})
export class PositionListComponent implements OnInit, OnChanges {
  boardId = input.required<string>();
  boardMembers = input<BoardMember[]>([]);

  private positionService = inject(PositionService);
  private confirmationService = inject(ConfirmationService);

  positions = signal<Position[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Form dialog state
  showFormDialog = signal(false);
  editingPosition = signal<Position | null>(null);
  formName = '';
  formDescription = '';
  formFallbackId: string | null = null;
  savingForm = signal(false);

  // Holder dialog state
  showHolderDialog = signal(false);
  holderPosition = signal<Position | null>(null);
  selectedHolderUserId = '';
  savingHolder = signal(false);

  fallbackOptions = computed(() => {
    const editing = this.editingPosition();
    return this.positions()
      .filter((p) => !editing || p.id !== editing.id)
      .map((p) => ({ label: p.name, value: p.id }));
  });

  availableHolderOptions = computed(() => {
    const pos = this.holderPosition();
    const currentHolderIds = new Set(pos?.holders.map((h) => h.user_id) ?? []);
    return this.boardMembers()
      .filter((m) => !currentHolderIds.has(m.user_id))
      .map((m) => ({
        label: m.name || m.email || 'Unknown',
        value: m.user_id,
      }));
  });

  ngOnInit(): void {
    this.loadPositions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['boardId'] && !changes['boardId'].firstChange) {
      this.loadPositions();
    }
  }

  loadPositions(): void {
    this.loading.set(true);
    this.error.set(null);

    this.positionService.listPositions(this.boardId()).subscribe({
      next: (positions) => {
        this.positions.set(positions);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load positions.');
        this.loading.set(false);
      },
    });
  }

  getInitials(name: string | undefined): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  openCreateDialog(): void {
    this.editingPosition.set(null);
    this.formName = '';
    this.formDescription = '';
    this.formFallbackId = null;
    this.showFormDialog.set(true);
  }

  openEditDialog(pos: Position): void {
    this.editingPosition.set(pos);
    this.formName = pos.name;
    this.formDescription = pos.description ?? '';
    this.formFallbackId = pos.fallback_position_id;
    this.showFormDialog.set(true);
  }

  onSavePosition(): void {
    if (!this.formName.trim()) return;

    this.savingForm.set(true);
    const editing = this.editingPosition();

    if (editing) {
      const req: UpdatePositionRequest = {
        name: this.formName.trim(),
        description: this.formDescription.trim() || undefined,
        fallback_position_id: this.formFallbackId,
      };
      this.positionService.updatePosition(editing.id, req).subscribe({
        next: (updated) => {
          this.positions.update((list) =>
            list.map((p) => (p.id === updated.id ? updated : p)),
          );
          this.showFormDialog.set(false);
          this.savingForm.set(false);
        },
        error: () => {
          this.savingForm.set(false);
        },
      });
    } else {
      const req: CreatePositionRequest = {
        name: this.formName.trim(),
        description: this.formDescription.trim() || undefined,
        fallback_position_id: this.formFallbackId ?? undefined,
      };
      this.positionService.createPosition(this.boardId(), req).subscribe({
        next: (created) => {
          this.positions.update((list) => [...list, created]);
          this.showFormDialog.set(false);
          this.savingForm.set(false);
        },
        error: () => {
          this.savingForm.set(false);
        },
      });
    }
  }

  onDeletePosition(pos: Position): void {
    this.confirmationService.confirm({
      message: `Delete position "${pos.name}"? Any linked recurring tasks will revert to manual assignment.`,
      header: 'Delete Position',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.positionService.deletePosition(pos.id).subscribe({
          next: () => {
            this.positions.update((list) =>
              list.filter((p) => p.id !== pos.id),
            );
          },
        });
      },
    });
  }

  openAddHolderDialog(pos: Position): void {
    this.holderPosition.set(pos);
    this.selectedHolderUserId = '';
    this.showHolderDialog.set(true);
  }

  onAddHolder(): void {
    const pos = this.holderPosition();
    if (!pos || !this.selectedHolderUserId) return;

    this.savingHolder.set(true);
    this.positionService
      .addHolder(pos.id, this.selectedHolderUserId)
      .subscribe({
        next: () => {
          this.savingHolder.set(false);
          this.selectedHolderUserId = '';
          this.refreshPosition(pos.id);
        },
        error: () => {
          this.savingHolder.set(false);
        },
      });
  }

  onRemoveHolder(userId: string): void {
    const pos = this.holderPosition();
    if (!pos) return;

    this.positionService.removeHolder(pos.id, userId).subscribe({
      next: () => {
        this.refreshPosition(pos.id);
      },
    });
  }

  private refreshPosition(positionId: string): void {
    this.positionService.getPosition(positionId).subscribe({
      next: (updated) => {
        this.positions.update((list) =>
          list.map((p) => (p.id === updated.id ? updated : p)),
        );
        if (this.holderPosition()?.id === updated.id) {
          this.holderPosition.set(updated);
        }
      },
    });
  }
}
