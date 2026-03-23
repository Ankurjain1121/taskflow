import {
  Component,
  computed,
  DestroyRef,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Tabs } from 'primeng/tabs';
import { TabList } from 'primeng/tabs';
import { TabPanels } from 'primeng/tabs';
import { TabPanel } from 'primeng/tabs';
import { Tab } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import {
  WorkspaceService,
  Workspace,
  WorkspaceMember,
} from '../../core/services/workspace.service';
import { TeamGroupsService } from '../../core/services/team-groups.service';
import { AuthService } from '../../core/services/auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { MembersListComponent, MemberWithDetails } from '../workspace/members-list/members-list.component';
import { TeamsListComponent } from '../workspace/teams/teams-list.component';
import { TeamDetailDialogComponent } from '../workspace/teams/team-detail-dialog.component';
import { WorkspaceRolesTabComponent } from '../workspace/workspace-settings/workspace-roles-tab.component';
import { WorkspaceGeneralTabComponent } from '../workspace/workspace-settings/workspace-general-tab.component';
import { WorkspaceLabelsComponent } from '../workspace/labels/workspace-labels.component';
import { WorkspaceApiKeysTabComponent } from '../workspace/workspace-settings/workspace-api-keys-tab.component';
import { WorkspaceAdvancedTabComponent } from '../workspace/workspace-settings/workspace-advanced-tab.component';
import { AuditLogComponent } from '../workspace/audit-log/audit-log.component';
import { TrashComponent } from '../workspace/trash/trash.component';
import { InviteMemberDialogComponent } from '../../shared/components/dialogs/invite-member-dialog.component';
import { TeamGroupDetail } from '../../core/services/team-groups.service';

interface TabDef {
  label: string;
  icon: string;
  value: number;
  requiresAdmin: boolean;
}

const ALL_TABS: TabDef[] = [
  { label: 'People', icon: 'pi-users', value: 0, requiresAdmin: false },
  { label: 'Roles', icon: 'pi-shield', value: 1, requiresAdmin: true },
  { label: 'Config', icon: 'pi-cog', value: 2, requiresAdmin: true },
  { label: 'Activity', icon: 'pi-history', value: 3, requiresAdmin: false },
];

