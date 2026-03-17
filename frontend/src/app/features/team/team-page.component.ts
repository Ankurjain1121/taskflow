import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError } from 'rxjs';
import { Tabs } from 'primeng/tabs';
import { TabList } from 'primeng/tabs';
import { TabPanels } from 'primeng/tabs';
import { TabPanel } from 'primeng/tabs';
import { Tab } from 'primeng/tabs';
import { Select } from 'primeng/select';
import {
  WorkspaceService,
  Workspace,
  WorkspaceMember,
  TenantMember,
  MemberRoleBatch,
} from '../../core/services/workspace.service';
import { ProjectService } from '../../core/services/project.service';
import { TeamService, MemberWorkload } from '../../core/services/team.service';
import {
  MemberWithDetails,
} from '../workspace/members-list/members-list.component';
import { TeamsListComponent } from '../workspace/teams/teams-list.component';
import { WorkspacesPanelComponent } from './workspaces-panel/workspaces-panel.component';
import { OrgMembersComponent } from './org-members/org-members.component';
import { TasksDuePanelComponent } from './tasks-due-panel/tasks-due-panel.component';
import { WorkspaceRolesComponent } from './workspace-roles/workspace-roles.component';

interface WorkspaceWithMembers {
  workspace: Workspace;
  members: MemberWithDetails[];
  boards: { id: string; name: string }[];
}

