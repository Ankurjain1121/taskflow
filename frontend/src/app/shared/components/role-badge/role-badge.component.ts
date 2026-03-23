import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

/**
 * Displays a small colored pill/badge for a user role.
 *
 * Usage:
 *   <app-role-badge [role]="member.role" />
 *
 * Accepts both capitalized backend roles ("SuperAdmin", "Admin") and
 * lowercase workspace-level roles ("super_admin", "admin").
 */
@Component({
  selector: 'app-role-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClasses()">
      {{ label() }}
    </span>
  `,
})
export class RoleBadgeComponent {
  role = input.required<string>();

  /** Normalize role key to lowercase for consistent lookup. */
  private readonly normalizedRole = computed(() =>
    this.role().toLowerCase().replace('_', ''),
  );

  readonly label = computed(() => {
    const labels: Record<string, string> = {
      superadmin: 'Super Admin',
      admin: 'Admin',
      manager: 'Manager',
      member: 'Member',
      viewer: 'Viewer',
      owner: 'Owner',
    };
    return labels[this.normalizedRole()] ?? this.role();
  });

  readonly badgeClasses = computed(() => {
    const base =
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';

    const colorMap: Record<string, string> = {
      superadmin:
        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      admin:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      manager:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      member:
        'bg-[var(--muted)] text-[var(--muted-foreground)]',
      viewer:
        'bg-[var(--muted)] text-[var(--muted-foreground)]',
      owner:
        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    };

    const colors =
      colorMap[this.normalizedRole()] ??
      'bg-[var(--muted)] text-[var(--muted-foreground)]';

    return `${base} ${colors}`;
  });
}
