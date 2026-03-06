import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Checkbox } from 'primeng/checkbox';
import { Tag } from 'primeng/tag';
import { PopoverModule } from 'primeng/popover';
import {
  WorkspaceService,
  Workspace,
  TenantMember,
  UserWorkspaceMembership,
  MemberRoleBatch,
} from '../../../core/services/workspace.service';
import {
  AddToWorkspaceDialogComponent,
  BulkAddResult,
} from '../add-to-workspace-dialog/add-to-workspace-dialog.component';
import {
  InviteMemberDialogComponent,
  InviteMemberDialogResult,
} from '../../../shared/components/dialogs/invite-member-dialog.component';
import { UserProfileDialogComponent } from '../../../shared/components/dialogs/user-profile-dialog.component';

@Component({
  selector: 'app-org-members',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    Checkbox,
    Tag,
    PopoverModule,
    AddToWorkspaceDialogComponent,
    InviteMemberDialogComponent,
    UserProfileDialogComponent,
  ],
  template: `
    <div class="py-6">
      <!-- Toolbar -->
      <div class="flex items-center gap-3 mb-6 flex-wrap">
        <div class="relative flex-1 min-w-[200px] max-w-sm">
          <i
            class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] text-sm"
          ></i>
          <input
            pInputText
            [(ngModel)]="searchQuery"
            placeholder="Search by name or email..."
            class="w-full pl-9"
          />
        </div>
        @if (selectedUsers().length > 0) {
          <p-button
            [label]="'Add ' + selectedUsers().length + ' to Workspace'"
            icon="pi pi-plus"
            size="small"
            (onClick)="openBulkAdd()"
          />
        }
        <p-button
          label="Invite Members"
          icon="pi pi-user-plus"
          size="small"
          severity="primary"
          (onClick)="openInviteFlow()"
        />
      </div>

      <!-- Members Table -->
      <div
        class="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr
                class="border-b border-[var(--border)] bg-[var(--secondary)]/50"
              >
                <th class="py-3 px-4 text-left w-10">
                  <p-checkbox
                    [binary]="true"
                    [(ngModel)]="selectAll"
                    (onChange)="toggleSelectAll()"
                  />
                </th>
                <th
                  class="py-3 px-4 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                >
                  Name / Email
                </th>
                <th
                  class="py-3 px-4 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                >
                  Title / Dept
                </th>
                <th
                  class="py-3 px-4 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                >
                  Workspaces
                </th>
                <th
                  class="py-3 px-4 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border)]">
              @for (member of filteredMembers(); track member.user_id) {
                <tr
                  class="hover:bg-[var(--secondary)]/30 transition-colors cursor-pointer"
                  (click)="openProfileDialog(member)"
                >
                  <td class="py-3 px-4" (click)="$event.stopPropagation()">
                    <p-checkbox
                      [binary]="true"
                      [ngModel]="isSelected(member.user_id)"
                      (onChange)="toggleSelection(member)"
                    />
                  </td>
                  <td class="py-3 px-4">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0"
                      >
                        {{ getInitials(member.name) }}
                      </div>
                      <div class="min-w-0">
                        <p
                          class="text-sm font-medium text-[var(--card-foreground)] truncate"
                        >
                          {{ member.name }}
                        </p>
                        <p
                          class="text-xs text-[var(--muted-foreground)] truncate"
                        >
                          {{ member.email }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-4">
                    <div class="min-w-0">
                      @if (member.job_title) {
                        <p
                          class="text-sm text-[var(--card-foreground)] truncate"
                        >
                          {{ member.job_title }}
                        </p>
                      }
                      @if (member.department) {
                        <p
                          class="text-xs text-[var(--muted-foreground)] truncate"
                        >
                          {{ member.department }}
                        </p>
                      }
                      @if (!member.job_title && !member.department) {
                        <span class="text-xs text-[var(--muted-foreground)]"
                          >--</span
                        >
                      }
                      @if (getMemberRoles(member.user_id).length > 0) {
                        <div class="flex flex-wrap gap-1 mt-1">
                          @for (
                            role of getMemberRoles(member.user_id);
                            track role.role_id
                          ) {
                            <span
                              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                              [style.background-color]="
                                role.role_color || '#6366f1'
                              "
                            >
                              {{ role.role_name }}
                            </span>
                          }
                        </div>
                      }
                    </div>
                  </td>
                  <td class="py-3 px-4" (click)="$event.stopPropagation()">
                    <button
                      class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                      (click)="toggleWorkspacePopover(member.user_id, $event)"
                    >
                      {{ member.workspace_count }} workspace{{
                        member.workspace_count !== 1 ? 's' : ''
                      }}
                    </button>
                    @if (expandedUserId() === member.user_id) {
                      <div
                        class="absolute z-50 mt-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg p-3 min-w-[220px]"
                      >
                        @if (loadingWorkspaces()) {
                          <p
                            class="text-xs text-[var(--muted-foreground)] animate-pulse"
                          >
                            Loading...
                          </p>
                        } @else {
                          @for (wm of userWorkspaces(); track wm.workspace_id) {
                            <div
                              class="flex items-center justify-between py-1.5 text-sm"
                            >
                              <span
                                class="text-[var(--card-foreground)] truncate mr-2"
                                >{{ wm.workspace_name }}</span
                              >
                              <p-tag
                                [value]="wm.role"
                                severity="secondary"
                                class="flex-shrink-0"
                              />
                            </div>
                          }
                          @if (userWorkspaces().length === 0) {
                            <p class="text-xs text-[var(--muted-foreground)]">
                              No workspaces
                            </p>
                          }
                        }
                      </div>
                    }
                  </td>
                  <td class="py-3 px-4" (click)="$event.stopPropagation()">
                    <p-button
                      icon="pi pi-plus"
                      label="Add to Workspace"
                      [text]="true"
                      size="small"
                      (onClick)="openSingleAdd(member)"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (filteredMembers().length === 0) {
          <div class="text-center py-8">
            <p class="text-sm text-[var(--muted-foreground)]">
              @if (searchQuery()) {
                No members match "{{ searchQuery() }}".
              } @else {
                No members found.
              }
            </p>
          </div>
        }
      </div>
    </div>

    <!-- Add to Workspace Dialog -->
    <app-add-to-workspace-dialog
      [(visible)]="showAddDialog"
      [users]="addDialogUsers()"
      [workspaces]="allWorkspaces()"
      [excludeWorkspaceIds]="addDialogExcludeIds()"
      (added)="onMembersAdded($event)"
    />

    <!-- Invite Member Dialog (workspace selection embedded) -->
    <app-invite-member-dialog
      [(visible)]="showInviteDialog"
      [workspaceId]="autoSelectedWorkspaceId()"
      [workspaceName]="autoSelectedWorkspaceName()"
      [boards]="autoSelectedWorkspaceBoards()"
      [workspaces]="inviteWorkspaceOptions()"
      (created)="onInviteResult($event)"
    />

    <!-- User Profile Dialog -->
    <app-user-profile-dialog
      [(visible)]="showProfileDialog"
      [userId]="profileDialogUserId() ?? ''"
      [userName]="profileDialogMember()?.name ?? ''"
      [userEmail]="profileDialogMember()?.email ?? ''"
      [userAvatar]="profileDialogMember()?.avatar_url ?? null"
      [jobTitle]="profileDialogMember()?.job_title ?? null"
      [department]="profileDialogMember()?.department ?? null"
      [memberSince]="profileDialogMember()?.created_at ?? null"
    />
  `,
})
export class OrgMembersComponent {
  private workspaceService = inject(WorkspaceService);

