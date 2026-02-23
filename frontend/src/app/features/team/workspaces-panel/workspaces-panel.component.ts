import {
  Component,
  input,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import {
  WorkspaceService,
  Workspace,
} from '../../../core/services/workspace.service';
import { CreateWorkspaceDialogComponent } from '../create-workspace-dialog/create-workspace-dialog.component';

interface WorkspaceCard {
  workspace: Workspace;
  memberCount: number;
}

@Component({
  selector: 'app-workspaces-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    Dialog,
    InputTextModule,
    Tag,
    CreateWorkspaceDialogComponent,
  ],
  template: `
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-[var(--card-foreground)]">
          Workspaces
        </h2>
        <p-button
          label="Create Workspace"
          icon="pi pi-plus"
          size="small"
          (onClick)="showCreateDialog.set(true)"
        />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (card of workspaceCards(); track card.workspace.id) {
          <div
            class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 hover:shadow-md transition-shadow"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="min-w-0 flex-1">
                @if (editingId() === card.workspace.id) {
                  <div class="flex items-center gap-2">
                    <input
                      pInputText
                      [(ngModel)]="editName"
                      class="text-sm w-full"
                      (keyup.enter)="saveRename(card.workspace)"
                      (keyup.escape)="cancelRename()"
                    />
                    <p-button
                      icon="pi pi-check"
                      [text]="true"
                      size="small"
                      (onClick)="saveRename(card.workspace)"
                      [loading]="renameSaving()"
                    />
                    <p-button
                      icon="pi pi-times"
                      [text]="true"
                      size="small"
                      severity="secondary"
                      (onClick)="cancelRename()"
                    />
                  </div>
                } @else {
                  <h3
                    class="font-semibold text-[var(--card-foreground)] truncate"
                  >
                    {{ card.workspace.name }}
                  </h3>
                }
              </div>
              @if (editingId() !== card.workspace.id) {
                <p-tag
                  [value]="card.workspace.visibility === 'open' ? 'Open' : 'Closed'"
                  [severity]="card.workspace.visibility === 'open' ? 'success' : 'secondary'"
                  class="ml-2 flex-shrink-0"
                />
              }
            </div>

            @if (card.workspace.description) {
              <p
                class="text-sm text-[var(--muted-foreground)] mb-3 line-clamp-2"
              >
                {{ card.workspace.description }}
              </p>
            }

            <div
              class="flex items-center justify-between text-sm text-[var(--muted-foreground)]"
            >
              <span>{{ card.memberCount }} members</span>
              <span>{{
                card.workspace.created_at | date: 'mediumDate'
              }}</span>
            </div>

            <div
              class="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--border)]"
            >
              <p-button
                icon="pi pi-pencil"
                [text]="true"
                size="small"
                severity="secondary"
                pTooltip="Rename"
                (onClick)="startRename(card.workspace)"
              />
              <a
                [routerLink]="['/workspace', card.workspace.id, 'settings']"
                class="p-button p-button-text p-button-sm p-button-secondary"
              >
                <i class="pi pi-cog text-sm"></i>
              </a>
              <div class="flex-1"></div>
              <p-button
                icon="pi pi-trash"
                [text]="true"
                size="small"
                severity="danger"
                pTooltip="Delete"
                (onClick)="confirmDelete(card.workspace)"
              />
            </div>
          </div>
        }
      </div>

      @if (workspaceCards().length === 0) {
        <div class="text-center py-8">
          <p class="text-sm text-[var(--muted-foreground)]">
            No workspaces yet. Create one to get started.
          </p>
        </div>
      }
    </div>

    <!-- Create Dialog -->
    <app-create-workspace-dialog
      [(visible)]="showCreateDialog"
      (created)="onWorkspaceCreated($event)"
    />

    <!-- Delete Confirmation Dialog -->
    <p-dialog
      header="Delete Workspace"
      [(visible)]="showDeleteDialog"
      [modal]="true"
      [style]="{ width: '420px' }"
    >
      <p class="text-sm text-[var(--muted-foreground)]">
        Are you sure you want to delete
        <strong>{{ deletingWorkspace()?.name }}</strong
        >? This action cannot be undone.
      </p>
      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="showDeleteDialog.set(false)"
          />
          <p-button
            label="Delete"
            severity="danger"
            (onClick)="executeDelete()"
            [loading]="deleteSaving()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class WorkspacesPanelComponent {
  private workspaceService = inject(WorkspaceService);

  workspaces = input.required<Workspace[]>();
  workspaceMemberCounts = input.required<Record<string, number>>();

  workspaceCreated = output<Workspace>();
  workspaceDeleted = output<string>();
  workspaceRenamed = output<Workspace>();

  showCreateDialog = signal(false);
  showDeleteDialog = signal(false);
  editingId = signal<string | null>(null);
  editName = '';
  renameSaving = signal(false);
  deleteSaving = signal(false);
  deletingWorkspace = signal<Workspace | null>(null);

  workspaceCards = () => {
    const counts = this.workspaceMemberCounts();
    return this.workspaces().map((ws) => ({
      workspace: ws,
      memberCount: counts[ws.id] ?? 0,
    }));
  };

  onWorkspaceCreated(ws: Workspace): void {
    this.workspaceCreated.emit(ws);
  }

  startRename(ws: Workspace): void {
    this.editingId.set(ws.id);
    this.editName = ws.name;
  }

  cancelRename(): void {
    this.editingId.set(null);
    this.editName = '';
  }

  saveRename(ws: Workspace): void {
    const trimmed = this.editName.trim();
    if (!trimmed || trimmed === ws.name) {
      this.cancelRename();
      return;
    }
    this.renameSaving.set(true);
    this.workspaceService
      .update(ws.id, { name: trimmed })
      .subscribe({
        next: (updated) => {
          this.renameSaving.set(false);
          this.editingId.set(null);
          this.workspaceRenamed.emit(updated);
        },
        error: () => {
          this.renameSaving.set(false);
        },
      });
  }

  confirmDelete(ws: Workspace): void {
    this.deletingWorkspace.set(ws);
    this.showDeleteDialog.set(true);
  }

  executeDelete(): void {
    const ws = this.deletingWorkspace();
    if (!ws) return;
    this.deleteSaving.set(true);
    this.workspaceService.delete(ws.id).subscribe({
      next: () => {
        this.deleteSaving.set(false);
        this.showDeleteDialog.set(false);
        this.workspaceDeleted.emit(ws.id);
      },
      error: () => {
        this.deleteSaving.set(false);
      },
    });
  }
}
