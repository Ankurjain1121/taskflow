import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { forkJoin, of, catchError } from 'rxjs';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';
import {
  PortfolioService,
  PortfolioProject,
  PortfolioResponse,
} from '../../core/services/portfolio.service';
import {
  DashboardService,
  WorkspaceDashboard,
  VelocityPoint,
  DashboardActivityEntry,
} from '../../core/services/dashboard.service';
import { TeamService, MemberWorkload } from '../../core/services/team.service';
import { Workspace } from '../../core/services/workspace.service';
import { OrgHealthHeroComponent } from './org-health-hero.component';
import { OrgProjectGridComponent } from './org-project-grid.component';
import { OrgPeopleVelocityComponent } from './org-people-velocity.component';
import { OrgActivityFeedComponent } from './org-activity-feed.component';

@Component({
  selector: 'app-org-command-center',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    OrgHealthHeroComponent,
    OrgProjectGridComponent,
    OrgPeopleVelocityComponent,
    OrgActivityFeedComponent,
  ],
  template: `
    <div class="min-h-screen" style="background: var(--background)">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 class="text-2xl font-bold" style="color: var(--foreground)">
          Organization Overview
        </h1>

        @if (loading()) {
          <!-- Skeleton -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            @for (i of skeletonItems; track i) {
              <div class="h-24 rounded-xl animate-pulse" style="background: var(--muted)"></div>
            }
          </div>
        } @else if (ctx.workspaces().length === 0) {
          <!-- Empty: no workspaces -->
          <div class="text-center py-16">
            <p style="color: var(--muted-foreground)">
              Create your first workspace to see your organization's health.
            </p>
          </div>
        } @else {
          <!-- Act 1: Hero -->
          <app-org-health-hero
            [score]="healthScore()"
            [label]="healthLabel()"
            [color]="healthColor()"
            [totalProjects]="totalProjects()"
            [onTimePct]="onTimePct()"
            [totalOverdue]="totalOverdue()"
            [totalMembers]="totalMembers()"
          />

          <!-- Act 2: Project Grid -->
          <app-org-project-grid [projectGroups]="allProjects()" />

          <!-- Act 3: People + Velocity (lazy) -->
          @defer (on viewport) {
            <app-org-people-velocity
              [workloads]="allWorkloads()"
              [velocity]="velocityData()"
              [onTimePct]="onTimePct()"
            />
          } @placeholder {
            <div class="h-64 rounded-xl animate-pulse" style="background: var(--muted)"></div>
          }

          <!-- Act 4: Activity Feed (lazy) -->
          @defer (on viewport) {
            <app-org-activity-feed [activities]="activity()" />
          } @placeholder {
            <div class="h-48 rounded-xl animate-pulse" style="background: var(--muted)"></div>
          }
        }
      </div>
    </div>
  `,
})
export class OrgCommandCenterComponent {
  readonly ctx = inject(WorkspaceContextService);
  private readonly portfolioService = inject(PortfolioService);
  private readonly dashboardService = inject(DashboardService);
  private readonly teamService = inject(TeamService);

  readonly skeletonItems = [1, 2, 3, 4];

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly allProjects = signal<{ workspace: Workspace; projects: PortfolioProject[] }[]>([]);
  readonly allWorkloads = signal<MemberWorkload[]>([]);
  readonly velocityData = signal<VelocityPoint[]>([]);
  readonly onTimePct = signal(100);
  readonly activity = signal<DashboardActivityEntry[]>([]);

  readonly healthScore = computed(() => this.computeHealthScore());

  readonly healthLabel = computed(() => {
    const s = this.healthScore();
    if (s >= 80) return 'Healthy';
    if (s >= 60) return 'Needs Attention';
    return 'At Risk';
  });

  readonly healthColor = computed(() => {
    const s = this.healthScore();
    if (s >= 80) return '#5E8C4A';
    if (s >= 60) return '#D4A853';
    return '#B81414';
  });

  readonly totalProjects = computed(() =>
    this.allProjects().reduce((sum, g) => sum + g.projects.length, 0),
  );

  readonly totalOverdue = computed(() =>
    this.allProjects().reduce(
      (sum, g) => sum + g.projects.reduce((s, p) => s + p.overdue_tasks, 0),
      0,
    ),
  );

  readonly totalMembers = computed(() => {
    // Prefer workload data (actual unique members with tasks) over workspace member_count
    // to stay consistent with the health score's workloadBalance calculation
    const workloadMembers = this.allWorkloads().length;
    if (workloadMembers > 0) return workloadMembers;
    // Fallback: sum workspace member counts
    const ws = this.ctx.workspaces();
    return ws.reduce((sum, w) => sum + (w.member_count ?? 0), 0);
  });

