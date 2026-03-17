import {
  Component,
  input,
  output,
  signal,
  model,
  inject,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import {
  WorkspaceService,
  Workspace,
  TenantMember,
} from '../../../core/services/workspace.service';

export interface BulkAddResult {
  workspaceId: string;
  userIds: string[];
  added: number;
}

@Component({
  selector: 'app-add-to-workspace-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ButtonModule, Dialog, Select],
  template: `
    <p-dialog
      header="Add Members to Workspace"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '500px' }"
      [closable]="true"
    >
      <div class="flex flex-col gap-4">
        <!-- Selected users summary -->
        <div>
          <label
            class="text-sm font-medium text-[var(--card-foreground)] mb-2 block"
            >Selected Members ({{ users().length }})</label
          >
          <div
            class="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 bg-[var(--secondary)] rounded-lg"
          >
            @for (user of users(); track user.user_id) {
              <span
                class="inline-flex items-center gap-1 px-2 py-1 bg-[var(--card)] rounded-md text-xs border border-[var(--border)]"
              >
                <span class="font-medium">{{ user.name }}</span>
              </span>
            }
          </div>
        </div>

        <!-- Workspace selector -->
        <div>
          <label
            for="targetWs"
            class="text-sm font-medium text-[var(--card-foreground)] mb-2 block"
            >Target Workspace</label
          >
          <p-select
            [options]="availableWorkspaces()"
            [(ngModel)]="selectedWorkspaceId"
            optionLabel="name"
            optionValue="id"
            placeholder="Select a workspace"
            [style]="{ width: '100%' }"
            [filter]="true"
            filterPlaceholder="Search workspaces..."
          />
        </div>
      </div>

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="visible.set(false)"
          />
          <p-button
            label="Add to Workspace"
            (onClick)="onAdd()"
            [disabled]="!selectedWorkspaceId || saving()"
            [loading]="saving()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class AddToWorkspaceDialogComponent {
  private workspaceService = inject(WorkspaceService);

  visible = model(false);
  users = input.required<TenantMember[]>();
  workspaces = input.required<Workspace[]>();
  /** Workspace IDs the selected user(s) already belong to, for filtering */
  excludeWorkspaceIds = input<string[]>([]);

  added = output<BulkAddResult>();

  selectedWorkspaceId: string | null = null;
  saving = signal(false);

  availableWorkspaces = computed(() => {
    const excluded = new Set(this.excludeWorkspaceIds());
    return this.workspaces().filter((ws) => !excluded.has(ws.id));
  });

  onAdd(): void {
    const wsId = this.selectedWorkspaceId;
    const userIds = this.users().map((u) => u.user_id);
    if (!wsId || userIds.length === 0) return;

    this.saving.set(true);
    this.workspaceService.bulkAddMembers(wsId, userIds).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.visible.set(false);
        this.selectedWorkspaceId = null;
        this.added.emit({
          workspaceId: wsId,
          userIds,
          added: result.added,
        });
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }
}
