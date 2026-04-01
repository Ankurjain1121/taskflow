import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RoleService,
  WorkspaceRole,
  Capabilities,
  defaultCapabilities,
} from '../../../core/services/role.service';

interface CapabilityDef {
  key: keyof Capabilities;
  label: string;
}

const CAPABILITY_DEFINITIONS: CapabilityDef[] = [
  { key: 'can_view_all_tasks', label: 'View all tasks' },
  { key: 'can_create_tasks', label: 'Create tasks' },
  { key: 'can_edit_own_tasks', label: 'Edit own tasks' },
  { key: 'can_edit_all_tasks', label: 'Edit all tasks' },
  { key: 'can_delete_tasks', label: 'Delete tasks' },
  { key: 'can_manage_members', label: 'Manage members' },
  { key: 'can_manage_project_settings', label: 'Manage project settings' },
  { key: 'can_manage_automations', label: 'Manage automations' },
  { key: 'can_export', label: 'Export data' },
  { key: 'can_manage_billing', label: 'Manage billing' },
  { key: 'can_invite_members', label: 'Invite members' },
  { key: 'can_manage_roles', label: 'Manage roles' },
];

@Component({
  selector: 'app-workspace-roles-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-6">
      <!-- Error banner -->
      @if (errorMessage()) {
        <div
          class="p-3 rounded-md text-sm text-[var(--status-red-text)] bg-[var(--status-red-bg)] border border-[var(--status-red-border)]"
        >
          {{ errorMessage() }}
        </div>
      }

      <!-- Header + Create button -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-[var(--foreground)]">Roles</h3>
          <p class="text-sm text-[var(--muted-foreground)]">
            Manage workspace roles and their permissions
          </p>
        </div>
        @if (!showCreateForm()) {
          <button
            (click)="openCreateForm()"
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:brightness-90"
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
            Create Custom Role
          </button>
        }
      </div>

      <!-- Create Role Form -->
      @if (showCreateForm()) {
        <div
          class="widget-card p-6 border-2 border-primary/30"
        >
          <h4
            class="text-sm font-semibold text-[var(--foreground)] mb-4"
          >
            New Custom Role
          </h4>
          <div class="space-y-4">
            <div>
              <label
                for="new-role-name"
                class="block text-sm font-medium text-[var(--foreground)] mb-1"
                >Name</label
              >
              <input
                id="new-role-name"
                type="text"
                [(ngModel)]="newRoleName"
                placeholder="e.g. QA Lead, Designer"
                class="block w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 shadow-sm focus:border-primary focus:ring-ring sm:text-sm"
              />
            </div>
            <div>
              <label
                for="new-role-desc"
                class="block text-sm font-medium text-[var(--foreground)] mb-1"
                >Description</label
              >
              <input
                id="new-role-desc"
                type="text"
                [(ngModel)]="newRoleDescription"
                placeholder="Brief description of this role"
                class="block w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 shadow-sm focus:border-primary focus:ring-ring sm:text-sm"
              />
            </div>

            <!-- Capability toggles for new role -->
            <div>
              <p class="text-sm font-medium text-[var(--foreground)] mb-2">
                Capabilities
              </p>
              <div
                class="grid grid-cols-1 sm:grid-cols-2 gap-2"
              >
                @for (cap of capabilityDefs; track cap.key) {
                  <label
                    class="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--muted)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      [checked]="newRoleCapabilities()[cap.key]"
                      (change)="toggleNewCapability(cap.key)"
                      class="rounded border-[var(--border)] text-primary focus:ring-ring"
                    />
                    <span class="text-sm text-[var(--foreground)]">{{
                      cap.label
                    }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="flex items-center gap-2 pt-2">
              <button
                (click)="createRole()"
                [disabled]="creatingRole() || !newRoleName.trim()"
                class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:brightness-90 disabled:opacity-50"
              >
                @if (creatingRole()) {
                  Creating...
                } @else {
                  Create Role
                }
              </button>
              <button
                (click)="cancelCreate()"
                class="inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Loading state -->
      @if (loading()) {
        <div class="flex items-center justify-center py-12">
          <svg
            class="animate-spin h-8 w-8 text-primary"
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
        <!-- Roles List -->
        <div class="space-y-4">
          @for (role of roles(); track role.id) {
            <div class="widget-card">
              <!-- Role header -->
              <div
                class="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between"
              >
                <div class="flex items-center gap-3">
                  @if (editingRoleId() === role.id) {
                    <input
                      type="text"
                      [ngModel]="editRoleName"
                      (ngModelChange)="editRoleName = $event"
                      class="rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-2 py-1 text-sm font-semibold focus:border-primary focus:ring-ring"
                    />
                  } @else {
                    <h4
                      class="text-sm font-semibold text-[var(--foreground)]"
                    >
                      {{ role.name }}
                    </h4>
                  }
                  @if (role.is_system) {
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--secondary)] text-[var(--muted-foreground)]"
                    >
                      System
                    </span>
                  }
                </div>
                <div class="flex items-center gap-2">
                  @if (!role.is_system) {
                    @if (editingRoleId() === role.id) {
                      <button
                        (click)="saveEdit(role)"
                        [disabled]="savingRole()"
                        class="text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        {{ savingRole() ? 'Saving...' : 'Save' }}
                      </button>
                      <button
                        (click)="cancelEdit()"
                        class="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        Cancel
                      </button>
                    } @else {
                      <button
                        (click)="startEdit(role)"
                        class="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        Edit
                      </button>
                      <button
                        (click)="deleteRole(role)"
                        [disabled]="deletingRoleId() === role.id"
                        class="text-sm text-[var(--status-red-text)] hover:text-red-700 disabled:opacity-50"
                      >
                        {{
                          deletingRoleId() === role.id
                            ? 'Deleting...'
                            : 'Delete'
                        }}
                      </button>
                    }
                  }
                </div>
              </div>

              <!-- Role description -->
              <div class="px-6 py-3 border-b border-[var(--border)]">
                @if (editingRoleId() === role.id) {
                  <input
                    type="text"
                    [ngModel]="editRoleDescription"
                    (ngModelChange)="editRoleDescription = $event"
                    placeholder="Role description"
                    class="w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-2 py-1 text-sm focus:border-primary focus:ring-ring"
                  />
                } @else {
                  <p class="text-sm text-[var(--muted-foreground)]">
                    {{ role.description || 'No description' }}
                  </p>
                }
              </div>

              <!-- Capabilities grid -->
              <div class="px-6 py-4">
                <p
                  class="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-3"
                >
                  Capabilities
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  @for (cap of capabilityDefs; track cap.key) {
                    <label
                      class="flex items-center gap-2 px-3 py-2 rounded-md"
                      [class.hover:bg-[var(--muted)]]="
                        editingRoleId() === role.id && !role.is_system
                      "
                      [class.cursor-pointer]="
                        editingRoleId() === role.id && !role.is_system
                      "
                    >
                      <input
                        type="checkbox"
                        [checked]="getCapability(role, cap.key)"
                        (change)="toggleEditCapability(role, cap.key)"
                        [disabled]="
                          role.is_system || editingRoleId() !== role.id
                        "
                        class="rounded border-[var(--border)] text-primary focus:ring-ring disabled:opacity-60"
                      />
                      <span
                        class="text-sm"
                        [class.text-[var(--foreground)]]="
                          getCapability(role, cap.key)
                        "
                        [class.text-[var(--muted-foreground)]]="
                          !getCapability(role, cap.key)
                        "
                        >{{ cap.label }}</span
                      >
                    </label>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        @if (roles().length === 0) {
          <div
            class="text-center py-12 text-[var(--muted-foreground)]"
          >
            <p>No roles found for this workspace.</p>
          </div>
        }
      }
    </div>
  `,
})
export class WorkspaceRolesTabComponent implements OnInit {
  private roleService = inject(RoleService);
  private destroyRef = inject(DestroyRef);

  workspaceId = input.required<string>();

  roles = signal<WorkspaceRole[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  // Create form state
  showCreateForm = signal(false);
  newRoleName = '';
  newRoleDescription = '';
  newRoleCapabilities = signal<Capabilities>(defaultCapabilities());
  creatingRole = signal(false);

  // Edit state
  editingRoleId = signal<string | null>(null);
  editRoleName = '';
  editRoleDescription = '';
  editCapabilities = signal<Capabilities>(defaultCapabilities());
  savingRole = signal(false);

  // Delete state
  deletingRoleId = signal<string | null>(null);

  capabilityDefs = CAPABILITY_DEFINITIONS;

  ngOnInit(): void {
    this.loadRoles();
  }

  openCreateForm(): void {
    this.showCreateForm.set(true);
    this.newRoleName = '';
    this.newRoleDescription = '';
    this.newRoleCapabilities.set(defaultCapabilities());
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
  }

  toggleNewCapability(key: keyof Capabilities): void {
    this.newRoleCapabilities.update((caps) => ({
      ...caps,
      [key]: !caps[key],
    }));
  }

  createRole(): void {
    if (!this.newRoleName.trim()) return;

    this.creatingRole.set(true);
    this.roleService
      .createRole(this.workspaceId(), {
        name: this.newRoleName.trim(),
        description: this.newRoleDescription.trim() || undefined,
        capabilities: this.newRoleCapabilities(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (role) => {
          this.roles.update((roles) => [...roles, role]);
          this.showCreateForm.set(false);
          this.creatingRole.set(false);
        },
        error: () => {
          this.showError('Failed to create role');
          this.creatingRole.set(false);
        },
      });
  }

  startEdit(role: WorkspaceRole): void {
    this.editingRoleId.set(role.id);
    this.editRoleName = role.name;
    this.editRoleDescription = role.description || '';
    this.editCapabilities.set({ ...role.capabilities });
  }

  cancelEdit(): void {
    this.editingRoleId.set(null);
  }

  getCapability(role: WorkspaceRole, key: keyof Capabilities): boolean {
    if (this.editingRoleId() === role.id) {
      return this.editCapabilities()[key];
    }
    return role.capabilities[key] ?? false;
  }

  toggleEditCapability(role: WorkspaceRole, key: keyof Capabilities): void {
    if (role.is_system || this.editingRoleId() !== role.id) return;
    this.editCapabilities.update((caps) => ({
      ...caps,
      [key]: !caps[key],
    }));
  }

  saveEdit(role: WorkspaceRole): void {
    this.savingRole.set(true);
    this.roleService
      .updateRole(this.workspaceId(), role.id, {
        name: this.editRoleName.trim() || undefined,
        description: this.editRoleDescription.trim() || undefined,
        capabilities: this.editCapabilities(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.roles.update((roles) =>
            roles.map((r) => (r.id === updated.id ? updated : r)),
          );
          this.editingRoleId.set(null);
          this.savingRole.set(false);
        },
        error: () => {
          this.showError('Failed to update role');
          this.savingRole.set(false);
        },
      });
  }

  deleteRole(role: WorkspaceRole): void {
    if (role.is_system) return;

    if (
      !confirm(
        `Delete role "${role.name}"? Members with this role will need to be reassigned.`,
      )
    ) {
      return;
    }

    this.deletingRoleId.set(role.id);
    this.roleService.deleteRole(this.workspaceId(), role.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.roles.update((roles) => roles.filter((r) => r.id !== role.id));
        this.deletingRoleId.set(null);
      },
      error: () => {
        this.showError('Failed to delete role');
        this.deletingRoleId.set(null);
      },
    });
  }

  private loadRoles(): void {
    this.loading.set(true);
    this.roleService.listRoles(this.workspaceId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: () => {
        this.showError('Failed to load roles');
        this.loading.set(false);
      },
    });
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }
}
