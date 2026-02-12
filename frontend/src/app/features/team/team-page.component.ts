import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { WorkspaceService, Workspace } from '../../core/services/workspace.service';
import { TeamService, MemberWorkload } from '../../core/services/team.service';

interface WorkspaceTeam {
  workspace: Workspace;
  members: MemberWorkload[];
}

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Team</h1>
          <p class="text-gray-500 dark:text-gray-400 mt-1 text-sm">Team workload across all workspaces</p>
        </div>
      </header>

      <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        @if (loading()) {
          <div class="space-y-8">
            @for (i of [1,2]; track i) {
              <div>
                <div class="skeleton skeleton-text w-40 mb-4"></div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  @for (j of [1,2,3]; track j) {
                    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div class="flex items-center gap-3">
                        <div class="skeleton skeleton-circle w-10 h-10"></div>
                        <div class="space-y-2 flex-1">
                          <div class="skeleton skeleton-text w-24"></div>
                          <div class="skeleton skeleton-text w-16" style="height: 0.625rem"></div>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        } @else if (error()) {
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
            {{ error() }}
          </div>
        } @else if (workspaceTeams().length === 0) {
          <div class="text-center py-16">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">No team data</h3>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Create a workspace and add team members to see workload.
            </p>
          </div>
        } @else {
          @for (wt of workspaceTeams(); track wt.workspace.id) {
            <div class="mb-10">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ wt.workspace.name }}</h2>
                <a [routerLink]="['/workspace', wt.workspace.id, 'team']"
                   class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
                  View details
                </a>
              </div>

              @if (wt.members.length === 0) {
                <p class="text-sm text-gray-500 dark:text-gray-400 py-4">No members in this workspace.</p>
              } @else {
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  @for (member of wt.members; track member.user_id) {
                    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                         [class.border-red-300]="member.is_overloaded"
                         [class.dark:border-red-700]="member.is_overloaded">
                      <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                          {{ getInitials(member.display_name) }}
                        </div>
                        <div class="min-w-0 flex-1">
                          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ member.display_name }}</p>
                          @if (member.is_overloaded) {
                            <span class="text-xs text-red-500 font-medium">Overloaded</span>
                          }
                        </div>
                      </div>
                      <div class="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ member.active_tasks }}</p>
                          <p class="text-xs text-gray-500 dark:text-gray-400">Active</p>
                        </div>
                        <div>
                          <p class="text-lg font-semibold" [class]="member.overdue_tasks > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'">
                            {{ member.overdue_tasks }}
                          </p>
                          <p class="text-xs text-gray-500 dark:text-gray-400">Overdue</p>
                        </div>
                        <div>
                          <p class="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{{ member.done_tasks }}</p>
                          <p class="text-xs text-gray-500 dark:text-gray-400">Done</p>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
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
          this.teamService.getTeamWorkload(ws.id).pipe(
            catchError(() => of([] as MemberWorkload[]))
          )
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
}
