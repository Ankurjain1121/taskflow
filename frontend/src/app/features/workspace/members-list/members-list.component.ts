import {
  Component,
  input,
  output,
  signal,
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
}

@Component({
  selector: 'app-members-list',
  standalone: true,
  imports: [CommonModule, FormsModule, InviteMemberDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-lg shadow">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-gray-900">Members</h3>
          @if (isAdmin()) {
            <button
              (click)="onInviteMember()"
              class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
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
      </div>

      <!-- Members Table -->
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Member
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Role
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Joined
              </th>
              @if (isAdmin()) {
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              }
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            @for (member of members(); track member.user_id) {
              <tr class="hover:bg-gray-50">
                <!-- Member Info -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600"
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
                      <p class="text-sm font-medium text-gray-900">
                        {{ member.display_name || 'Unknown' }}
                      </p>
                      <p class="text-sm text-gray-500">{{ member.email }}</p>
                    </div>
                  </div>
                </td>

                <!-- Role -->
                <td class="px-6 py-4 whitespace-nowrap">
                  @if (isAdmin() && !isOwner(member)) {
                    <select
                      [ngModel]="member.role"
                      (ngModelChange)="onRoleChange(member, $event)"
                      [disabled]="updatingMember() === member.user_id"
                      class="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="member">Member</option>
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
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(member.joined_at) }}
                </td>

                <!-- Actions -->
                @if (isAdmin()) {
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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

      @if (members().length === 0) {
        <div class="px-6 py-8 text-center text-gray-500">
          No members found
        </div>
      }
    </div>

    <!-- Pending Invitations Section -->
    @if (isAdmin()) {
      <div class="bg-white rounded-lg shadow mt-6">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium text-gray-900">Pending Invitations</h3>
            @if (loadingInvitations()) {
              <span class="text-sm text-gray-400">Loading...</span>
            }
          </div>
        </div>

        @if (pendingAndExpiredInvitations().length > 0) {
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                @for (invitation of pendingAndExpiredInvitations(); track invitation.id) {
                  <tr class="hover:bg-gray-50">
                    <!-- Email -->
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span class="text-sm text-gray-900">{{ invitation.email }}</span>
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
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {{ formatDate(invitation.created_at) }}
                    </td>

                    <!-- Actions -->
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div class="flex items-center justify-end gap-2">
                        @if (invitation.status === 'expired') {
                          <button
                            (click)="onResendInvitation(invitation)"
                            [disabled]="actionInProgress() === invitation.id"
                            class="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                          >
                            Resend
                          </button>
                        }
                        @if (invitation.status === 'pending' || invitation.status === 'expired') {
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
          <div class="px-6 py-8 text-center text-gray-500">
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
  memberInvited = output<{ emails: string[]; role: 'admin' | 'manager' | 'member' }>();

  updatingMember = signal<string | null>(null);
  allInvitations = signal<InvitationWithStatus[]>([]);
  loadingInvitations = signal(false);
  actionInProgress = signal<string | null>(null);
  showInviteDialog = signal(false);

  ngOnInit(): void {
    this.loadInvitations();
  }

  pendingAndExpiredInvitations(): InvitationWithStatus[] {
    return this.allInvitations().filter(
      (inv) => inv.status === 'pending' || inv.status === 'expired'
    );
  }

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

  isAdmin(): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;
    const member = this.members().find((m) => m.user_id === user.id);
    return member?.role === 'owner' || member?.role === 'admin';
  }

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
    };
    return labels[role] || role;
  }

  getRoleBadgeClass(role: string): string {
    const classes: Record<string, string> = {
      owner: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      manager: 'bg-indigo-100 text-indigo-800',
      member: 'bg-gray-100 text-gray-800',
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
    this.workspaceService
      .bulkInviteMembers(
        this.workspaceId(),
        result.emails,
        result.role,
        result.message,
        result.boardIds
      )
      .subscribe({
        next: (response) => {
          this.memberInvited.emit({ emails: result.emails, role: result.role });
          // Reload invitations to show the newly created ones
          this.loadInvitations();

          if (response.errors && response.errors.length > 0) {
            const errorMessages = response.errors
              .map((e) => `${e.email}: ${e.reason}`)
              .join('\n');
            // Log warning for partial failures
          }
        },
        error: () => {
          // Error handling - invite failed
        },
      });
  }

  onResendInvitation(invitation: InvitationWithStatus): void {
    this.actionInProgress.set(invitation.id);

    this.workspaceService.resendInvitation(invitation.id).subscribe({
      next: () => {
        this.loadInvitations();
        this.actionInProgress.set(null);
      },
      error: () => {
        this.actionInProgress.set(null);
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
          invitations.filter((inv) => inv.id !== invitation.id)
        );
        this.actionInProgress.set(null);
      },
      error: () => {
        this.actionInProgress.set(null);
      },
    });
  }

  onRoleChange(
    member: MemberWithDetails,
    newRole: 'admin' | 'manager' | 'member'
  ): void {
    if (member.role === newRole) return;

    this.updatingMember.set(member.user_id);

    this.workspaceService
      .updateMemberRole(this.workspaceId(), member.user_id, newRole)
      .subscribe({
        next: () => {
          this.memberRoleChanged.emit({ userId: member.user_id, role: newRole });
          this.updatingMember.set(null);
        },
        error: () => {
          this.updatingMember.set(null);
        },
      });
  }

  onRemoveMember(member: MemberWithDetails): void {
    if (!confirm(`Remove ${member.display_name || member.email} from this workspace?`)) {
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
        },
      });
  }
}
