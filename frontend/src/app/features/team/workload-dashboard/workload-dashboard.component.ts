import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  TeamService,
  MemberWorkload,
} from '../../../core/services/team.service';

@Component({
  selector: 'app-workload-dashboard',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <div class="space-y-4">
          @for (i of [1, 2, 3]; track i) {
            <div
              class="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4"
            >
              <div class="flex items-center gap-4">
                <div class="skeleton skeleton-circle w-10 h-10"></div>
                <div class="flex-1 space-y-2">
                  <div class="skeleton skeleton-text w-32"></div>
                  <div class="skeleton w-full h-6 rounded"></div>
                </div>
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
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="widget-card p-5">
            <p class="text-2xl font-bold text-[var(--foreground)]">
              {{ totalActiveTasks() }}
            </p>
            <p class="text-xs text-[var(--muted-foreground)]">
              Total Active Tasks
            </p>
          </div>
          <div class="widget-card p-5">
            <p class="text-2xl font-bold text-[var(--foreground)]">
              {{ avgTasksPerMember() }}
            </p>
            <p class="text-xs text-[var(--muted-foreground)]">Avg per Member</p>
          </div>
          <div class="widget-card p-5">
            <p
              class="text-2xl font-bold"
              [class.text-red-600]="overloadedCount() > 0"
              [class.text-[var(--foreground)]]="overloadedCount() === 0"
            >
              {{ overloadedCount() }}
            </p>
            <p class="text-xs text-[var(--muted-foreground)]">
              Overloaded Members
            </p>
          </div>
        </div>

        <!-- Productivity Metrics -->
        <div class="widget-card p-5">
          <h3 class="text-sm font-medium text-[var(--foreground)] mb-3">
            Productivity
          </h3>
          <div class="flex items-center gap-6">
            <div>
              <p class="text-lg font-semibold text-[var(--foreground)]">
                {{ completionRate() }}%
              </p>
              <p class="text-xs text-[var(--muted-foreground)]">
                Completion Rate
              </p>
            </div>
            <div class="flex-1">
              <div class="w-full bg-[var(--secondary)] rounded-full h-2.5">
                <div
                  class="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                  [style.width.%]="completionRate()"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Workload Bars -->
        <div class="widget-card">
          <div class="px-6 py-4 border-b border-[var(--border)]">
            <h3 class="text-sm font-medium text-[var(--foreground)]">
              Task Distribution
            </h3>
          </div>

          @if (members().length === 0) {
            <div
              class="px-6 py-8 text-center text-[var(--muted-foreground)] text-sm"
            >
              No team members to display
            </div>
          } @else {
            <div class="divide-y divide-[var(--border)]">
              @for (member of sortedMembers(); track member.user_id) {
                <div class="px-6 py-4">
                  <div class="flex items-center gap-4 mb-2">
                    <!-- Avatar -->
                    <div
                      class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0 overflow-hidden"
                    >
                      @if (member.user_avatar) {
                        <img
                          [src]="member.user_avatar"
                          [alt]="member.user_name"
                          class="w-full h-full object-cover"
                        />
                      } @else {
                        {{ getInitials(member.user_name) }}
                      }
                    </div>

                    <!-- Name & Stats -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span
                          class="text-sm font-medium text-[var(--foreground)] truncate"
                        >
                          {{ member.user_name }}
                        </span>
                        <span
                          class="text-xs text-[var(--muted-foreground)] ml-2"
                        >
                          {{ member.active_tasks }} active
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Bar -->
                  <div class="ml-12">
                    <div
                      class="w-full bg-[var(--secondary)] rounded-full h-5 overflow-hidden"
                    >
                      <div
                        class="h-5 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                        [style.width.%]="getBarWidth(member.active_tasks)"
                        [class.bg-green-500]="member.active_tasks < 5"
                        [class.bg-yellow-500]="
                          member.active_tasks >= 5 && member.active_tasks <= 10
                        "
                        [class.bg-red-500]="member.active_tasks > 10"
                      >
                        @if (getBarWidth(member.active_tasks) > 10) {
                          <span class="text-xs text-white font-medium">
                            {{ member.active_tasks }}
                          </span>
                        }
                      </div>
                    </div>
                    <div class="flex items-center gap-3 mt-1.5">
                      <span class="text-xs text-[var(--muted-foreground)]">
                        {{ member.done_tasks }} done
                      </span>
                      @if (member.overdue_tasks > 0) {
                        <span class="text-xs text-red-500 font-medium">
                          {{ member.overdue_tasks }} overdue
                        </span>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>

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
      }
    </div>
  `,
})
export class WorkloadDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private teamService = inject(TeamService);

  private params = toSignal(this.route.params);
  private readonly workspaceId = computed(() => this.params()?.['workspaceId'] as string | undefined);

  loading = signal(true);
  error = signal<string | null>(null);
  members = signal<MemberWorkload[]>([]);

  sortedMembers = computed(() =>
    [...this.members()].sort((a, b) => b.active_tasks - a.active_tasks),
  );

  totalActiveTasks = computed(() =>
    this.members().reduce((sum, m) => sum + m.active_tasks, 0),
  );

  avgTasksPerMember = computed(() => {
    const count = this.members().length;
    if (count === 0) return 0;
    return Math.round(this.totalActiveTasks() / count);
  });

  overloadedCount = computed(
    () => this.members().filter((m) => m.is_overloaded).length,
  );

  completionRate = computed(() => {
    const total = this.members().reduce((sum, m) => sum + m.total_tasks, 0);
    const done = this.members().reduce((sum, m) => sum + m.done_tasks, 0);
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  });

  private maxTasks = computed(() => {
    const max = Math.max(...this.members().map((m) => m.active_tasks), 1);
    return Math.max(max, 10);
  });

  constructor() {
    effect(() => {
      const wsId = this.workspaceId();
      if (wsId) {
        this.loadWorkload(wsId);
      }
    });
  }

  ngOnInit(): void {
    // Workload loading is handled by the effect reacting to workspaceId changes
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

  getBarWidth(activeTasks: number): number {
    return Math.max((activeTasks / this.maxTasks()) * 100, 2);
  }

  private loadWorkload(workspaceId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.teamService.getTeamWorkload(workspaceId).subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load workload data. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
