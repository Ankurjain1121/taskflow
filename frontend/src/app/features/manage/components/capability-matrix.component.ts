import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import {
  RoleService,
  WorkspaceRole,
  Capabilities,
} from '../../../core/services/role.service';

interface CapabilityItem {
  key: keyof Capabilities;
  label: string;
  category: string;
}

const CAPABILITY_ITEMS: CapabilityItem[] = [
  { key: 'can_view_all_tasks', label: 'View all tasks', category: 'TASKS' },
  { key: 'can_create_tasks', label: 'Create tasks', category: 'TASKS' },
  { key: 'can_edit_own_tasks', label: 'Edit own tasks', category: 'TASKS' },
  { key: 'can_edit_all_tasks', label: 'Edit all tasks', category: 'TASKS' },
  { key: 'can_delete_tasks', label: 'Delete tasks', category: 'TASKS' },
  { key: 'can_manage_project_settings', label: 'Manage settings', category: 'PROJECT' },
  { key: 'can_manage_automations', label: 'Manage automations', category: 'PROJECT' },
  { key: 'can_manage_members', label: 'Manage members', category: 'WORKSPACE' },
  { key: 'can_invite_members', label: 'Invite members', category: 'WORKSPACE' },
  { key: 'can_manage_roles', label: 'Manage roles', category: 'WORKSPACE' },
  { key: 'can_manage_billing', label: 'Manage billing', category: 'WORKSPACE' },
  { key: 'can_export', label: 'Export data', category: 'DATA' },
];

@Component({
  selector: 'app-capability-matrix',
  standalone: true,
  imports: [CommonModule, TableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <!-- Skeleton -->
      <div class="rounded-xl border border-[var(--border)] overflow-hidden">
        @for (i of skeletonRows; track i) {
          <div class="flex gap-4 p-3 border-b border-[var(--border)] last:border-b-0">
            <div class="w-40 h-4 bg-[var(--muted)] rounded animate-pulse"></div>
            @for (j of [1,2,3,4,5]; track j) {
              <div class="w-11 h-4 bg-[var(--muted)] rounded animate-pulse"></div>
            }
          </div>
        }
      </div>
    } @else if (errorMessage()) {
      <div class="rounded-xl border border-red-200 dark:border-red-800 p-6 text-center">
        <i class="pi pi-exclamation-triangle text-2xl text-red-500 mb-2"></i>
        <p class="text-sm text-[var(--muted-foreground)] mb-3">{{ errorMessage() }}</p>
        <button
          class="text-sm font-semibold text-[var(--primary)] hover:underline"
          (click)="loadRoles()">
          Retry
        </button>
      </div>
    } @else {
      <div class="rounded-xl border border-[var(--border)] overflow-x-auto">
        <table class="w-full text-sm" role="grid">
          <thead>
            <tr class="border-b border-[var(--border)]">
              <th class="text-left p-3 font-semibold text-[var(--foreground)] sticky left-0 bg-[var(--background)] min-w-[180px]"
                  role="columnheader">
                Capability
              </th>
              @for (role of roles(); track role.id) {
                <th class="p-3 text-center font-semibold text-[var(--foreground)] min-w-[80px]"
                    role="columnheader">
                  <span class="text-xs">{{ role.name }}</span>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (item of capabilityItems; track item.key; let i = $index) {
              <!-- Category separator -->
              @if (i === 0 || item.category !== capabilityItems[i - 1].category) {
                <tr>
                  <td [attr.colspan]="roles().length + 1"
                      class="px-3 py-1.5 bg-[var(--surface-secondary)] text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {{ item.category }}
                  </td>
                </tr>
              }
              <tr class="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)]/30 transition-colors">
                <td class="p-3 text-[var(--foreground)] sticky left-0 bg-[var(--background)]"
                    role="rowheader">
                  {{ item.label }}
                </td>
                @for (role of roles(); track role.id) {
                  <td class="p-3 text-center" style="width: 44px; height: 44px;">
                    @if (getRoleCap(role, item.key)) {
                      <span class="text-[var(--accent-500)]" [attr.aria-label]="'allowed'">&#9679;</span>
                    } @else {
                      <span class="text-[var(--muted-foreground)] opacity-30" [attr.aria-label]="'denied'">&#9675;</span>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      <p class="mt-2 text-xs text-[var(--muted-foreground)]">
        <span class="text-[var(--accent-500)]">&#9679;</span> = allowed
        &nbsp;&nbsp;
        <span class="opacity-30">&#9675;</span> = denied
      </p>
    }
  `,
})
export class CapabilityMatrixComponent implements OnInit {
  readonly workspaceId = input.required<string>();

  private readonly roleService = inject(RoleService);

  readonly roles = signal<WorkspaceRole[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly capabilityItems = CAPABILITY_ITEMS;
  readonly skeletonRows = Array.from({ length: 6 }, (_, i) => i);

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.roleService.listRoles(this.workspaceId()).subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set("Couldn't load roles");
        this.loading.set(false);
      },
    });
  }

  getRoleCap(role: WorkspaceRole, capKey: keyof Capabilities): boolean {
    const caps = role.capabilities;
    return caps ? caps[capKey] ?? false : false;
  }
}
