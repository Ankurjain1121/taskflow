import {
  Component,
  input,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  WorkspaceService,
  WorkspaceMember,
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
  imports: [CommonModule, FormsModule, MatDialogModule],
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
  `,
})
export class MembersListComponent {
  private workspaceService = inject(WorkspaceService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);

  members = input.required<MemberWithDetails[]>();
  workspaceId = input.required<string>();
  workspaceName = input<string>('this workspace');

  memberRemoved = output<string>();
  memberRoleChanged = output<{ userId: string; role: string }>();
  memberInvited = output<{ email: string; role: 'admin' | 'member' }>();

  updatingMember = signal<string | null>(null);

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
      member: 'Member',
    };
    return labels[role] || role;
  }

  getRoleBadgeClass(role: string): string {
    const classes: Record<string, string> = {
      owner: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      member: 'bg-gray-100 text-gray-800',
    };
    return classes[role] || 'bg-gray-100 text-gray-800';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  onInviteMember(): void {
    const dialogRef = this.dialog.open(InviteMemberDialogComponent, {
      data: {
        workspaceId: this.workspaceId(),
        workspaceName: this.workspaceName(),
      },
    });

    dialogRef.afterClosed().subscribe((result: InviteMemberDialogResult | undefined) => {
      if (result) {
        this.workspaceService
          .inviteMember(this.workspaceId(), result.email, result.role)
          .subscribe({
            next: () => {
              this.memberInvited.emit({ email: result.email, role: result.role });
            },
            error: (err) => {
              console.error('Failed to invite member:', err);
            },
          });
      }
    });
  }

  onRoleChange(
    member: MemberWithDetails,
    newRole: 'admin' | 'member'
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
        error: (err) => {
          console.error('Failed to update member role:', err);
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
        error: (err) => {
          console.error('Failed to remove member:', err);
          this.updatingMember.set(null);
        },
      });
  }
}
