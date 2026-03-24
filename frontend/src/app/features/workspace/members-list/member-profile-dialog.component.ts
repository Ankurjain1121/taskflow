import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  model,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-member-profile-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '420px', 'max-width': '95vw' }"
      header="Member Profile"
      [closable]="true"
    >
      @if (member()) {
        <div class="flex flex-col gap-5">
          <!-- Avatar + Name + Email + Phone -->
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
            <div class="min-w-0">
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
                <p class="text-sm text-[var(--muted-foreground)]">
                  {{ member()!.phone_number }}
                </p>
              }
            </div>
          </div>

          <!-- Details Grid -->
          <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <span class="text-[var(--muted-foreground)]">Job Title</span>
            <span class="text-[var(--card-foreground)]">{{
              member()!.job_title || '\u2014'
            }}</span>

            <span class="text-[var(--muted-foreground)]">Department</span>
            <span class="text-[var(--card-foreground)]">{{
              member()!.department || '\u2014'
            }}</span>

            <span class="text-[var(--muted-foreground)]">Member Since</span>
            <span class="text-[var(--card-foreground)]">{{
              formatDate(member()!.joined_at)
            }}</span>

            <span class="text-[var(--muted-foreground)]">Last Active</span>
            <span class="text-[var(--card-foreground)]">{{
              formatLastActive(member()!.last_login_at)
            }}</span>
          </div>

          <!-- Workspace Role Section -->
          @if (
            isAdmin() &&
            !isSelf() &&
            !isOwner() &&
            (!member()!.is_org_admin || isSuperAdmin())
          ) {
            <div>
              <div class="border-t border-[var(--border)] my-1"></div>
              <label
                class="block text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-2"
                >Workspace Role</label
              >
              <select
                [value]="member()!.role"
                (change)="onRoleChange($any($event.target).value)"
                [disabled]="changingRole()"
                class="text-xs font-medium rounded-full px-3 py-1.5 border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          }

          <!-- Remove Button -->
          @if (
            isAdmin() &&
            !isSelf() &&
            !isOwner() &&
            (!member()!.is_org_admin || isSuperAdmin())
          ) {
            <div class="border-t border-[var(--border)] pt-3">
              <button
                (click)="onRemove()"
                [attr.aria-label]="
                  'Remove ' +
                  (member()!.display_name || member()!.email) +
                  ' from workspace'
                "
                class="text-sm text-red-600 hover:text-red-800 transition-colors"
              >
                Remove from Workspace
              </button>
            </div>
          }
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

  readonly changingRole = signal(false);
  readonly selectedRole = signal<string>('');

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

  onRoleChange(newRole: string): void {
    const m = this.member();
    if (!m || newRole === m.role) return;
    this.roleChanged.emit({ userId: m.user_id, role: newRole });
  }

  onRemove(): void {
    const m = this.member();
    if (!m) return;
    if (!confirm(`Remove ${m.display_name || m.email} from this workspace?`))
      return;
    this.memberRemoved.emit(m.user_id);
  }
}
