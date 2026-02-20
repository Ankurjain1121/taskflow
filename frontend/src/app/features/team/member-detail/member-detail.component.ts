import {
  Component,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { WorkspaceService } from '../../../core/services/workspace.service';
import {
  TeamService,
  MemberWorkload,
} from '../../../core/services/team.service';
import { WorkspaceMemberInfo } from '../../../shared/types/workspace.types';

@Component({
  selector: 'app-member-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--secondary)]">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Back Link -->
        <a
          [routerLink]="['/workspace', workspaceId, 'team']"
          class="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Team Overview
        </a>

        @if (loading()) {
          <div class="flex items-center justify-center py-16">
            <svg
              class="animate-spin h-8 w-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        } @else if (!member()) {
          <div class="text-center py-16">
            <p class="text-[var(--muted-foreground)]">Member not found</p>
          </div>
        } @else {
          <!-- Profile Header -->
          <div class="widget-card p-6 mb-6">
            <div class="flex items-center gap-6">
              <div
                class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden flex-shrink-0"
              >
                @if (member()?.avatar_url) {
                  <img
                    [src]="member()?.avatar_url"
                    [alt]="member()?.name"
                    class="w-full h-full object-cover"
                  />
                } @else {
                  {{ getInitials(member()?.name || '') }}
                }
              </div>

              <div class="flex-1 min-w-0">
                <h1 class="text-2xl font-bold text-[var(--foreground)]">
                  {{ member()?.name }}
                </h1>
                <p class="text-sm text-[var(--muted-foreground)] mt-1">
                  {{ member()?.email }}
                </p>
                <div class="flex items-center gap-3 mt-3">
                  <span
                    [class]="
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
                      getRoleBadgeClass(member()?.role || 'member')
                    "
                  >
                    {{ getRoleLabel(member()?.role || 'member') }}
                  </span>
                  @if (member()?.joined_at) {
                    <span class="text-xs text-[var(--muted-foreground)]">
                      Joined {{ formatDate(member()!.joined_at) }}
                    </span>
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- Task Stats -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div class="widget-card p-5">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"
                >
                  <svg
                    class="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-2xl font-bold text-[var(--foreground)]">
                    {{ workload()?.active_tasks || 0 }}
                  </p>
                  <p class="text-xs text-[var(--muted-foreground)]">
                    Active Tasks
                  </p>
                </div>
              </div>
            </div>

            <div class="widget-card p-5">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"
                >
                  <svg
                    class="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-2xl font-bold text-[var(--foreground)]">
                    {{ workload()?.done_tasks || 0 }}
                  </p>
                  <p class="text-xs text-[var(--muted-foreground)]">
                    Completed
                  </p>
                </div>
              </div>
            </div>

            <div class="widget-card p-5">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center"
                  [class.bg-red-100]="(workload()?.overdue_tasks || 0) > 0"
                  [class.bg-gray-100]="(workload()?.overdue_tasks || 0) === 0"
                >
                  <svg
                    class="w-5 h-5"
                    [class.text-red-600]="
                      (workload()?.overdue_tasks || 0) > 0
                    "
                    [class.text-gray-400]="
                      (workload()?.overdue_tasks || 0) === 0
                    "
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p
                    class="text-2xl font-bold"
                    [class.text-red-600]="
                      (workload()?.overdue_tasks || 0) > 0
                    "
                    [class.text-[var(--foreground)]]="
                      (workload()?.overdue_tasks || 0) === 0
                    "
                  >
                    {{ workload()?.overdue_tasks || 0 }}
                  </p>
                  <p class="text-xs text-[var(--muted-foreground)]">Overdue</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Activity Feed -->
          <div class="widget-card p-6">
            <h2
              class="text-lg font-semibold text-[var(--foreground)] mb-4"
            >
              Recent Activity
            </h2>
            <div class="text-center py-8">
              <svg
                class="mx-auto h-12 w-12 text-[var(--muted-foreground)] opacity-40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p class="text-sm text-[var(--muted-foreground)] mt-3">
                Activity feed coming soon
              </p>
              <p class="text-xs text-[var(--muted-foreground)] mt-1">
                Track task assignments, completions, and comments
              </p>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class MemberDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private workspaceService = inject(WorkspaceService);
  private teamService = inject(TeamService);

  workspaceId = '';
  userId = '';

  loading = signal(true);
  member = signal<WorkspaceMemberInfo | null>(null);
  workload = signal<MemberWorkload | null>(null);

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.workspaceId = params['workspaceId'];
      this.userId = params['userId'];
      this.loadData();
    });
  }

  getInitials(name: string): string {
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
      viewer: 'bg-orange-100 text-orange-800',
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

  private loadData(): void {
    this.loading.set(true);

    forkJoin({
      members: this.workspaceService.getMembers(this.workspaceId),
      workload: this.teamService
        .getTeamWorkload(this.workspaceId)
        .pipe(catchError(() => of([] as MemberWorkload[]))),
    }).subscribe({
      next: ({ members, workload }) => {
        const foundMember = members.find((m) => m.user_id === this.userId);
        this.member.set(foundMember || null);

        const foundWorkload = workload.find((w) => w.user_id === this.userId);
        this.workload.set(foundWorkload || null);

        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
