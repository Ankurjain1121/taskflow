import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService, User } from './auth.service';

export interface Capabilities {
  can_view_all_tasks: boolean;
  can_create_tasks: boolean;
  can_edit_own_tasks: boolean;
  can_edit_all_tasks: boolean;
  can_delete_tasks: boolean;
  can_manage_members: boolean;
  can_manage_project_settings: boolean;
  can_manage_automations: boolean;
  can_export: boolean;
  can_manage_billing: boolean;
  can_invite_members: boolean;
  can_manage_roles: boolean;
}

/**
 * Role hierarchy (highest to lowest):
 *   SuperAdmin > Admin > Manager > Member
 *
 * The hierarchy maps each role to a numeric level so that
 * `hasRole('Admin')` returns true for SuperAdmin too.
 */
const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  member: 1,
};

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);

  /** Reactive: current user's role level (0 if not logged in). */
  private readonly roleLevel = computed(() => {
    const user = this.authService.currentUser();
    return user ? (ROLE_HIERARCHY[user.role] ?? 0) : 0;
  });

  /**
   * Returns true if the current user's role is at least `minimumRole`.
   * Example: `hasRole('Admin')` is true for SuperAdmin and Admin.
   */
  hasRole(minimumRole: string): boolean {
    const required = ROLE_HIERARCHY[minimumRole] ?? 0;
    return this.roleLevel() >= required;
  }

  /** Reactive computed: true when the current user is SuperAdmin. */
  readonly isSuperAdmin = computed(() => this.roleLevel() >= ROLE_HIERARCHY['super_admin']);

  /** Reactive computed: true when the current user is Admin or above. */
  readonly isAdminOrAbove = computed(() => this.roleLevel() >= ROLE_HIERARCHY['admin']);

  /** Reactive computed: true when the current user is Manager or above. */
  readonly isManagerOrAbove = computed(() => this.roleLevel() >= ROLE_HIERARCHY['manager']);

  /** Get the role string for the current user (or null). */
  readonly currentRole = computed(() => {
    const user = this.authService.currentUser();
    return user?.role ?? null;
  });

  /** Workspace capabilities loaded from the backend */
  readonly workspaceCapabilities = signal<Capabilities | null>(null);

  /** Load capabilities for the current workspace */
  loadCapabilities(workspaceId: string): void {
    this.http
      .get<Capabilities>(`/api/workspaces/${workspaceId}/my-capabilities`)
      .subscribe({
        next: (caps) => this.workspaceCapabilities.set(caps),
        error: () => this.workspaceCapabilities.set(null),
      });
  }

  /** Check if the current user has a specific workspace capability */
  hasCapability(cap: keyof Capabilities): boolean {
    const caps = this.workspaceCapabilities();
    return caps ? caps[cap] : false;
  }

  /** Clear loaded capabilities (on workspace switch) */
  clearCapabilities(): void {
    this.workspaceCapabilities.set(null);
  }
}
