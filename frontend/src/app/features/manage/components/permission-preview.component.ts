import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Capabilities } from '../../../core/services/permission.service';

interface CapabilityItem {
  key: keyof Capabilities;
  label: string;
}

interface CapabilityGroup {
  name: string;
  items: CapabilityItem[];
}

const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    name: 'TASKS',
    items: [
      { key: 'can_create_tasks', label: 'Create tasks' },
      { key: 'can_edit_own_tasks', label: 'Edit own tasks' },
      { key: 'can_edit_all_tasks', label: 'Edit all tasks' },
      { key: 'can_delete_tasks', label: 'Delete tasks' },
    ],
  },
  {
    name: 'PROJECT',
    items: [
      { key: 'can_manage_project_settings', label: 'Manage settings' },
      { key: 'can_manage_automations', label: 'Manage automations' },
    ],
  },
  {
    name: 'WORKSPACE',
    items: [
      { key: 'can_manage_members', label: 'Manage members' },
      { key: 'can_invite_members', label: 'Invite members' },
      { key: 'can_manage_roles', label: 'Manage roles' },
      { key: 'can_manage_billing', label: 'Manage billing' },
    ],
  },
  {
    name: 'DATA',
    items: [
      { key: 'can_export', label: 'Export' },
      { key: 'can_view_all_tasks', label: 'View all tasks' },
    ],
  },
];

@Component({
  selector: 'app-permission-preview',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (capabilities()) {
      <div class="p-4 rounded-lg bg-[var(--surface-secondary)] max-h-[300px] overflow-y-auto">
        <p class="text-sm font-medium text-[var(--foreground)] mb-3">
          With this role, user can:
        </p>

        @for (group of groups; track group.name) {
          <div class="mb-3 last:mb-0">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
              {{ group.name }}
            </p>
            @for (item of group.items; track item.key) {
              <div class="flex items-center gap-2 py-0.5">
                @if (capabilities()![item.key]) {
                  <span class="text-[var(--accent-500)] text-sm" aria-label="allowed">&#10003;</span>
                } @else {
                  <span class="text-[var(--muted-foreground)] text-sm" aria-label="denied">&#10007;</span>
                }
                <span class="text-sm"
                  [class]="capabilities()![item.key]
                    ? 'text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)]'">
                  {{ item.label }}
                </span>
              </div>
            }
          </div>
        }
      </div>
    } @else {
      <!-- Loading skeleton -->
      <div class="p-4 rounded-lg bg-[var(--surface-secondary)]">
        @for (i of skeletonLines; track i) {
          <div class="h-4 w-3/4 bg-[var(--muted)] rounded animate-pulse mb-2"></div>
        }
      </div>
    }
  `,
})
export class PermissionPreviewComponent {
  readonly capabilities = input<Capabilities | null>(null);

  readonly groups = CAPABILITY_GROUPS;
  readonly skeletonLines = Array.from({ length: 12 }, (_, i) => i);
}
