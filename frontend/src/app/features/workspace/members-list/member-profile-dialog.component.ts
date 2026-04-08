import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  model,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { RoleBadgeComponent } from '../../../shared/components/role-badge/role-badge.component';

@Component({
  selector: 'app-member-profile-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, TooltipModule, RoleBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '560px', 'max-width': '95vw' }"
      header="Member Profile"
      [closable]="true"
      (onHide)="onDialogHide()"
    >
      @if (member()) {
        <div class="flex flex-col gap-5">
          <!-- Header: Avatar + Name + Email + Phone -->
          <div class="flex items-start gap-4">
            <div
              class="w-16 h-16 rounded-full bg-[var(--muted)] flex items-center justify-center text-xl font-semibold text-[var(--muted-foreground)] shrink-0 overflow-hidden"
            >
              @if (member()?.avatar_url) {
                <img
                  [src]="member()!.avatar_url"
                  [alt]="member()!.display_name"
                  class="w-full h-full object-cover"
                />
              } @else {
                {{ getInitials(member()!.display_name || member()!.email) }}
              }
            </div>
            <div class="min-w-0 flex-1">
              <p
                class="text-lg font-semibold text-[var(--card-foreground)] truncate"
                [pTooltip]="
                  member()!.display_name?.length > 46
                    ? member()!.display_name
                    : ''
                "
                tooltipPosition="top"
              >
                {{ member()!.display_name || 'Unknown' }}
              </p>
              <p class="text-sm text-[var(--muted-foreground)]">
                {{ member()!.email }}
              </p>
              @if (member()!.phone_number) {
                <p class="text-sm text-[var(--muted-foreground)] mt-0.5">
                  {{ member()!.phone_number }}
                </p>
              }
            </div>
          </div>

          <!-- Details Section -->
          <div class="border-t border-[var(--border)] pt-4">
            <h4 class="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Details</h4>
            <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <span class="text-[var(--muted-foreground)] text-xs">Job Title</span>
                <p class="text-[var(--card-foreground)] mt-0.5">{{ member()!.job_title || '\u2014' }}</p>
              </div>
              <div>
                <span class="text-[var(--muted-foreground)] text-xs">Department</span>
                <p class="text-[var(--card-foreground)] mt-0.5">{{ member()!.department || '\u2014' }}</p>
              </div>
              <div>
                <span class="text-[var(--muted-foreground)] text-xs">Member Since</span>
                <p class="text-[var(--card-foreground)] mt-0.5">{{ formatDate(member()!.joined_at) }}</p>
              </div>
              <div>
                <span class="text-[var(--muted-foreground)] text-xs">Last Active</span>
                <p class="text-[var(--card-foreground)] mt-0.5">{{ formatLastActive(member()!.last_login_at) }}</p>
              </div>
              <div>
                <span class="text-[var(--muted-foreground)] text-xs">Organization Role</span>
                <p class="mt-0.5">
                  <app-role-badge [role]="member()!.org_role || member()!.user_role || 'member'" />
                </p>
              </div>
              @if (member()!.workspace_count != null) {
                <div>
                  <span class="text-[var(--muted-foreground)] text-xs">Workspaces</span>
                  <p class="text-[var(--card-foreground)] mt-0.5">{{ member()!.workspace_count }}</p>
                </div>
              }
            </div>
          </div>

          <!-- Workspace Role Section (admin only) -->
          @if (canEditRole()) {
            <div class="border-t border-[var(--border)] pt-4">
              <h4 class="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Workspace Role</h4>
              <select
                [ngModel]="selectedRole()"
                (ngModelChange)="selectedRole.set($event)"
                [disabled]="saving()"
                class="text-sm font-medium rounded-lg px-3 py-2 border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 w-full"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          }

          <!-- Actions Footer -->
          <div class="border-t border-[var(--border)] pt-4 flex items-center justify-between">
            <div>
              @if (canEditRole()) {
                <button
                  (click)="onRemove()"
                  [disabled]="saving()"
                  [attr.aria-label]="
                    'Remove ' +
                    (member()!.display_name || member()!.email) +
                    ' from workspace'
                  "
                  class="text-sm text-[var(--destructive)] hover:text-[var(--destructive)] transition-colors disabled:opacity-50"
                >
                  Remove from Workspace
                </button>
              }
            </div>
            <div class="flex items-center gap-2">
              @if (isDirty()) {
                <button
                  (click)="onCancel()"
                  [disabled]="saving()"
                  class="px-4 py-1.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  (click)="onSave()"
                  [disabled]="saving()"
                  class="px-4 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  @if (saving()) {
                    <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  }
                  Save
                </button>
              }
            </div>
          </div>
        </div>
      }
    </p-dialog>
  `,
})
export class MemberProfileDialogComponent {
  readonly visible = model<boolean>(false);
  readonly member = input<any>(null);
  readonly isAdmin = input<boolean>(false);
  readonly isSuperAdmin = input<boolean>(false);
  readonly isSelf = input<boolean>(false);
  readonly isOwner = input<boolean>(false);
  readonly workspaceId = input<string>('');

  readonly roleChanged = output<{ userId: string; role: string }>();
  readonly memberRemoved = output<string>();

  readonly selectedRole = signal<string>('');
  readonly saving = signal(false);

  readonly canEditRole = computed(
    () =>
      this.isAdmin() &&
      !this.isSelf() &&
      !this.isOwner() &&
      (!this.member()?.is_org_admin || this.isSuperAdmin()),
  );

  readonly isDirty = computed(
    () => this.selectedRole() !== '' && this.selectedRole() !== this.member()?.role,
  );

  constructor() {
    effect(() => {
      const m = this.member();
      if (m) {
        this.selectedRole.set(m.role);
      }
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

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatLastActive(dateString: string | null | undefined): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60)
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7)
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return this.formatDate(dateString);
  }

  onSave(): void {
    const m = this.member();
    if (!m || !this.isDirty()) return;
    this.saving.set(true);
    this.roleChanged.emit({ userId: m.user_id, role: this.selectedRole() });
  }

  onCancel(): void {
    const m = this.member();
    if (m) {
      this.selectedRole.set(m.role);
    }
  }

  onDialogHide(): void {
    this.onCancel();
    this.saving.set(false);
  }

  onRemove(): void {
    const m = this.member();
    if (!m) return;
    if (!confirm(`Remove ${m.display_name || m.email} from this workspace?`))
      return;
    this.memberRemoved.emit(m.user_id);
  }

  /** Called by parent after successful save to reset dirty state */
  markSaved(): void {
    this.saving.set(false);
  }
}
