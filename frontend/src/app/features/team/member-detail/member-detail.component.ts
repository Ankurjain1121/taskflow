import {
  Component,
  computed,
  signal,
  inject,
  OnInit,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { WorkspaceService } from '../../../core/services/workspace.service';
import {
  TeamService,
  MemberWorkload,
  MemberTask,
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
                <h1 class="font-display text-2xl font-bold text-[var(--foreground)]">
                  {{ member()?.name }}
                </h1>
                <p class="text-sm text-[var(--muted-foreground)] mt-1">
                  {{ member()?.email }}
                </p>
                @if (member()?.job_title || member()?.department) {
                  <div
                    class="flex items-center gap-2 mt-2 text-sm text-[var(--foreground)]"
                  >
                    @if (member()?.job_title) {
                      <span>{{ member()?.job_title }}</span>
                    }
                    @if (member()?.job_title && member()?.department) {
                      <span class="text-[var(--muted-foreground)]"
                        >&middot;</span
                      >
                    }
                    @if (member()?.department) {
                      <span class="text-[var(--muted-foreground)]">{{
                        member()?.department
                      }}</span>
                    }
                  </div>
                }
                <div class="flex items-center gap-3 mt-3">
                  <span
                    [class]="
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ' +
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
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
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
                  <p class="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
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
                  <p class="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
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
                  [class.bg-[var(--muted)]]="(workload()?.overdue_tasks || 0) === 0"
                >
                  <svg
                    class="w-5 h-5"
                    [class.text-red-600]="(workload()?.overdue_tasks || 0) > 0"
                    [class.text-[var(--muted-foreground)]]="
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
                    [class.text-red-600]="(workload()?.overdue_tasks || 0) > 0"
                    [class.text-[var(--foreground)]]="
                      (workload()?.overdue_tasks || 0) === 0
                    "
                  >
                    {{ workload()?.overdue_tasks || 0 }}
                  </p>
                  <p class="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Overdue</p>
                </div>
              </div>
            </div>

            <div class="widget-card p-5">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center"
                  [class.bg-amber-100]="(workload()?.due_today || 0) > 0"
                  [class.bg-[var(--muted)]]="(workload()?.due_today || 0) === 0"
                >
                  <svg
                    class="w-5 h-5"
                    [class.text-amber-600]="(workload()?.due_today || 0) > 0"
                    [class.text-[var(--muted-foreground)]]="(workload()?.due_today || 0) === 0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p
                    class="text-2xl font-bold"
                    [class.text-amber-600]="(workload()?.due_today || 0) > 0"
                    [class.text-[var(--foreground)]]="
                      (workload()?.due_today || 0) === 0
                    "
                  >
                    {{ workload()?.due_today || 0 }}
                  </p>
                  <p class="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Due Today
                  </p>
                </div>
              </div>
            </div>

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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-2xl font-bold text-blue-600">
                    {{ workload()?.due_this_week || 0 }}
                  </p>
                  <p class="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Due This Week
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Task List -->
          <div class="widget-card mb-6">
            <div class="px-6 py-4 border-b border-[var(--border)]">
              <h2 class="text-lg font-semibold text-[var(--foreground)]">
                Assigned Tasks
              </h2>
            </div>
            @if (tasksLoading()) {
              <div class="px-6 py-8 text-center">
                <p class="text-sm text-[var(--muted-foreground)] animate-pulse">
                  Loading tasks...
                </p>
              </div>
            } @else if (tasks().length === 0) {
              <div class="px-6 py-8 text-center">
                <p class="text-sm text-[var(--muted-foreground)]">
                  No tasks assigned to this member.
                </p>
              </div>
            } @else {
              @for (group of taskGroups(); track group.status) {
                <div>
                  <div
                    class="px-6 py-2 bg-[var(--secondary)] flex items-center justify-between"
                  >
                    <h3
                      class="text-sm font-semibold"
                      [class]="group.colorClass"
                    >
                      {{ group.label }}
                    </h3>
                    <span class="text-xs text-[var(--muted-foreground)]">
                      {{ group.tasks.length }}
                      {{ group.tasks.length === 1 ? 'task' : 'tasks' }}
                    </span>
                  </div>
                  <div class="divide-y divide-[var(--border)]">
                    @for (task of group.tasks; track task.task_id) {
                      <div class="px-6 py-3 flex items-center gap-3">
                        <span
                          class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          [class.bg-red-500]="
                            task.priority === 'urgent' ||
                            task.priority === 'critical'
                          "
                          [class.bg-orange-500]="task.priority === 'high'"
                          [class.bg-yellow-500]="task.priority === 'medium'"
                          [class.bg-blue-400]="task.priority === 'low'"
                          [class.bg-[var(--muted)]]="
                            task.priority === 'none' || !task.priority
                          "
                          [title]="task.priority || 'none'"
                        ></span>
                        <div class="flex-1 min-w-0">
                          <p
                            class="text-sm font-medium text-[var(--foreground)] truncate"
                          >
                            {{ task.title }}
                          </p>
                          <p
                            class="text-xs text-[var(--muted-foreground)] truncate"
                          >
                            {{ task.board_name }} &middot;
                            {{ task.column_name }}
                          </p>
                        </div>
                        @if (task.due_date) {
                          <span
                            class="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                            [class.bg-red-100]="isOverdue(task.due_date)"
                            [class.text-red-700]="isOverdue(task.due_date)"
                            [class.bg-[var(--secondary)]]="
                              !isOverdue(task.due_date)
                            "
                            [class.text-[var(--muted-foreground)]]="
                              !isOverdue(task.due_date)
                            "
                          >
                            {{ formatDate(task.due_date) }}
                          </span>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            }
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

  private params = toSignal(this.route.params);
  workspaceId = '';
  userId = '';

  loading = signal(true);
  member = signal<WorkspaceMemberInfo | null>(null);
  workload = signal<MemberWorkload | null>(null);
  tasks = signal<MemberTask[]>([]);
  tasksLoading = signal(false);

  taskGroups = computed(() => {
    const allTasks = this.tasks();
    const groups: {
      label: string;
      status: string;
      tasks: MemberTask[];
      colorClass: string;
    }[] = [
      {
        label: 'Overdue',
        status: 'overdue',
        tasks: [],
        colorClass: 'text-red-600',
      },
      {
        label: 'Due Today',
        status: 'due_today',
        tasks: [],
        colorClass: 'text-amber-600',
      },
      {
        label: 'Due This Week',
        status: 'due_this_week',
        tasks: [],
        colorClass: 'text-blue-600',
      },
      {
        label: 'Upcoming',
        status: 'upcoming',
        tasks: [],
        colorClass: 'text-[var(--foreground)]',
      },
      {
        label: 'No Due Date',
        status: 'no_due_date',
        tasks: [],
        colorClass: 'text-[var(--muted-foreground)]',
      },
    ];
    for (const task of allTasks) {
      const group = groups.find((g) => g.status === task.due_status);
      if (group) {
        group.tasks.push(task);
      }
    }
    return groups.filter((g) => g.tasks.length > 0);
  });

  constructor() {
    effect(() => {
      const p = this.params();
      if (p) {
        this.workspaceId = p['workspaceId'];
        this.userId = p['userId'];
        this.loadData();
      }
    });
  }

  ngOnInit(): void {
    // Data loading is handled by the effect reacting to route param changes
  }

  getInitials(name: string): string {
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
      viewer: 'Viewer',
    };
    return labels[role] || role;
  }

  getRoleBadgeClass(role: string): string {
    const classes: Record<string, string> = {
      owner: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      manager: 'bg-primary/10 text-primary',
      member: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
      viewer: 'bg-orange-100 text-orange-800',
    };
    return classes[role] || 'bg-[var(--muted)] text-[var(--muted-foreground)]';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  isOverdue(dateString: string): boolean {
    return new Date(dateString) < new Date();
  }

  private loadData(): void {
    this.loading.set(true);
    this.tasksLoading.set(true);

    forkJoin({
      wsDetail: this.workspaceService.get(this.workspaceId),
      workload: this.teamService
        .getTeamWorkload(this.workspaceId)
        .pipe(catchError(() => of([] as MemberWorkload[]))),
    }).subscribe({
      next: ({ wsDetail, workload }) => {
        // Members are embedded in the workspace detail response
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
        const match = embedded.find((m) => m.user_id === this.userId);
        if (match) {
          this.member.set({
            ...match,
            role: match.role.toLowerCase() as WorkspaceMemberInfo['role'],
            is_org_admin: false,
          });
        }

        const foundWorkload = workload.find((w) => w.user_id === this.userId);
        this.workload.set(foundWorkload || null);

        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });

    this.teamService
      .getMemberTasks(this.workspaceId, this.userId)
      .pipe(catchError(() => of([] as MemberTask[])))
      .subscribe({
        next: (tasks) => {
          this.tasks.set(tasks);
          this.tasksLoading.set(false);
        },
        error: () => {
          this.tasksLoading.set(false);
        },
      });
  }
}
