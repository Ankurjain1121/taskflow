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
import {
  ProjectService,
  ProjectMember,
} from '../../../core/services/project.service';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import {
  ProjectInviteMemberDialogComponent,
  InviteMemberDialogResult,
} from './invite-member-dialog.component';
import { PositionListComponent } from '../positions/position-list.component';

@Component({
  selector: 'app-project-members-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ConfirmDialog,
    TooltipModule,
    ProjectInviteMemberDialogComponent,
    PositionListComponent,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-6">
      <!-- Members Table -->
      <div class="bg-[var(--card)] shadow rounded-lg">
        <div class="px-6 py-4 border-b border-[var(--border)]">
          <div class="flex items-center justify-between">
            <h3
              class="text-lg font-medium text-[var(--foreground)]"
            >
              Project Members
            </h3>
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
              Add Member
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-[var(--border)]">
            <thead class="bg-[var(--muted)]">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                >
                  Member
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                >
                  Role
                </th>
                <th
                  class="px-6 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody
              class="bg-[var(--card)] divide-y divide-[var(--border)]"
            >
              @for (member of members(); track member.user_id) {
                <tr class="hover:bg-[var(--muted)]">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-10 h-10 rounded-full bg-[var(--secondary)] flex items-center justify-center text-sm font-medium text-[var(--muted-foreground)]"
                      >
                        @if (member.avatar_url) {
                          <img
                            [src]="member.avatar_url"
                            [alt]="member.name"
                            class="w-full h-full rounded-full object-cover"
                          />
                        } @else {
                          {{
                            getInitials(member.name || member.email)
                          }}
                        }
                      </div>
                      <div>
                        <p
                          class="text-sm font-medium text-[var(--foreground)]"
                        >
                          {{ member.name || 'Unknown' }}
                        </p>
                        <p
                          class="text-sm text-[var(--muted-foreground)]"
                        >
                          {{ member.email }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      @if (member.role === 'owner') {
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                        >
                          Owner
                        </span>
                      } @else if (member.is_implicit) {
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--surface-hover)] text-[var(--muted-foreground)] capitalize"
                        >
                          {{ member.role }}
                        </span>
                      } @else {
                        <select
                          [ngModel]="member.role"
                          (ngModelChange)="
                            onMemberRoleChange(member, $event)
                          "
                          class="text-sm border-[var(--border)] rounded-md shadow-sm focus:border-primary focus:ring-ring"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                      }
                      @if (member.is_implicit) {
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--surface-hover)] text-[var(--muted-foreground)]"
                          pTooltip="Implicit access via workspace membership"
                          tooltipPosition="top"
                        >
                          <i class="pi pi-users text-[10px]"></i> Workspace
                        </span>
                      }
                    </div>
                  </td>
                  <td
                    class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                  >
                    @if (!member.is_implicit) {
                      <button
                        (click)="onRemoveMember(member)"
                        class="text-[var(--destructive)] hover:text-[var(--destructive)]"
                      >
                        Remove
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (members().length === 0) {
          <div
            class="px-6 py-8 text-center text-[var(--muted-foreground)]"
          >
            No members found
          </div>
        }
      </div>

      <!-- Positions -->
      <app-position-list
        [boardId]="boardId()"
        [projectMembers]="members()"
      />
    </div>

    <!-- Invite Member Dialog -->
    <app-project-invite-member-dialog
      [(visible)]="showInviteDialog"
      [boardId]="boardId()"
      [boardName]="boardName()"
      (invited)="onInviteResult($event)"
    />
    <p-confirmDialog />
  `,
})
export class ProjectMembersSettingsComponent {
  private projectService = inject(ProjectService);
  private confirmationService = inject(ConfirmationService);

  boardId = input.required<string>();
  boardName = input<string>('');
  members = input.required<ProjectMember[]>();

  membersChanged = output<ProjectMember[]>();
  errorOccurred = output<string>();

  showInviteDialog = signal(false);

  getInitials(name: string | undefined): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  onInviteMember(): void {
    this.showInviteDialog.set(true);
  }

  onInviteResult(result: InviteMemberDialogResult): void {
    const snapshot = this.members();

    // Optimistic: insert temp member
    const tempMember: ProjectMember = {
      user_id: crypto.randomUUID(),
      project_id: this.boardId(),
      role: result.role,
      name: result.email,
      email: result.email,
      avatar_url: null,
    };
    this.membersChanged.emit([...snapshot, tempMember]);

    this.projectService
      .inviteProjectMember(this.boardId(), {
        email: result.email,
        role: result.role,
      })
      .subscribe({
        next: (member) => {
          this.membersChanged.emit(
            this.members().map((m) =>
              m.user_id === tempMember.user_id ? member : m,
            ),
          );
        },
        error: () => {
          this.membersChanged.emit(snapshot);
          this.errorOccurred.emit('Failed to invite member');
        },
      });
  }

  onMemberRoleChange(member: ProjectMember, role: 'viewer' | 'editor'): void {
    const snapshot = this.members();

    // Optimistic: update role locally
    this.membersChanged.emit(
      snapshot.map((m) =>
        m.user_id === member.user_id ? { ...m, role } : m,
      ),
    );

    this.projectService
      .updateProjectMemberRole(this.boardId(), member.user_id, { role })
      .subscribe({
        next: (updatedMember) => {
          this.membersChanged.emit(
            this.members().map((m) =>
              m.user_id === updatedMember.user_id ? updatedMember : m,
            ),
          );
        },
        error: () => {
          this.membersChanged.emit(snapshot);
          this.errorOccurred.emit('Failed to update member role');
        },
      });
  }

  onRemoveMember(member: ProjectMember): void {
    this.confirmationService.confirm({
      message: `Remove ${member.name || member.email} from this board?`,
      header: 'Remove Member',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        const snapshot = this.members();

        // Optimistic: remove immediately
        this.membersChanged.emit(
          snapshot.filter((m) => m.user_id !== member.user_id),
        );

        this.projectService
          .removeProjectMember(this.boardId(), member.user_id)
          .subscribe({
            error: () => {
              this.membersChanged.emit(snapshot);
              this.errorOccurred.emit('Failed to remove member');
            },
          });
      },
    });
  }
}