interface WorkspaceTeam {
  workspace: Workspace;
  members: MemberWorkload[];
}

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    Tabs,
    TabList,
    TabPanels,
    TabPanel,
    Tab,
    Select,
    TeamsListComponent,
    WorkspacesPanelComponent,
    OrgMembersComponent,
    TasksDuePanelComponent,
    WorkspaceRolesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--secondary)]">
      <header
        class="bg-[var(--card)] shadow-sm border-b border-[var(--border)]"
      >
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <h1 class="text-2xl font-bold text-[var(--card-foreground)]">Team</h1>
          <p class="text-[var(--muted-foreground)] mt-1 text-sm">
            Central hub for managing members, workspaces, teams, and workload
          </p>
        </div>
      </header>

      <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        @if (loading()) {
          <div class="space-y-8">
            @for (i of [1, 2]; track i) {
              <div>
                <div class="skeleton skeleton-text w-40 mb-4"></div>
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  @for (j of [1, 2, 3]; track j) {
                    <div
                      class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4"
                    >
                      <div class="flex items-center gap-3">
                        <div class="skeleton skeleton-circle w-10 h-10"></div>
                        <div class="space-y-2 flex-1">
                          <div class="skeleton skeleton-text w-24"></div>
                          <div
                            class="skeleton skeleton-text w-16"
                            style="height: 0.625rem"
                          ></div>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        } @else if (error()) {
          <div
            class="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700"
          >
            {{ error() }}
          </div>
        } @else {
          <!-- Summary Stats -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            <div class="widget-card p-4">
              <p class="text-2xl font-bold text-[var(--foreground)]">
                {{ totalUniqueMembers() }}
              </p>
              <p class="text-xs text-[var(--muted-foreground)]">
                Total Members
              </p>
            </div>
            <div class="widget-card p-4">
              <p class="text-2xl font-bold text-[var(--foreground)]">
                {{ allWorkspaces().length }}
              </p>
              <p class="text-xs text-[var(--muted-foreground)]">Workspaces</p>
            </div>
            <div class="widget-card p-4">
              <p class="text-2xl font-bold text-[var(--foreground)]">
                {{ totalActiveTasks() }}
              </p>
              <p class="text-xs text-[var(--muted-foreground)]">Active Tasks</p>
            </div>
            <div class="widget-card p-4">
              <p
                class="text-2xl font-bold"
                [class.text-amber-600]="totalDueToday() > 0"
                [class.text-[var(--foreground)]]="totalDueToday() === 0"
              >
                {{ totalDueToday() }}
              </p>
              <p class="text-xs text-[var(--muted-foreground)]">Due Today</p>
            </div>
            <div class="widget-card p-4">
              <p
                class="text-2xl font-bold"
                [class.text-red-600]="totalOverloaded() > 0"
                [class.text-[var(--foreground)]]="totalOverloaded() === 0"
              >
                {{ totalOverloaded() }}
              </p>
              <p class="text-xs text-[var(--muted-foreground)]">Overloaded</p>
            </div>
          </div>

          <p-tabs [value]="0" (valueChange)="onTabChange($event)">
            <p-tablist>
              <p-tab [value]="0">Overview</p-tab>
              <p-tab [value]="1">Members</p-tab>
              <p-tab [value]="2">Teams</p-tab>
              <p-tab [value]="3">Workload</p-tab>
              <p-tab [value]="4">Tasks Due</p-tab>
              <p-tab [value]="5">Job Roles</p-tab>
            </p-tablist>
            <p-tabpanels>
              <!-- Overview Tab -->
              <p-tabpanel [value]="0">
                <div class="py-6">
                  <app-workspaces-panel
                    [workspaces]="allWorkspaces()"
                    [workspaceMemberCounts]="workspaceMemberCounts()"
                    (workspaceCreated)="onWorkspaceCreated($event)"
                    (workspaceDeleted)="onWorkspaceDeleted($event)"
                    (workspaceRenamed)="onWorkspaceRenamed($event)"
                  />
                </div>
              </p-tabpanel>

              <!-- Members Tab (Org-level) -->
              <p-tabpanel [value]="1">
                @if (tenantMembersLoading()) {
                  <div class="py-8 text-center">
                    <p
                      class="text-sm text-[var(--muted-foreground)] animate-pulse"
                    >
                      Loading members...
                    </p>
                  </div>
                } @else {
                  <app-org-members
                    [members]="tenantMembers()"
                    [allWorkspaces]="allWorkspaces()"
                    [memberRoles]="allMemberRoles()"
                    (membersAdded)="onMembersAdded()"
                    (membersInvited)="onMembersInvited()"
                  />
                }
              </p-tabpanel>

              <!-- Teams Tab -->
              <p-tabpanel [value]="2">
                <div class="py-6">
                  <!-- Workspace Filter -->
                  <div class="mb-6">
                    <p-select
                      [options]="workspaceFilterOptions()"
                      [(ngModel)]="selectedWorkspaceFilter"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Filter by workspace"
                      [style]="{ 'min-width': '220px' }"
                    />
                  </div>

                  @for (ws of filteredWorkspaces; track ws.id) {
                    <div class="mb-8">
                      <h2
                        class="text-lg font-semibold text-[var(--card-foreground)] mb-4"
                      >
                        {{ ws.name }}
                      </h2>
                      <app-teams-list [workspaceId]="ws.id" />
                    </div>
                  }

                  @if (filteredWorkspaces.length === 0) {
                    <div class="text-center py-8">
                      <p class="text-sm text-[var(--muted-foreground)]">
                        No workspaces found for the selected filter.
                      </p>
                    </div>
                  }
                </div>
              </p-tabpanel>

              <!-- Workload Tab -->
              <p-tabpanel [value]="3">
                @if (workspaceTeams().length === 0) {
                  <div class="text-center py-8">
                    <p class="text-sm text-[var(--muted-foreground)]">
                      No workload data available.
                    </p>
                  </div>
                } @else {
                  <p-tabs [value]="0">
                    <p-tablist>
                      <p-tab [value]="0">Overview</p-tab>
                      <p-tab [value]="1">Workload Dashboard</p-tab>
                    </p-tablist>
                    <p-tabpanels>
                      <!-- Overview Sub-Tab -->
                      <p-tabpanel [value]="0">
                        <div class="py-6">
                          @for (wt of workspaceTeams(); track wt.workspace.id) {
                            <div class="mb-10">
                              <div
                                class="flex items-center justify-between mb-4"
                              >
                                <h2
                                  class="text-lg font-semibold text-[var(--card-foreground)]"
                                >
                                  {{ wt.workspace.name }}
                                </h2>
                                <a
                                  [routerLink]="[
                                    '/workspace',
                                    wt.workspace.id,
                                    'team',
                                  ]"
                                  class="text-sm text-primary hover:text-primary"
                                >
                                  View details
                                </a>
                              </div>

                              @if (wt.members.length === 0) {
                                <p
                                  class="text-sm text-[var(--muted-foreground)] py-4"
                                >
                                  No members in this workspace.
                                </p>
                              } @else {
                                <div
                                  class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                                >
                                  @for (
                                    member of wt.members;
                                    track member.user_id
                                  ) {
                                    <a
                                      [routerLink]="[
                                        '/workspace',
                                        wt.workspace.id,
                                        'team',
                                        'member',
                                        member.user_id,
                                      ]"
                                      class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 block hover:shadow-md hover:border-primary/30 transition-all cursor-pointer no-underline"
                                      [class.border-red-300]="
                                        member.is_overloaded
                                      "
                                    >
                                      <div class="flex items-center gap-3 mb-3">
                                        <div
                                          class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary"
                                        >
                                          {{ getInitials(member.user_name) }}
                                        </div>
                                        <div class="min-w-0 flex-1">
                                          <p
                                            class="text-sm font-medium text-[var(--card-foreground)] truncate"
                                          >
                                            {{ member.user_name }}
                                          </p>
                                          @if (member.is_overloaded) {
                                            <span
                                              class="text-xs text-red-500 font-medium"
                                              >Overloaded</span
                                            >
                                          }
                                        </div>
                                      </div>
                                      <div
                                        class="grid grid-cols-5 gap-1 text-center"
                                      >
                                        <div>
                                          <p
                                            class="text-lg font-semibold text-[var(--card-foreground)]"
                                          >
                                            {{ member.active_tasks }}
                                          </p>
                                          <p
                                            class="text-[10px] text-[var(--muted-foreground)]"
                                          >
                                            Active
                                          </p>
                                        </div>
                                        <div>
                                          <p
                                            class="text-lg font-semibold"
                                            [class]="
                                              member.overdue_tasks > 0
                                                ? 'text-red-500'
                                                : 'text-[var(--card-foreground)]'
                                            "
                                          >
                                            {{ member.overdue_tasks }}
                                          </p>
                                          <p
                                            class="text-[10px] text-[var(--muted-foreground)]"
                                          >
                                            Overdue
                                          </p>
                                        </div>
                                        <div>
                                          <p
                                            class="text-lg font-semibold"
                                            [class]="
                                              member.due_today > 0
                                                ? 'text-amber-600'
                                                : 'text-[var(--card-foreground)]'
                                            "
                                          >
                                            {{ member.due_today }}
                                          </p>
                                          <p
                                            class="text-[10px] text-[var(--muted-foreground)]"
                                          >
                                            Today
                                          </p>
                                        </div>
                                        <div>
                                          <p
                                            class="text-lg font-semibold text-blue-600"
                                          >
                                            {{ member.due_this_week }}
                                          </p>
                                          <p
                                            class="text-[10px] text-[var(--muted-foreground)]"
                                          >
                                            This Wk
                                          </p>
                                        </div>
                                        <div>
                                          <p
                                            class="text-lg font-semibold text-emerald-600"
                                          >
                                            {{ member.done_tasks }}
                                          </p>
                                          <p
                                            class="text-[10px] text-[var(--muted-foreground)]"
                                          >
                                            Done
                                          </p>
                                        </div>
                                      </div>
                                    </a>
                                  }
                                </div>
                              }
                            </div>
                          }
                        </div>
                      </p-tabpanel>

                      <!-- Workload Dashboard Sub-Tab -->
                      <p-tabpanel [value]="1">
                        <div class="py-6 space-y-6">
                          @for (wt of workspaceTeams(); track wt.workspace.id) {
                            <div>
                              <h2
                                class="text-lg font-semibold text-[var(--card-foreground)] mb-4"
                              >
                                {{ wt.workspace.name }}
                              </h2>

                              @if (wt.members.length === 0) {
                                <p
                                  class="text-sm text-[var(--muted-foreground)] py-4"
                                >
                                  No members to display.
                                </p>
                              } @else {
                                <!-- Summary Stats -->
                                <div
                                  class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4"
                                >
                                  <div class="widget-card p-4">
                                    <p
                                      class="text-xl font-bold text-[var(--foreground)]"
                                    >
                                      {{ getTotalActive(wt.members) }}
                                    </p>
                                    <p
                                      class="text-xs text-[var(--muted-foreground)]"
                                    >
                                      Total Active
                                    </p>
                                  </div>
                                  <div class="widget-card p-4">
                                    <p
                                      class="text-xl font-bold text-[var(--foreground)]"
                                    >
                                      {{ getAvgPerMember(wt.members) }}
                                    </p>
                                    <p
                                      class="text-xs text-[var(--muted-foreground)]"
                                    >
                                      Avg per Member
                                    </p>
                                  </div>
                                  <div class="widget-card p-4">
                                    <p
                                      class="text-xl font-bold"
                                      [class.text-red-600]="
                                        getOverloadedCount(wt.members) > 0
                                      "
                                    >
                                      {{ getOverloadedCount(wt.members) }}
                                    </p>
                                    <p
                                      class="text-xs text-[var(--muted-foreground)]"
                                    >
                                      Overloaded
                                    </p>
                                  </div>
                                </div>

                                <!-- Bars -->
                                <div
                                  class="widget-card divide-y divide-[var(--border)]"
                                >
                                  @for (
                                    member of getSortedMembers(wt.members);
                                    track member.user_id
                                  ) {
                                    <a
                                      [routerLink]="[
                                        '/workspace',
                                        wt.workspace.id,
                                        'team',
                                        'member',
                                        member.user_id,
                                      ]"
                                      class="block px-6 py-4 hover:bg-[var(--secondary)]/50 transition-colors cursor-pointer no-underline"
                                    >
                                      <div class="flex items-center gap-3 mb-2">
                                        <div
                                          class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0"
                                        >
                                          {{ getInitials(member.user_name) }}
                                        </div>
                                        <span
                                          class="text-sm font-medium text-[var(--foreground)] flex-1 truncate"
                                        >
                                          {{ member.user_name }}
                                        </span>
                                        <span
                                          class="text-xs text-[var(--muted-foreground)]"
                                        >
                                          {{ member.active_tasks }} active
                                        </span>
                                      </div>
                                      <div class="ml-11">
                                        <div
                                          class="w-full bg-[var(--secondary)] rounded-full h-5 overflow-hidden"
                                        >
                                          <div
                                            class="h-5 rounded-full transition-all duration-500"
                                            [style.width.%]="
                                              getBarWidth(
                                                member.active_tasks,
                                                getMaxTasks(wt.members)
                                              )
                                            "
                                            [class.bg-green-500]="
                                              member.active_tasks < 5
                                            "
                                            [class.bg-yellow-500]="
                                              member.active_tasks >= 5 &&
                                              member.active_tasks <= 10
                                            "
                                            [class.bg-red-500]="
                                              member.active_tasks > 10
                                            "
                                          ></div>
                                        </div>
                                        <div
                                          class="flex items-center gap-3 mt-1"
                                        >
                                          <span
                                            class="text-xs text-[var(--muted-foreground)]"
                                          >
                                            {{ member.done_tasks }} done
                                          </span>
                                          @if (member.overdue_tasks > 0) {
                                            <span
                                              class="text-xs text-red-500 font-medium"
                                            >
                                              {{ member.overdue_tasks }}
                                              overdue
                                            </span>
                                          }
                                          @if (member.due_today > 0) {
                                            <span
                                              class="text-xs text-amber-600 font-medium"
                                            >
                                              {{ member.due_today }} due today
                                            </span>
                                          }
                                          @if (
                                            member.due_this_week > 0
                                          ) {
                                            <span
                                              class="text-xs text-blue-500 font-medium"
                                            >
                                              {{ member.due_this_week }} this
                                              week
                                            </span>
                                          }
                                        </div>
                                      </div>
                                    </a>
                                  }
                                </div>
                              }
                            </div>
                          }

                          <!-- Legend -->
                          <div
                            class="flex items-center gap-4 text-xs text-[var(--muted-foreground)]"
                          >
                            <div class="flex items-center gap-1.5">
                              <span
                                class="w-3 h-3 rounded-full bg-green-500"
                              ></span>
                              Under 5 tasks
                            </div>
                            <div class="flex items-center gap-1.5">
                              <span
                                class="w-3 h-3 rounded-full bg-yellow-500"
                              ></span>
                              5-10 tasks
                            </div>
                            <div class="flex items-center gap-1.5">
                              <span
                                class="w-3 h-3 rounded-full bg-red-500"
                              ></span>
                              Over 10 tasks
                            </div>
                          </div>
                        </div>
                      </p-tabpanel>
                    </p-tabpanels>
                  </p-tabs>
                }
              </p-tabpanel>

              <!-- Tasks Due Tab -->
              <p-tabpanel [value]="4">
                <div class="py-6">
                  <app-tasks-due-panel [workspaceTeams]="workspaceTeams()" />
                </div>
              </p-tabpanel>

              <!-- Job Roles Tab -->
              <p-tabpanel [value]="5">
                <div class="py-6 space-y-8">
                  @for (ws of allWorkspaces(); track ws.id) {
                    <div>
                      <h2
                        class="text-lg font-semibold text-[var(--card-foreground)] mb-4"
                      >
                        {{ ws.name }}
                      </h2>
                      <app-workspace-roles [workspaceId]="ws.id" />
                    </div>
                  }
                  @if (allWorkspaces().length === 0) {
                    <div class="text-center py-8">
                      <p class="text-sm text-[var(--muted-foreground)]">
                        No workspaces found.
                      </p>
                    </div>
                  }
                </div>
              </p-tabpanel>
            </p-tabpanels>
          </p-tabs>
        }
      </main>
    </div>
  `,
})
export class TeamPageComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);
  private projectService = inject(ProjectService);
  private teamService = inject(TeamService);

  loading = signal(true);
  error = signal<string | null>(null);
  allWorkspaces = signal<Workspace[]>([]);
  workspaceMembers = signal<WorkspaceWithMembers[]>([]);
  workspaceTeams = signal<WorkspaceTeam[]>([]);
  selectedWorkspaceFilter: string = 'all';

  // Tenant members (lazy loaded on Members tab)
  tenantMembers = signal<TenantMember[]>([]);
  tenantMembersLoading = signal(false);
  tenantMembersLoaded = signal(false);

  // Member job roles (batch loaded for all workspaces)
  allMemberRoles = signal<MemberRoleBatch[]>([]);

  // Summary stats
  totalUniqueMembers = computed(() => {
    const seen = new Set<string>();
    for (const wm of this.workspaceMembers()) {
      for (const m of wm.members) {
        seen.add(m.user_id);
      }
    }
    return seen.size;
  });

  totalActiveTasks = computed(() => {
    return this.workspaceTeams().reduce(
      (sum, wt) => sum + wt.members.reduce((s, m) => s + m.active_tasks, 0),
      0,
    );
  });

  totalOverloaded = computed(() => {
    return this.workspaceTeams().reduce(
      (sum, wt) => sum + wt.members.filter((m) => m.is_overloaded).length,
      0,
    );
  });

  totalDueToday = computed(() => {
    return this.workspaceTeams().reduce(
      (sum, wt) => sum + wt.members.reduce((s, m) => s + (m.due_today ?? 0), 0),
      0,
    );
  });

  workspaceMemberCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const wm of this.workspaceMembers()) {
      counts[wm.workspace.id] = wm.members.length;
    }
    return counts;
  });

  workspaceFilterOptions = computed(() => {
    const options: { label: string; value: string }[] = [
      { label: 'All Workspaces', value: 'all' },
    ];
    for (const ws of this.allWorkspaces()) {
      options.push({ label: ws.name, value: ws.id });
    }
    return options;
  });

  get filteredWorkspaces(): Workspace[] {
    const filter = this.selectedWorkspaceFilter;
    if (filter === 'all') return this.allWorkspaces();
    return this.allWorkspaces().filter((ws) => ws.id === filter);
  }

  ngOnInit(): void {
    this.loadData();
  }

  onTabChange(tabIndex: unknown): void {
    if (tabIndex === 1 && !this.tenantMembersLoaded()) {
      this.loadTenantMembers();
    }
  }

  onWorkspaceCreated(ws: Workspace): void {
    this.allWorkspaces.update((list) => [ws, ...list]);
  }

  onWorkspaceDeleted(wsId: string): void {
    this.allWorkspaces.update((list) => list.filter((ws) => ws.id !== wsId));
    this.workspaceMembers.update((list) =>
      list.filter((wm) => wm.workspace.id !== wsId),
    );
    this.workspaceTeams.update((list) =>
      list.filter((wt) => wt.workspace.id !== wsId),
    );
  }

  onWorkspaceRenamed(updated: Workspace): void {
    this.allWorkspaces.update((list) =>
      list.map((ws) => (ws.id === updated.id ? updated : ws)),
    );
  }

  onMembersAdded(): void {
    // Reload tenant members to reflect updated workspace counts
    this.loadTenantMembers();
    // Reload workspace member data
    this.loadData();
  }

  onMembersInvited(): void {
    this.loadTenantMembers();
  }

  onMemberRemoved(workspaceId: string, userId: string): void {
    this.workspaceMembers.update((wms) =>
      wms.map((wm) =>
        wm.workspace.id === workspaceId
          ? {
              ...wm,
              members: wm.members.filter((m) => m.user_id !== userId),
            }
          : wm,
      ),
    );
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getTotalActive(members: MemberWorkload[]): number {
    return members.reduce((sum, m) => sum + m.active_tasks, 0);
  }

  getAvgPerMember(members: MemberWorkload[]): number {
    if (members.length === 0) return 0;
    return Math.round(this.getTotalActive(members) / members.length);
  }

  getOverloadedCount(members: MemberWorkload[]): number {
    return members.filter((m) => m.is_overloaded).length;
  }

  getSortedMembers(members: MemberWorkload[]): MemberWorkload[] {
    return [...members].sort((a, b) => b.active_tasks - a.active_tasks);
  }

  getMaxTasks(members: MemberWorkload[]): number {
    const max = Math.max(...members.map((m) => m.active_tasks), 1);
    return Math.max(max, 10);
  }

  getBarWidth(activeTasks: number, maxTasks: number): number {
    return Math.max((activeTasks / maxTasks) * 100, 2);
  }

  private loadTenantMembers(): void {
    this.tenantMembersLoading.set(true);
    this.workspaceService.listTenantMembers().subscribe({
      next: (members) => {
        this.tenantMembers.set(members);
        this.tenantMembersLoading.set(false);
        this.tenantMembersLoaded.set(true);
      },
      error: () => {
        this.tenantMembersLoading.set(false);
      },
    });

    // Load member job roles from all workspaces
    const workspaces = this.allWorkspaces();
    if (workspaces.length > 0) {
      const roleRequests = workspaces.map((ws) =>
        this.workspaceService
          .listAllMemberRoles(ws.id)
          .pipe(catchError(() => of([] as MemberRoleBatch[]))),
      );
      forkJoin(roleRequests).subscribe({
        next: (results) => {
          const allRoles = results.flat();
          this.allMemberRoles.set(allRoles);
        },
        error: (err) => { console.error('Failed to load member roles:', err); },
      });
    }
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.workspaceService.list().subscribe({
      next: (workspaces) => {
        this.allWorkspaces.set(workspaces);

        if (workspaces.length === 0) {
          this.loading.set(false);
          return;
        }

        // Load members data for each workspace
        const memberRequests = workspaces.map((ws) =>
          forkJoin({
            workspace: of(ws),
            details: this.workspaceService
              .get(ws.id)
              .pipe(catchError(() => of(null))),
            boards: this.projectService
              .listBoards(ws.id)
              .pipe(catchError(() => of([] as { id: string; name: string }[]))),
          }),
        );

        // Load workload data for each workspace
        const workloadRequests = workspaces.map((ws) =>
          this.teamService
            .getTeamWorkload(ws.id)
            .pipe(catchError(() => of([] as MemberWorkload[]))),
        );

        forkJoin(memberRequests).subscribe({
          next: (results) => {
            const wsMembers: WorkspaceWithMembers[] = results.map((r) => {
              const embeddedMembers = this.extractMembers(
                r.details,
                r.workspace.id,
              );
              return {
                workspace: r.workspace,
                members: embeddedMembers,
                boards: r.boards.map((b) => ({
                  id: b.id,
                  name: b.name,
                })),
              };
            });
            this.workspaceMembers.set(wsMembers);
          },
          error: (err) => { console.error('Failed to load workspace members:', err); },
        });

        forkJoin(workloadRequests).subscribe({
          next: (results) => {
            const teams: WorkspaceTeam[] = workspaces.map((ws, i) => ({
              workspace: ws,
              members: results[i],
            }));
            this.workspaceTeams.set(teams);
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set('Failed to load workspaces. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private extractMembers(
    wsDetail: Workspace | null,
    workspaceId: string,
  ): MemberWithDetails[] {
    if (!wsDetail) return [];
    const wsAny = wsDetail as unknown as Record<string, unknown>;
    const embedded = (wsAny['members'] ?? []) as Array<{
      user_id: string;
      name: string;
      email: string;
      avatar_url: string | null;
      job_title: string | null;
      department: string | null;
      role: string;
      joined_at: string;
    }>;
    return embedded.map((m) => ({
      user_id: m.user_id,
      workspace_id: workspaceId,
      role: m.role.toLowerCase() as WorkspaceMember['role'],
      display_name: m.name,
      email: m.email,
      avatar_url: m.avatar_url,
      job_title: m.job_title,
      department: m.department,
      joined_at: m.joined_at || new Date().toISOString(),
    }));
  }
}
