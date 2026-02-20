import {
  Component,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { Tabs } from 'primeng/tabs';
import { TabList } from 'primeng/tabs';
import { TabPanels } from 'primeng/tabs';
import { TabPanel } from 'primeng/tabs';
import { Tab } from 'primeng/tabs';
import {
  WorkspaceService,
  Workspace,
} from '../../core/services/workspace.service';
import { TeamService, MemberWorkload } from '../../core/services/team.service';

interface WorkspaceTeam {
  workspace: Workspace;
  members: MemberWorkload[];
}

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [CommonModule, RouterLink, Tabs, TabList, TabPanels, TabPanel, Tab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--secondary)]">
      <header
        class="bg-[var(--card)] shadow-sm border-b border-[var(--border)]"
      >
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <h1 class="text-2xl font-bold text-[var(--card-foreground)]">Team</h1>
          <p class="text-[var(--muted-foreground)] mt-1 text-sm">
            Team workload across all workspaces
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
        } @else if (workspaceTeams().length === 0) {
          <div class="text-center py-16">
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <h3 class="mt-4 text-lg font-medium text-[var(--card-foreground)]">
              No team data
            </h3>
            <p class="mt-2 text-sm text-[var(--muted-foreground)]">
              Create a workspace and add team members to see workload.
            </p>
          </div>
        } @else {
          <p-tabs [value]="0">
            <p-tablist>
              <p-tab [value]="0">Overview</p-tab>
              <p-tab [value]="1">Workload Dashboard</p-tab>
            </p-tablist>
            <p-tabpanels>
              <!-- Overview Tab -->
              <p-tabpanel [value]="0">
                <div class="py-6">
                  @for (wt of workspaceTeams(); track wt.workspace.id) {
                    <div class="mb-10">
                      <div class="flex items-center justify-between mb-4">
                        <h2
                          class="text-lg font-semibold text-[var(--card-foreground)]"
                        >
                          {{ wt.workspace.name }}
                        </h2>
                        <a
                          [routerLink]="['/workspace', wt.workspace.id, 'team']"
                          class="text-sm text-primary hover:text-primary"
                        >
                          View details
                        </a>
                      </div>

                      @if (wt.members.length === 0) {
                        <p class="text-sm text-[var(--muted-foreground)] py-4">
                          No members in this workspace.
                        </p>
                      } @else {
                        <div
                          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                          @for (member of wt.members; track member.user_id) {
                            <div
                              class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4"
                              [class.border-red-300]="member.is_overloaded"
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
                              <div class="grid grid-cols-3 gap-2 text-center">
                                <div>
                                  <p
                                    class="text-lg font-semibold text-[var(--card-foreground)]"
                                  >
                                    {{ member.active_tasks }}
                                  </p>
                                  <p
                                    class="text-xs text-[var(--muted-foreground)]"
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
                                    class="text-xs text-[var(--muted-foreground)]"
                                  >
                                    Overdue
                                  </p>
                                </div>
                                <div>
                                  <p
                                    class="text-lg font-semibold text-emerald-600"
                                  >
                                    {{ member.done_tasks }}
                                  </p>
                                  <p
                                    class="text-xs text-[var(--muted-foreground)]"
                                  >
                                    Done
                                  </p>
                                </div>
                              </div>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              </p-tabpanel>

              <!-- Workload Dashboard Tab -->
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
                        <p class="text-sm text-[var(--muted-foreground)] py-4">
                          No members to display.
                        </p>
                      } @else {
                        <!-- Summary Stats -->
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                          <div class="widget-card p-4">
                            <p
                              class="text-xl font-bold text-[var(--foreground)]"
                            >
                              {{ getTotalActive(wt.members) }}
                            </p>
                            <p class="text-xs text-[var(--muted-foreground)]">
                              Total Active
                            </p>
                          </div>
                          <div class="widget-card p-4">
                            <p
                              class="text-xl font-bold text-[var(--foreground)]"
                            >
                              {{ getAvgPerMember(wt.members) }}
                            </p>
                            <p class="text-xs text-[var(--muted-foreground)]">
                              Avg per Member
                            </p>
                          </div>
                          <div class="widget-card p-4">
                            <p
                              class="text-xl font-bold"
                              [class.text-red-600]="
                                getOverloadedCount(wt.members) > 0
                              "
                              [class.text-[var(--foreground)]]="
                                getOverloadedCount(wt.members) === 0
                              "
                            >
                              {{ getOverloadedCount(wt.members) }}
                            </p>
                            <p class="text-xs text-[var(--muted-foreground)]">
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
                            <div class="px-6 py-4">
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
                                <div class="flex items-center gap-3 mt-1">
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
                                </div>
                              </div>
                            </div>
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
                      <span class="w-3 h-3 rounded-full bg-green-500"></span>
                      Under 5 tasks
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="w-3 h-3 rounded-full bg-yellow-500"></span>
                      5-10 tasks
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="w-3 h-3 rounded-full bg-red-500"></span>
                      Over 10 tasks
                    </div>
                  </div>
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
  private teamService = inject(TeamService);

  loading = signal(true);
  error = signal<string | null>(null);
  workspaceTeams = signal<WorkspaceTeam[]>([]);

  ngOnInit(): void {
    this.loadTeamData();
  }

  loadTeamData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.workspaceService.list().subscribe({
      next: (workspaces) => {
        if (workspaces.length === 0) {
          this.workspaceTeams.set([]);
          this.loading.set(false);
          return;
        }

        const requests = workspaces.map((ws) =>
          this.teamService
            .getTeamWorkload(ws.id)
            .pipe(catchError(() => of([] as MemberWorkload[]))),
        );

        forkJoin(requests).subscribe({
          next: (results) => {
            const teams: WorkspaceTeam[] = workspaces.map((ws, i) => ({
              workspace: ws,
              members: results[i],
            }));
            this.workspaceTeams.set(teams);
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
}
