import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  WorkspaceService,
  WorkspaceMember,
  InvitationWithStatus,
} from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  InviteMemberDialogComponent,
  InviteMemberDialogResult,
} from '../../../shared/components/dialogs/invite-member-dialog.component';

export interface MemberWithDetails extends WorkspaceMember {
  display_name?: string;
  email?: string;
  avatar_url?: string | null;
  job_title?: string | null;
  department?: string | null;
}

@Component({
  selector: 'app-members-list',
  standalone: true,
  imports: [CommonModule, FormsModule, InviteMemberDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Error banner -->
    @if (errorMessage()) {
      <div
        class="mb-4 p-3 rounded-md text-sm text-[var(--status-red-text)] bg-[var(--status-red-bg)] border border-[var(--status-red-border)]"
      >
        {{ errorMessage() }}
      </div>
    }

    <div class="bg-[var(--card)] rounded-lg shadow">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[var(--border)]">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-[var(--card-foreground)]">
            Members
          </h3>
          @if (isAdmin()) {
            <button
              (click)="onInviteMember()"
              class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
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
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
              Invite
            </button>
          }
        </div>

        <!-- Search Input -->
        <div class="mt-3">
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search members by name or email..."
            class="w-full px-3 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
        </div>
      </div>

      <!-- Members Table -->
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-[var(--border)]">
          <thead class="bg-[var(--secondary)]">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
              >
                Member
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
              >
                Title / Dept
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
              >
                Role
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
              >
                Joined
              </th>
              @if (isAdmin()) {
                <th
                  class="px-6 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                >
                  Actions
                </th>
              }
            </tr>
          </thead>
          <tbody class="bg-[var(--card)] divide-y divide-[var(--border)]">
            @for (member of filteredMembers(); track member.user_id) {
              <tr class="hover:bg-[var(--muted)]">
                <!-- Member Info -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-full bg-[var(--muted)] flex items-center justify-center text-sm font-medium text-[var(--muted-foreground)]"
                    >
                      @if (member.avatar_url) {
                        <img
                          [src]="member.avatar_url"
                          [alt]="member.display_name"
                          class="w-full h-full rounded-full object-cover"
                        />
                      } @else {
                        {{ getInitials(member.display_name || member.email) }}
                      }
                    </div>
                    <div>
                      <p
                        class="text-sm font-medium text-[var(--card-foreground)]"
                      >
                        {{ member.display_name || 'Unknown' }}
                      </p>
                      <p class="text-sm text-[var(--muted-foreground)]">
                        {{ member.email }}
                      </p>
                    </div>
                  </div>
                </td>

                <!-- Title / Dept -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    @if (member.job_title) {
                      <p class="text-sm text-[var(--card-foreground)]">
                        {{ member.job_title }}
                      </p>
                    }
                    @if (member.department) {
                      <p class="text-xs text-[var(--muted-foreground)]">
                        {{ member.department }}
                      </p>
                    }
                    @if (!member.job_title && !member.department) {
                      <p class="text-sm text-[var(--muted-foreground)]">--</p>
                    }
                  </div>
                </td>

                <!-- Role -->
                <td class="px-6 py-4 whitespace-nowrap">
                  @if (isAdmin() && !isOwner(member) && !isSelf(member)) {
                    <select
                      [value]="member.role"
                      (change)="onRoleChange(member, $any($event.target).value)"
                      [disabled]="updatingMember() === member.user_id"
                      class="text-xs font-medium rounded-full px-2.5 py-1 border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  } @else {
                    <span
                      [class]="
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
                        getRoleBadgeClass(member.role)
                      "
                    >
                      {{ getRoleLabel(member.role) }}
                    </span>
                  }
                </td>

                <!-- Joined Date -->
                <td
                  class="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted-foreground)]"
                >
                  {{ formatDate(member.joined_at) }}
                </td>

                <!-- Actions -->
                @if (isAdmin()) {
                  <td
                    class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                  >
                    @if (!isOwner(member) && !isSelf(member)) {
                      <button
                        (click)="onRemoveMember(member)"
                        [disabled]="updatingMember() === member.user_id"
                        class="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (filteredMembers().length === 0) {
        <div class="px-6 py-8 text-center text-[var(--muted-foreground)]">
          @if (searchQuery()) {
            No members matching "{{ searchQuery() }}"
          } @else {
            No members found
          }
        </div>
      }
    </div>

    <!-- Pending Invitations Section -->
    @if (isAdmin()) {
      <div class="bg-[var(--card)] rounded-lg shadow mt-6">
        <div class="px-6 py-4 border-b border-[var(--border)]">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium text-[var(--card-foreground)]">
              Pending Invitations
            </h3>
            @if (loadingInvitations()) {
              <span class="text-sm text-[var(--muted-foreground)]"
                >Loading...</span
              >
            }
          </div>
        </div>

        @if (pendingAndExpiredInvitations().length > 0) {
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-[var(--border)]">
              <thead class="bg-[var(--secondary)]">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                  >
                    Email
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                  >
                    Role
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                  >
                    Sent
                  </th>
                  <th
                    class="px-6 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-[var(--card)] divide-y divide-[var(--border)]">
                @for (
                  invitation of pendingAndExpiredInvitations();
                  track invitation.id
                ) {
                  <tr class="hover:bg-[var(--muted)]">
                    <!-- Email -->
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-8 h-8 rounded-full bg-[var(--secondary)] flex items-center justify-center text-xs font-medium text-[var(--muted-foreground)]"
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
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <span class="text-sm text-[var(--card-foreground)]">{{
                          invitation.email
                        }}</span>
                      </div>
                    </td>

                    <!-- Role -->
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        [class]="
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
                          getRoleBadgeClass(invitation.role)
                        "
                      >
                        {{ getRoleLabel(invitation.role) }}
                      </span>
                    </td>

                    <!-- Status -->
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        [class]="
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
                          getStatusBadgeClass(invitation.status)
                        "
                      >
                        {{ getStatusLabel(invitation.status) }}
                      </span>
                    </td>

                    <!-- Sent Date -->
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted-foreground)]"
                    >
                      {{ formatDate(invitation.created_at) }}
                    </td>

                    <!-- Actions -->
                    <td
                      class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                    >
                      <div class="flex items-center justify-end gap-2">
                        @if (invitation.status === 'expired') {
                          <button
                            (click)="onResendInvitation(invitation)"
                            [disabled]="actionInProgress() === invitation.id"
                            class="text-primary hover:text-primary disabled:opacity-50"
                          >
                            Resend
                          </button>
                        }
                        @if (
                          invitation.status === 'pending' ||
                          invitation.status === 'expired'
                        ) {
                          <button
                            (click)="onCancelInvitation(invitation)"
                            [disabled]="actionInProgress() === invitation.id"
                            class="text-red-600 hover:text-red-900 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (!loadingInvitations()) {
          <div class="px-6 py-8 text-center text-[var(--muted-foreground)]">
            No pending invitations
          </div>
        }
      </div>
    }

    <!-- Invite Member Dialog (PrimeNG) -->
    <app-invite-member-dialog
      [(visible)]="showInviteDialog"
      [workspaceId]="workspaceId()"
      [workspaceName]="workspaceName()"
      [boards]="boards()"
      (created)="onInviteResult($event)"
    />
  `,
})
export class MembersListComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);
  private authService = inject(AuthService);

  members = input.required<MemberWithDetails[]>();
  workspaceId = input.required<string>();
  workspaceName = input<string>('this workspace');
  boards = input<{ id: string; name: string }[]>([]);

  memberRemoved = output<string>();
  memberRoleChanged = output<{ userId: string; role: string }>();
  memberInvited = output<{
    emails: string[];
    role: 'admin' | 'manager' | 'member';
  }>();

  updatingMember = signal<string | null>(null);
  allInvitations = signal<InvitationWithStatus[]>([]);
  loadingInvitations = signal(false);
  actionInProgress = signal<string | null>(null);
  showInviteDialog = signal(false);
  searchQuery = signal('');
  errorMessage = signal<string | null>(null);

  filteredMembers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.members();
    return this.members().filter(
      (m) =>
        m.display_name?.toLowerCase().includes(query) ||
        m.email?.toLowerCase().includes(query),
    );
  });

  ngOnInit(): void {
    this.loadInvitations();
  }

  pendingAndExpiredInvitations = computed(() =>
    this.allInvitations().filter(
      (inv) => inv.status === 'pending' || inv.status === 'expired',
    ),
  );

  loadInvitations(): void {
    this.loadingInvitations.set(true);
    this.workspaceService.listAllInvitations(this.workspaceId()).subscribe({
      next: (invitations) => {
        this.allInvitations.set(invitations);
        this.loadingInvitations.set(false);
      },
      error: () => {
        this.loadingInvitations.set(false);
      },
    });
  }

  isAdmin = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    const member = this.members().find((m) => m.user_id === user.id);
    return member?.role === 'owner' || member?.role === 'admin';
  });

  isOwner(member: MemberWithDetails): boolean {
    return member.role === 'owner';
  }

  isSelf(member: MemberWithDetails): boolean {
    const user = this.authService.currentUser();
    return user?.id === member.user_id;
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

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      owner: 'Owner',
      admin: 'Admin',
      manager: 'Manager',
      member: 'Member',
      viewer: 'Viewer',
    };
    return labels[role] || role;
  }

  getRoleBadgeClass(role: string): string {
    const classes: Record<string, string> = {
      owner: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      manager: 'bg-primary/10 text-primary',
      member: 'bg-gray-100 text-gray-800',
      viewer: 'bg-gray-100 text-gray-600',
    };
    return classes[role] || 'bg-gray-100 text-gray-800';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      accepted: 'Accepted',
      expired: 'Expired',
    };
    return labels[status] || status;
  }

  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  onInviteMember(): void {
    this.showInviteDialog.set(true);
  }

  onInviteResult(result: InviteMemberDialogResult): void {
    // Optimistic: emit invited event immediately
    this.memberInvited.emit({ emails: result.emails, role: result.role });

    this.workspaceService
      .bulkInviteMembers(
        this.workspaceId(),
        result.emails,
        result.role,
        result.message,
        result.boardIds,
        result.jobTitle,
      )
      .subscribe({
        next: () => {
          this.loadInvitations();
        },
        error: () => {
          this.showError('Failed to send invitation');
        },
      });
  }

  onResendInvitation(invitation: InvitationWithStatus): void {
    const snapshotInvitations = this.allInvitations();

    // Optimistic: update status to pending locally
    this.allInvitations.update((invitations) =>
      invitations.map((inv) =>
        inv.id === invitation.id ? { ...inv, status: 'pending' } : inv,
      ),
    );

    this.workspaceService.resendInvitation(invitation.id).subscribe({
      next: () => {
        this.loadInvitations();
      },
      error: () => {
        this.allInvitations.set(snapshotInvitations);
        this.showError('Failed to resend invitation');
      },
    });
  }

  onCancelInvitation(invitation: InvitationWithStatus): void {
    if (!confirm(`Cancel the invitation sent to ${invitation.email}?`)) {
      return;
    }

    this.actionInProgress.set(invitation.id);

    this.workspaceService.cancelInvitation(invitation.id).subscribe({
      next: () => {
        this.allInvitations.update((invitations) =>
          invitations.filter((inv) => inv.id !== invitation.id),
        );
        this.actionInProgress.set(null);
      },
      error: () => {
        this.actionInProgress.set(null);
      },
    });
  }

  onRoleChange(member: MemberWithDetails, newRole: string): void {
    if (newRole === member.role) return;

    const originalRole = member.role;

    // Optimistic: emit role change immediately
    this.memberRoleChanged.emit({
      userId: member.user_id,
      role: newRole,
    });

    this.workspaceService
      .updateMemberRole(
        this.workspaceId(),
        member.user_id,
        newRole as 'admin' | 'manager' | 'member',
      )
      .subscribe({
        error: () => {
          // Rollback: emit original role
          this.memberRoleChanged.emit({
            userId: member.user_id,
            role: originalRole,
          });
          this.showError('Failed to update member role');
        },
      });
  }

  onRemoveMember(member: MemberWithDetails): void {
    if (
      !confirm(
        `Remove ${member.display_name || member.email} from this workspace?`,
      )
    ) {
      return;
    }

    this.updatingMember.set(member.user_id);

    this.workspaceService
      .removeMember(this.workspaceId(), member.user_id)
      .subscribe({
        next: () => {
          this.memberRemoved.emit(member.user_id);
          this.updatingMember.set(null);
        },
        error: () => {
          this.updatingMember.set(null);
          this.showError('Failed to remove member');
        },
      });
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }
}
