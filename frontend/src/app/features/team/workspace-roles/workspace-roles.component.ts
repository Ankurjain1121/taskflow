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
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import {
  WorkspaceService,
  WorkspaceJobRole,
} from '../../../core/services/workspace.service';

@Component({
  selector: 'app-workspace-roles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-[var(--foreground)]">
          Job Roles
        </h3>
        <p-button
          label="Add Role"
          icon="pi pi-plus"
          size="small"
          (onClick)="showCreateForm.set(true)"
        />
      </div>

      <!-- Create Form -->
      @if (showCreateForm()) {
        <div
          class="bg-[var(--secondary)] rounded-lg p-4 border border-[var(--border)] space-y-3"
        >
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                >Name</label
              >
              <input
                pInputText
                [(ngModel)]="newRoleName"
                placeholder="e.g., Developer"
                class="w-full"
              />
            </div>
            <div>
              <label
                class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                >Color</label
              >
              <input
                type="color"
                [(ngModel)]="newRoleColor"
                class="w-full h-[38px] rounded-md border border-[var(--border)] cursor-pointer"
              />
            </div>
            <div>
              <label
                class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                >Description</label
              >
              <input
                pInputText
                [(ngModel)]="newRoleDescription"
                placeholder="Optional description"
                class="w-full"
              />
            </div>
          </div>
          <div class="flex gap-2 justify-end">
            <p-button
              label="Cancel"
              severity="secondary"
              size="small"
              (onClick)="cancelCreate()"
            />
            <p-button
              label="Create"
              size="small"
              [disabled]="!newRoleName().trim()"
              (onClick)="createRole()"
            />
          </div>
        </div>
      }

      <!-- Roles List -->
      @if (loading()) {
        <div class="text-center py-4">
          <p class="text-sm text-[var(--muted-foreground)] animate-pulse">
            Loading roles...
          </p>
        </div>
      } @else if (roles().length === 0 && !showCreateForm()) {
        <div
          class="text-center py-8 bg-[var(--secondary)]/50 rounded-lg border border-[var(--border)]"
        >
          <p class="text-sm text-[var(--muted-foreground)]">
            No job roles defined yet. Create one to get started.
          </p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (role of roles(); track role.id) {
            <div
              class="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)]/30 transition-colors"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-3 h-3 rounded-full flex-shrink-0"
                  [style.background-color]="role.color || '#6366f1'"
                ></div>
                <div>
                  <span class="text-sm font-medium text-[var(--foreground)]">{{
                    role.name
                  }}</span>
                  @if (role.description) {
                    <p class="text-xs text-[var(--muted-foreground)]">
                      {{ role.description }}
                    </p>
                  }
                </div>
              </div>
              <div class="flex items-center gap-1">
                @if (editingRoleId() === role.id) {
                  <div class="flex items-center gap-2 mr-2">
                    <input
                      pInputText
                      [(ngModel)]="editRoleName"
                      class="text-sm w-32"
                    />
                    <input
                      type="color"
                      [(ngModel)]="editRoleColor"
                      class="w-8 h-8 rounded cursor-pointer border border-[var(--border)]"
                    />
                    <p-button
                      icon="pi pi-check"
                      [text]="true"
                      size="small"
                      severity="success"
                      (onClick)="saveEdit(role.id)"
                    />
                    <p-button
                      icon="pi pi-times"
                      [text]="true"
                      size="small"
                      severity="secondary"
                      (onClick)="cancelEdit()"
                    />
                  </div>
                } @else {
                  <p-button
                    icon="pi pi-pencil"
                    [text]="true"
                    size="small"
                    severity="secondary"
                    (onClick)="startEdit(role)"
                  />
                  <p-button
                    icon="pi pi-trash"
                    [text]="true"
                    size="small"
                    severity="danger"
                    (onClick)="deleteRole(role.id)"
                  />
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class WorkspaceRolesComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);

  workspaceId = input.required<string>();

  roles = signal<WorkspaceJobRole[]>([]);
  loading = signal(true);
  showCreateForm = signal(false);

  newRoleName = signal('');
  newRoleColor = signal('#6366f1');
  newRoleDescription = signal('');

  editingRoleId = signal<string | null>(null);
  editRoleName = '';
  editRoleColor = '';

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading.set(true);
    this.workspaceService.listJobRoles(this.workspaceId()).subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  createRole(): void {
    const name = this.newRoleName().trim();
    if (!name) return;

    this.workspaceService
      .createJobRole(
        this.workspaceId(),
        name,
        this.newRoleColor(),
        this.newRoleDescription().trim() || undefined,
      )
      .subscribe({
        next: (role) => {
          this.roles.update((r) => [...r, role]);
          this.cancelCreate();
        },
      });
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
    this.newRoleName.set('');
    this.newRoleColor.set('#6366f1');
    this.newRoleDescription.set('');
  }

  startEdit(role: WorkspaceJobRole): void {
    this.editingRoleId.set(role.id);
    this.editRoleName = role.name;
    this.editRoleColor = role.color || '#6366f1';
  }

  cancelEdit(): void {
    this.editingRoleId.set(null);
  }

  saveEdit(roleId: string): void {
    this.workspaceService
      .updateJobRole(this.workspaceId(), roleId, {
        name: this.editRoleName.trim() || undefined,
        color: this.editRoleColor || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.roles.update((roles) =>
            roles.map((r) => (r.id === updated.id ? updated : r)),
          );
          this.editingRoleId.set(null);
        },
      });
  }

  deleteRole(roleId: string): void {
    this.workspaceService.deleteJobRole(this.workspaceId(), roleId).subscribe({
      next: () => {
        this.roles.update((roles) => roles.filter((r) => r.id !== roleId));
      },
    });
  }
}