  constructor() {
    effect(() => {
      const workspaces = this.ctx.workspaces();
      if (workspaces.length === 0) return;
      this.loadOrgData(workspaces);
    });
  }

  private loadOrgData(workspaces: Workspace[]): void {
    this.loading.set(true);
    this.error.set(null);

    const defaultPortfolio: PortfolioResponse = { projects: [], milestones: [] };
    const defaultDashboard: WorkspaceDashboard = {
      workspace_id: '',
      cycle_time: [],
      velocity: [],
      workload_balance: [],
      on_time: { on_time_pct: 100, total_completed: 0, on_time_count: 0 },
    };

    const portfolioCalls = workspaces.map((ws) =>
      this.portfolioService.getPortfolio(ws.id).pipe(catchError(() => of(defaultPortfolio))),
    );

    const dashboardCalls = workspaces.map((ws) =>
      this.dashboardService
        .getWorkspaceDashboard(ws.id)
        .pipe(catchError(() => of(defaultDashboard))),
    );

    const workloadCalls = workspaces.map((ws) =>
      this.teamService.getTeamWorkload(ws.id).pipe(catchError(() => of([] as MemberWorkload[]))),
    );

    const activityCall = this.dashboardService
      .getRecentActivity(15)
      .pipe(catchError(() => of([] as DashboardActivityEntry[])));

    forkJoin({
      portfolios: forkJoin(portfolioCalls),
      dashboards: forkJoin(dashboardCalls),
      workloads: forkJoin(workloadCalls),
      recentActivity: activityCall,
    }).subscribe({
      next: ({ portfolios, dashboards, workloads, recentActivity }) => {
        // Build project groups
        const projectGroups = workspaces.map((ws, i) => ({
          workspace: ws,
          projects: portfolios[i].projects,
        }));
        this.allProjects.set(projectGroups);

        // Flatten workloads
        this.allWorkloads.set(workloads.flat());

        // Merge velocity data from all workspaces
        const allVelocity = dashboards.flatMap((d) => d.velocity);
        this.velocityData.set(allVelocity);

        // Weighted on-time percentage (guard against missing on_time)
        const totalCompleted = dashboards.reduce(
          (s, d) => s + (d.on_time?.total_completed ?? 0),
          0,
        );
        const weightedOnTime =
          totalCompleted === 0
            ? 100
            : Math.round(
                dashboards.reduce(
                  (s, d) =>
                    s + (d.on_time?.on_time_pct ?? 100) * (d.on_time?.total_completed ?? 0),
                  0,
                ) / totalCompleted,
              );
        this.onTimePct.set(weightedOnTime);

        this.activity.set(recentActivity);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load organization data');
        this.loading.set(false);
      },
    });
  }

  private computeHealthScore(): number {
    const projects = this.allProjects().flatMap((g) => g.projects);
    const totalTasks = projects.reduce((s, p) => s + p.total_tasks, 0);
    const totalOverdue = projects.reduce((s, p) => s + p.overdue_tasks, 0);

    // On-time rate: if no tasks completed, treat as neutral (100%)
    const onTimeRate = this.onTimePct() / 100;
    const overdueRatio = totalTasks === 0 ? 0 : totalOverdue / totalTasks;

    // Workload balance: fraction of members NOT overloaded
    const workloads = this.allWorkloads();
    const overloaded = workloads.filter((m) => m.active_tasks >= 10).length;
    const totalMembers = workloads.length || 1;
    const workloadBalance = 1 - overloaded / totalMembers;

    // Velocity trend: ratio of last vs previous period
    // Neutral (steady or no data) = 1.0 = full marks
    // Declining (0.5) = 0, improving (1.5+) = 1.0
    const vel = this.velocityData();
    let velocityFactor = 1.0; // default: full marks when no data
    if (vel.length >= 2) {
      const last = vel[vel.length - 1]?.tasks_completed ?? 0;
      const prev = vel[vel.length - 2]?.tasks_completed ?? 0;
      if (prev > 0) {
        const ratio = Math.min(1.5, Math.max(0.5, last / prev));
        // Map [0.5, 1.5] → [0, 1] where 1.0 (steady) = 0.5
        // Then bias so steady gets 0.8 (not penalized for maintaining pace)
        velocityFactor = ratio >= 1.0
          ? 0.8 + (ratio - 1.0) * 0.4   // 1.0→0.8, 1.5→1.0
          : (ratio - 0.5) * 1.6;         // 0.5→0.0, 1.0→0.8
      }
    }

    // Weighted score: on-time 40%, overdue 30%, workload 20%, velocity 10%
    const score =
      onTimeRate * 40 + (1 - overdueRatio) * 30 + workloadBalance * 20 + velocityFactor * 10;
    return Math.round(Math.min(100, Math.max(0, score)));
  }
}
