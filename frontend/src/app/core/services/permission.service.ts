import { Injectable, computed, inject } from '@angular/core';
import { AuthService, User } from './auth.service';

/**
 * Role hierarchy (highest to lowest):
 *   SuperAdmin > Admin > Manager > Member
 *
 * The hierarchy maps each role to a numeric level so that
 * `hasRole('Admin')` returns true for SuperAdmin too.
 */
const ROLE_HIERARCHY: Record<string, number> = {
  SuperAdmin: 4,
  Admin: 3,
  Manager: 2,
  Member: 1,
};

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private readonly authService = inject(AuthService);

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
  readonly isSuperAdmin = computed(() => this.roleLevel() >= ROLE_HIERARCHY['SuperAdmin']);

  /** Reactive computed: true when the current user is Admin or above. */
  readonly isAdminOrAbove = computed(() => this.roleLevel() >= ROLE_HIERARCHY['Admin']);

  /** Reactive computed: true when the current user is Manager or above. */
  readonly isManagerOrAbove = computed(() => this.roleLevel() >= ROLE_HIERARCHY['Manager']);

  /** Get the role string for the current user (or null). */
  readonly currentRole = computed(() => {
    const user = this.authService.currentUser();
    return user?.role ?? null;
  });
}
