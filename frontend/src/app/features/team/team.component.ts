import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';

import { WorkspaceService } from '../../core/services/workspace.service';
import { AuthService } from '../../core/services/auth.service';
import {
  InvitationService,
  Invitation,
  CreateInvitationRequest,
} from '../../core/services/invitation.service';
import { WorkspaceMemberInfo } from '../../shared/types/workspace.types';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    InputTextModule,
    Select,
    ButtonModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="max-w-6xl mx-auto p-6 space-y-8">
      <!-- Back link -->
      <a
        [routerLink]="['..']"
        class="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <i class="pi pi-arrow-left text-sm"></i>
        Back to Workspace
      </a>

      @if (loading()) {
        <p class="text-[var(--muted-foreground)]">Loading team data...</p>
      }

      @if (!loading()) {
        <!-- Invite new member section -->
        <section class="widget-card p-6 space-y-4">
          <h2 class="text-lg font-semibold text-[var(--foreground)]">
            Invite New Member
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2 flex flex-col gap-2">
              <label
                for="inviteEmail"
                class="text-sm font-medium text-[var(--foreground)]"
                >Email Address</label
              >
              <div class="p-inputgroup">
                <span class="p-inputgroup-addon"
                  ><i class="pi pi-envelope text-[var(--muted-foreground)]"></i
                ></span>
                <input
                  pInputText
                  id="inviteEmail"
                  type="email"
                  [(ngModel)]="inviteEmail"
                  placeholder="user@example.com"
                  class="w-full"
                />
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <label
                for="inviteRole"
                class="text-sm font-medium text-[var(--foreground)]"
                >Role</label
              >
              <p-select
                id="inviteRole"
                [options]="roleOptions"
                [(ngModel)]="inviteRole"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full"
              />
            </div>
          </div>

          <p-button
            (onClick)="sendInvite()"
            [disabled]="!inviteEmail"
            icon="pi pi-send"
            label="Send Invitation"
          />
        </section>

        <!-- Current members section -->
        <section class="widget-card p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-[var(--foreground)]">
              Workspace Members
              <span
                class="ml-2 text-sm font-normal text-[var(--muted-foreground)]"
                >({{ members().length }})</span
              >
            </h2>
          </div>

          <div class="space-y-2">
            @for (member of members(); track member.user_id) {
              <div
                class="flex items-center justify-between px-4 py-3 bg-[var(--muted)] rounded-lg border border-[var(--border)]"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-sm text-white font-medium"
                  >
                    {{ member.name.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="text-sm font-medium text-[var(--foreground)]">
                      {{ member.name }}
                    </div>
                    <div class="text-xs text-[var(--muted-foreground)]">
                      {{ member.email }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  @if (isCurrentUserAdmin()) {
                    <p-select
                      [options]="memberRoleOptions"
                      [ngModel]="member.role"
                      (ngModelChange)="onRoleChange(member, $event)"
                      optionLabel="label"
                      optionValue="value"
                      styleClass="w-32"
                    />
                  } @else {
                    <span
                      class="px-2 py-1 text-xs font-medium rounded"
                      [ngClass]="{
                        'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300':
                          member.role === 'admin',
                        'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300':
                          member.role === 'manager',
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300':
                          member.role === 'member',
                        'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300':
                          member.role === 'viewer',
                      }"
                    >
                      {{ member.role }}
                    </span>
                  }

                  @if (isCurrentUserAdmin()) {
                    <p-button
                      icon="pi pi-user-minus"
                      [rounded]="true"
                      [text]="true"
                      severity="danger"
                      (onClick)="removeMember(member)"
                      pTooltip="Remove member"
                    />
                  }
                </div>
              </div>
            } @empty {
              <p
                class="text-sm text-[var(--muted-foreground)] text-center py-4"
              >
                No members found
              </p>
            }
          </div>
        </section>

        <!-- Pending invitations section -->
        <section class="widget-card p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-[var(--foreground)]">
              Pending Invitations
              <span
                class="ml-2 text-sm font-normal text-[var(--muted-foreground)]"
                >({{ invitations().length }})</span
              >
            </h2>
          </div>

          <div class="space-y-2">
            @for (inv of invitations(); track inv.id) {
              <div
                class="flex items-center justify-between px-4 py-3 bg-[var(--status-amber-bg)] rounded-lg border border-[var(--status-amber-border)]"
              >
                <div class="flex items-center gap-3">
                  <i class="pi pi-clock text-[var(--status-amber-text)]"></i>
                  <div>
                    <div class="text-sm font-medium text-[var(--foreground)]">
                      {{ inv.email }}
                    </div>
                    <div class="text-xs text-[var(--muted-foreground)]">
                      Sent {{ formatDate(inv.created_at) }} · Expires
                      {{ formatDate(inv.expires_at) }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <p-button
                    [outlined]="true"
                    size="small"
                    (onClick)="resendInvite(inv)"
                    icon="pi pi-refresh"
                    label="Resend"
                  />
                  <p-button
                    icon="pi pi-times"
                    [rounded]="true"
                    [text]="true"
                    severity="danger"
                    (onClick)="cancelInvite(inv)"
                    pTooltip="Cancel invitation"
                  />
                </div>
              </div>
            } @empty {
              <p
                class="text-sm text-[var(--muted-foreground)] text-center py-4"
              >
                No pending invitations
              </p>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class TeamComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private workspaceService = inject(WorkspaceService);
  private authService = inject(AuthService);
  private invitationService = inject(InvitationService);
  private messageService = inject(MessageService);

  workspaceId = signal<string>('');
  loading = signal(true);
  members = signal<WorkspaceMemberInfo[]>([]);
  invitations = signal<Invitation[]>([]);

  /** Whether the current user is a workspace admin (computed from member list). */
  isCurrentUserAdmin = computed(() => {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return false;
    const me = this.members().find((m) => m.user_id === currentUser.id);
    return me?.role === 'admin';
  });

  // Invite form
  inviteEmail = '';
  inviteRole: 'admin' | 'manager' | 'member' = 'member';

  roleOptions = [
    { label: 'Member', value: 'member' },
    { label: 'Manager', value: 'manager' },
    { label: 'Admin', value: 'admin' },
    { label: 'Viewer', value: 'viewer' },
  ];

  memberRoleOptions = [
    { label: 'Admin', value: 'admin' },
    { label: 'Manager', value: 'manager' },
    { label: 'Member', value: 'member' },
    { label: 'Viewer', value: 'viewer' },
  ];

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('workspaceId');
      if (id) {
        this.workspaceId.set(id);
        this.loadData();
      }
    });
  }

  loadData(): void {
    this.loading.set(true);
    forkJoin({
      members: this.workspaceService.getMembers(this.workspaceId()),
      invitations: this.invitationService.listByWorkspace(this.workspaceId()),
    }).subscribe({
      next: (result) => {
        this.members.set(result.members);
        this.invitations.set(result.invitations);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load team data',
        });
        this.loading.set(false);
      },
    });
  }

  sendInvite(): void {
    if (!this.inviteEmail) {
      return;
    }

    const request: CreateInvitationRequest = {
      email: this.inviteEmail,
      workspace_id: this.workspaceId(),
      role: this.inviteRole,
    };

    this.invitationService.create(request).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Invitation sent successfully',
        });
        this.inviteEmail = '';
        this.inviteRole = 'member';
        this.loadData();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to send invitation',
        });
      },
    });
  }

  removeMember(member: WorkspaceMemberInfo): void {
    if (!confirm(`Remove ${member.name} from this workspace?`)) {
      return;
    }

    this.workspaceService
      .removeMember(this.workspaceId(), member.user_id)
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Member removed successfully',
          });
          this.loadData();
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to remove member',
          });
        },
      });
  }

  onRoleChange(member: WorkspaceMemberInfo, newRole: string): void {
    if (newRole === member.role) {
      return;
    }

    this.workspaceService
      .updateMemberRole(
        this.workspaceId(),
        member.user_id,
        newRole as 'admin' | 'manager' | 'member',
      )
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `Role updated to ${newRole}`,
          });
          this.loadData();
        },
        error: (err: unknown) => {
          const httpErr = err as { error?: { error?: { message?: string } } };
          const message =
            httpErr?.error?.error?.message || 'Failed to update role';
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: message,
          });
          // Reload to revert the select visual state
          this.loadData();
        },
      });
  }

  cancelInvite(invitation: Invitation): void {
    if (!confirm(`Cancel invitation to ${invitation.email}?`)) {
      return;
    }

    this.invitationService.cancel(invitation.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Invitation cancelled',
        });
        this.loadData();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to cancel invitation',
        });
      },
    });
  }

  resendInvite(invitation: Invitation): void {
    this.invitationService.resend(invitation.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Invitation resent successfully',
        });
        this.loadData();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to resend invitation',
        });
      },
    });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}