  members = input.required<TenantMember[]>();
  allWorkspaces = input.required<Workspace[]>();
  memberRoles = input<MemberRoleBatch[]>([]);

  membersAdded = output<BulkAddResult>();
  membersInvited = output<void>();

  searchQuery = signal('');
  selectedIds = signal<Set<string>>(new Set());
  selectAll = false;
  showAddDialog = signal(false);
  addDialogUsers = signal<TenantMember[]>([]);
  addDialogExcludeIds = signal<string[]>([]);

  expandedUserId = signal<string | null>(null);
  userWorkspaces = signal<UserWorkspaceMembership[]>([]);
  loadingWorkspaces = signal(false);

  // Profile dialog state
  showProfileDialog = signal(false);
  profileDialogUserId = signal<string | null>(null);
  profileDialogMember = signal<TenantMember | null>(null);

  // Invite flow state
  showInviteDialog = signal(false);

  /** When exactly 1 workspace, auto-select it (skip picker) */
  autoSelectedWorkspaceId = computed(() => {
    const ws = this.allWorkspaces();
    return ws.length === 1 ? ws[0].id : '';
  });

  autoSelectedWorkspaceName = computed(() => {
    const ws = this.allWorkspaces();
    return ws.length === 1 ? ws[0].name : '';
  });