@Component({
  selector: 'app-manage',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    Tabs,
    TabList,
    TabPanels,
    TabPanel,
    Tab,
    TooltipModule,
    MembersListComponent,
    TeamsListComponent,
    WorkspaceRolesTabComponent,
    WorkspaceGeneralTabComponent,
    WorkspaceLabelsComponent,
    WorkspaceApiKeysTabComponent,
    WorkspaceAdvancedTabComponent,
    AuditLogComponent,
    TrashComponent,
    TeamDetailDialogComponent,
    InviteMemberDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--background)]">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        <!-- Error Banner -->
        @if (errorMessage()) {
          <div class="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            <i class="pi pi-exclamation-circle"></i>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <!-- Hero Section: People-forward -->
        <div class="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-50)] to-transparent dark:from-[var(--accent-950)] dark:to-transparent p-6 mb-6 shadow-sm">
          <h1 class="text-2xl font-bold text-[var(--foreground)] mb-3">Your Team</h1>

          @if (loading()) {
            <!-- Skeleton: avatar pills -->
            <div class="flex items-center gap-1 mb-3">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="w-9 h-9 rounded-full bg-[var(--muted)] animate-pulse"></div>
              }
            </div>
            <div class="h-4 w-48 bg-[var(--muted)] rounded animate-pulse mb-4"></div>
          } @else {
            <!-- Avatar Stack -->
            <div class="flex items-center mb-3">
              <div class="flex -space-x-2">
                @for (member of avatarMembers(); track member.user_id) {
                  @if (member.avatar_url) {
                    <img
                      [src]="member.avatar_url"
                      [alt]="member.name"
                      [pTooltip]="member.name"
                      tooltipPosition="top"
                      class="w-9 h-9 rounded-full ring-2 ring-white dark:ring-gray-900 object-cover"
                    />
                  } @else {
                    <div
                      [pTooltip]="member.name"
                      tooltipPosition="top"
                      class="w-9 h-9 rounded-full ring-2 ring-white dark:ring-gray-900 bg-[var(--accent-100)] dark:bg-[var(--accent-900)] flex items-center justify-center text-xs font-semibold text-[var(--accent-700)] dark:text-[var(--accent-300)]">
                      {{ getInitials(member.name) }}
                    </div>
                  }
                }
              </div>
              @if (members().length > 8) {
                <span class="ml-2 text-sm text-[var(--muted-foreground)]">
                  +{{ members().length - 8 }} more
                </span>
              }
            </div>

            <!-- Stats line -->
            <p class="text-sm font-medium text-[var(--muted-foreground)] mb-4">
              {{ memberCount() }} {{ memberCount() === 1 ? 'member' : 'members' }}
              &middot; {{ teamCount() }} {{ teamCount() === 1 ? 'team' : 'teams' }}
              @if (pendingInvites() > 0) {
                &middot;
                <span class="text-amber-600 dark:text-amber-400">
                  {{ pendingInvites() }} pending
                </span>
              }
            </p>
          }

          <!-- CTAs -->
          <div class="flex flex-wrap gap-3">
            <button
              class="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary)]"
              (click)="showInviteDialog.set(true)">
              <i class="pi pi-user-plus text-sm"></i>
              Invite Member
            </button>
            <button
              class="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-sm hover:bg-[var(--muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary)]"
              (click)="showCreateTeamDialog.set(true)">
              <i class="pi pi-plus text-sm"></i>
              Create Team
            </button>
          </div>
        </div>

        <!-- Tabs -->
        @if (!loading()) {
          <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)">
            <p-tablist>
              @for (tab of visibleTabs(); track tab.value) {
                <p-tab [value]="tab.value">
                  <i class="pi {{ tab.icon }} mr-2 text-sm"></i>
                  {{ tab.label }}
                </p-tab>
              }
            </p-tablist>
            <p-tabpanels>
              <!-- Tab 0: People -->
              <p-tabpanel [value]="0">
                <div class="py-4 space-y-6">
                  <!-- Members -->
                  <section>
                    @if (members().length === 0) {
                      <div class="text-center py-8 rounded-xl border border-dashed border-[var(--border)]">
                        <i class="pi pi-user-plus text-3xl text-[var(--muted-foreground)] mb-2"></i>
                        <p class="text-[var(--muted-foreground)]">Invite your first team member</p>
                        <button
                          class="mt-3 text-sm font-semibold text-[var(--primary)] hover:underline"
                          (click)="showInviteDialog.set(true)">
                          + Invite Member
                        </button>
                      </div>
                    } @else {
                      <app-members-list
                        [members]="memberDetails()"
                        [workspaceId]="workspaceId"
                        [workspaceName]="workspace()?.name ?? 'this workspace'"
                        [boards]="[]"
                        (memberRemoved)="onMemberRemoved($event)"
                      />
                    }
                  </section>

                  <!-- Teams -->
                  <section>
                    <h2 class="text-lg font-semibold text-[var(--foreground)] mb-3">Teams</h2>
                    @if (teamCount() === 0) {
                      <div class="text-center py-8 rounded-xl border border-dashed border-[var(--border)]">
                        <i class="pi pi-users text-3xl text-[var(--muted-foreground)] mb-2"></i>
                        <p class="text-[var(--muted-foreground)]">Organize into teams</p>
                        <button
                          class="mt-3 text-sm font-semibold text-[var(--primary)] hover:underline"
                          (click)="showCreateTeamDialog.set(true)">
                          + Create your first team
                        </button>
                      </div>
                    } @else {
                      <app-teams-list [workspaceId]="workspaceId" />
                    }
                  </section>
                </div>
              </p-tabpanel>

              <!-- Tab 1: Roles -->
              <p-tabpanel [value]="1">
                <div class="py-4">
                  @defer {
                    <app-workspace-roles-tab [workspaceId]="workspaceId" />
                  } @placeholder {
                    <div class="flex items-center justify-center py-12">
                      <i class="pi pi-spin pi-spinner text-2xl text-[var(--muted-foreground)]"></i>
                    </div>
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 2: Config -->
              <p-tabpanel [value]="2">
                <div class="py-4 space-y-8">
                  <!-- General -->
                  <section>
                    <h2 class="text-lg font-semibold text-[var(--foreground)] mb-3">General</h2>
                    @defer {
                      <app-workspace-general-tab
                        [workspace]="workspace()"
                        [workspaceId]="workspaceId"
                        [isAdmin]="isAdmin()"
                        (workspaceSaved)="onWorkspaceSaved($event)"
                      />
                    } @placeholder {
                      <div class="h-32 bg-[var(--muted)] rounded-xl animate-pulse"></div>
                    }
                  </section>

                  <!-- Labels -->
                  <section>
                    @defer {
                      <app-workspace-labels [workspaceId]="workspaceId" />
                    } @placeholder {
                      <div class="h-24 bg-[var(--muted)] rounded-xl animate-pulse"></div>
                    }
                  </section>

                  <!-- Integrations -->
                  <section>
                    <h2 class="text-lg font-semibold text-[var(--foreground)] mb-3">Integrations</h2>
                    @defer {
                      <app-workspace-api-keys-tab [workspaceId]="workspaceId" />
                    } @placeholder {
                      <div class="h-24 bg-[var(--muted)] rounded-xl animate-pulse"></div>
                    }
                  </section>

                  <!-- Advanced -->
                  <section>
                    @defer {
                      <app-workspace-advanced-tab
                        [workspace]="workspace()"
                        [workspaceId]="workspaceId"
                      />
                    } @placeholder {
                      <div class="h-16 bg-[var(--muted)] rounded-xl animate-pulse"></div>
                    }
                  </section>

                  <!-- Danger Zone (Super Admin only) -->
                  @if (permissionService.isSuperAdmin()) {
                    <section>
                      <div class="rounded-xl border-2 border-red-200 dark:border-red-800 p-5">
                        <h2 class="text-lg font-semibold text-red-700 dark:text-red-300 mb-4">Danger Zone</h2>
                        <div class="flex items-center justify-between">
                          <div>
                            <h3 class="text-sm font-medium text-[var(--foreground)]">Delete Workspace</h3>
                            <p class="text-sm text-[var(--muted-foreground)]">
                              Permanently delete this workspace and all its data. This action cannot be undone.
                            </p>
                          </div>
                          <button
                            (click)="onDeleteWorkspace()"
                            class="inline-flex items-center px-4 py-2 border border-red-300 dark:border-red-700 text-sm font-medium rounded-md text-red-700 dark:text-red-300 bg-[var(--card)] hover:bg-red-50 dark:hover:bg-red-950 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            Delete Workspace
                          </button>
                        </div>
                      </div>
                    </section>
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 3: Activity -->
              <p-tabpanel [value]="3">
                <div class="py-4 space-y-6">
                  <section>
                    @if (members().length === 0 && !loading()) {
                      <div class="text-center py-8 rounded-xl border border-dashed border-[var(--border)]">
                        <i class="pi pi-clock text-3xl text-[var(--muted-foreground)] mb-2"></i>
                        <p class="text-[var(--muted-foreground)]">No activity yet — changes will appear here</p>
                      </div>
                    } @else {
                      @defer {
                        <app-audit-log [workspaceId]="workspaceId" />
                      } @placeholder {
                        <div class="h-48 bg-[var(--muted)] rounded-xl animate-pulse"></div>
                      }
                    }
                  </section>

                  <section>
                    @defer {
                      <app-trash [workspaceId]="workspaceId" />
                    } @placeholder {
                      <div class="h-24 bg-[var(--muted)] rounded-xl animate-pulse"></div>
                    }
                  </section>
                </div>
              </p-tabpanel>
            </p-tabpanels>
          </p-tabs>
        }
        <!-- Dialogs -->
        <app-team-detail-dialog
          [(visible)]="showCreateTeamDialog"
          [workspaceId]="workspaceId"
          (saved)="onTeamSaved($event)"
        />

        <app-invite-member-dialog
          [(visible)]="showInviteDialog"
          [workspaceId]="workspaceId"
          [workspaceName]="workspace()?.name ?? 'this workspace'"
          [boards]="[]"
          (created)="onMemberInvited()"
        />
      </div>
    </div>
  `,
})
export class ManageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private workspaceService = inject(WorkspaceService);
  private teamGroupsService = inject(TeamGroupsService);
  private authService = inject(AuthService);
  readonly permissionService = inject(PermissionService);

  workspaceId = '';

  loading = signal(true);
  workspace = signal<Workspace | null>(null);
  members = signal<Array<{
    user_id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    role: string;
    joined_at: string;
    is_org_admin?: boolean;
  }>>([]);
  teams = signal<Array<{ id: string; name: string; color: string; workspace_id: string }>>([]);
  errorMessage = signal<string | null>(null);
  activeTab = signal(0);
  showInviteDialog = signal(false);
  showCreateTeamDialog = signal(false);

  // Computed: hero stats
  memberCount = computed(() => this.members().length);
  teamCount = computed(() => this.teams().length);
  pendingInvites = computed(() =>
    this.members().filter((m) => m.role === 'pending').length,
  );

  // Computed: first 8 members for avatar stack
  avatarMembers = computed(() => this.members().slice(0, 8));

  // Computed: RBAC — determine if current user is admin/owner/manager
  isAdmin = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    const member = this.members().find((m) => m.user_id === user.id);
    if (!member) return false;
    const role = member.role.toLowerCase();
    return role === 'owner' || role === 'admin' || role === 'manager';
  });

  // Computed: visible tabs based on role
  visibleTabs = computed(() => {
    if (this.isAdmin()) {
      return ALL_TABS;
    }
    return ALL_TABS.filter((t) => !t.requiresAdmin);
  });

  // Computed: members as MemberWithDetails for the members-list component
  memberDetails = computed<MemberWithDetails[]>(() =>
    this.members().map((m) => ({
      ...m,
      workspace_id: this.workspaceId,
      role: m.role.toLowerCase() as WorkspaceMember['role'],
      display_name: m.name,
      joined_at: m.joined_at || new Date().toISOString(),
      job_title: null,
      department: null,
      is_org_admin: m.is_org_admin ?? false,
    })),
  );

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.workspaceId = params['workspaceId'];
        this.loadData();
      });

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((qp) => {
        const tabParam = qp['tab'];
        if (tabParam !== undefined && tabParam !== null) {
          const tabIndex = parseInt(tabParam, 10);
          if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 3) {
            this.activeTab.set(tabIndex);
          }
        }
      });
  }

  onTabChange(tabValue: unknown): void {
    this.activeTab.set(tabValue as number);
  }

  onWorkspaceSaved(updated: Workspace): void {
    this.workspace.set(updated);
  }

  onMemberRemoved(userId: string): void {
    this.members.update((members) =>
      members.filter((m) => m.user_id !== userId),
    );
  }

  onDeleteWorkspace(): void {
    if (!confirm('Are you sure you want to permanently delete this workspace? This action cannot be undone.')) {
      return;
    }
    this.workspaceService.delete(this.workspaceId).subscribe({
      next: () => {
        window.location.href = '/';
      },
      error: () => {
        this.showError('Failed to delete workspace. Please try again.');
      },
    });
  }

  onTeamSaved(_team: TeamGroupDetail): void {
    // Refresh team count
    this.teamGroupsService.listTeams(this.workspaceId).subscribe({
      next: (teams) => this.teams.set(teams as Array<{ id: string; name: string; color: string; workspace_id: string }>),
    });
  }

  onMemberInvited(): void {
    this.loadData();
  }

  showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  private loadData(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.workspaceService.get(this.workspaceId).subscribe({
      next: (workspace) => {
        this.workspace.set(workspace);
        // Extract embedded members from workspace response
        const wsAny = workspace as unknown as Record<string, unknown>;
        const embeddedMembers = (wsAny['members'] ?? []) as Array<{
          user_id: string;
          name: string;
          email: string;
          avatar_url: string | null;
          role: string;
          joined_at: string;
          is_org_admin?: boolean;
        }>;
        this.members.set(embeddedMembers);
        this.loading.set(false);
        // Load team count for hero stats (non-blocking)
        this.teamGroupsService.listTeams(this.workspaceId).subscribe({
          next: (teams) => this.teams.set(teams as Array<{ id: string; name: string; color: string; workspace_id: string }>),
          error: () => { /* non-critical */ },
        });
      },
      error: () => {
        this.loading.set(false);
        this.showError('Failed to load workspace data. Please try again.');
      },
    });
  }
}