  autoSelectedWorkspaceBoards = signal<{ id: string; name: string }[]>([]);

  /** When multiple workspaces, pass the list for in-dialog selection */
  inviteWorkspaceOptions = computed(() => {
    const ws = this.allWorkspaces();
    return ws.length > 1 ? ws : [];
  });

  filteredMembers = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.members();
    return this.members().filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  });

  selectedUsers = computed(() => {
    const ids = this.selectedIds();
    return this.members().filter((m) => ids.has(m.user_id));
  });

  isSelected(userId: string): boolean {
    return this.selectedIds().has(userId);
  }

  toggleSelection(member: TenantMember): void {
    this.selectedIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(member.user_id)) {
        next.delete(member.user_id);
      } else {
        next.add(member.user_id);
      }
      return next;
    });
  }

  toggleSelectAll(): void {
    if (this.selectAll) {
      const allIds = new Set(this.filteredMembers().map((m) => m.user_id));
      this.selectedIds.set(allIds);
    } else {
      this.selectedIds.set(new Set());
    }
  }

  getMemberRoles(userId: string): MemberRoleBatch[] {
    return this.memberRoles().filter((r) => r.user_id === userId);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  openProfileDialog(member: TenantMember): void {
    this.profileDialogUserId.set(member.user_id);
    this.profileDialogMember.set(member);
    this.showProfileDialog.set(true);
  }

  toggleWorkspacePopover(userId: string, event: Event): void {
    event.stopPropagation();
    if (this.expandedUserId() === userId) {
      this.expandedUserId.set(null);
      return;
    }
    this.expandedUserId.set(userId);
    this.loadingWorkspaces.set(true);
    this.workspaceService.getUserWorkspaces(userId).subscribe({
      next: (wms) => {
        this.userWorkspaces.set(wms);
        this.loadingWorkspaces.set(false);
      },
      error: () => {
        this.userWorkspaces.set([]);
        this.loadingWorkspaces.set(false);
      },
    });
  }

  openSingleAdd(member: TenantMember): void {
    this.addDialogUsers.set([member]);
    this.addDialogExcludeIds.set([]);
    this.showAddDialog.set(true);
  }

  openBulkAdd(): void {
    this.addDialogUsers.set(this.selectedUsers());
    this.addDialogExcludeIds.set([]);
    this.showAddDialog.set(true);
  }

  onMembersAdded(result: BulkAddResult): void {
    this.selectedIds.set(new Set());
    this.selectAll = false;
    this.membersAdded.emit(result);
  }

  openInviteFlow(): void {
    this.autoSelectedWorkspaceBoards.set([]);
    this.showInviteDialog.set(true);
  }

  onInviteResult(result: InviteMemberDialogResult): void {
    const wsId = result.workspaceId;
    if (!wsId) return;

    this.workspaceService
      .bulkInviteMembers(
        wsId,
        result.emails,
        result.role,
        result.message,
        result.boardIds,
        result.jobTitle,
      )
      .subscribe({
        next: () => {
          this.membersInvited.emit();
        },
      });
  }
}
