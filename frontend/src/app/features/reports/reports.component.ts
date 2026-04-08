import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import {
  PortfolioService,
  PortfolioProject,
} from '../../core/services/portfolio.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterLink, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .progress-bar-track {
        background: var(--muted);
        border-radius: 9999px;
        height: 6px;
        overflow: hidden;
      }
      .progress-bar-fill {
        height: 100%;
        border-radius: 9999px;
        transition: width 0.4s ease;
      }
      .hero-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
      }
      .score-arc {
        width: 120px;
        height: 120px;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .score-arc::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        border: 6px solid var(--muted);
      }
      .score-arc::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        border: 6px solid transparent;
        border-top-color: var(--score-color);
        border-right-color: var(--score-color);
        transform: rotate(var(--score-rotation));
        transition: transform 0.6s ease;
      }
      .project-table {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        overflow: hidden;
      }
      .project-row {
        transition: background 0.15s ease;
      }
      .project-row:hover {
        background: var(--muted);
      }
      .project-row:last-child {
        border-bottom: none;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.625rem;
        font-size: 0.75rem;
        font-weight: 500;
        border-radius: 9999px;
        white-space: nowrap;
      }
    `,
  ],
  template: `
    <div
      class="min-h-screen p-6 md:p-8 max-w-7xl mx-auto"
      style="color: var(--foreground)"
    >
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-display font-bold tracking-tight" style="color: var(--foreground)">
          Reports
        </h1>
        <p class="text-sm mt-1" style="color: var(--muted-foreground)">
          Your workspace at a glance
        </p>
      </div>

      @if (loading()) {
        <!-- Loading skeleton -->
        <div class="hero-card p-6 mb-8">
          <div class="flex items-center gap-8">
            <p-skeleton shape="circle" size="120px" />
            <div class="flex-1 grid grid-cols-3 gap-6">
              @for (i of [1, 2, 3]; track i) {
                <div>
                  <p-skeleton width="60%" height="0.75rem" styleClass="mb-2" />
                  <p-skeleton width="40%" height="1.75rem" />
                </div>
              }
            </div>
          </div>
        </div>
        <div class="project-table">
          <div class="px-5 py-3" style="border-bottom: 1px solid var(--border)">
            <p-skeleton width="100%" height="0.75rem" />
          </div>
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="px-5 py-4" style="border-bottom: 1px solid var(--border)">
              <p-skeleton width="100%" height="1rem" />
            </div>
          }
        </div>
      } @else if (error()) {
        <!-- Error state -->
        <div
          class="flex flex-col items-center justify-center py-20"
          style="color: var(--muted-foreground)"
        >
          <i class="pi pi-exclamation-triangle text-4xl mb-3" style="color: var(--border)"></i>
          <p class="text-sm">Failed to load reports data.</p>
          <button
            (click)="loadData()"
            class="mt-3 text-sm px-4 py-2 rounded-lg"
            style="background: var(--primary); color: var(--primary-foreground)"
          >
            Retry
          </button>
        </div>
      } @else if (projects().length === 0) {
        <!-- Empty state -->
        <div class="flex flex-col items-center justify-center py-20 max-w-md mx-auto text-center">
          <i class="pi pi-chart-bar text-5xl mb-4" style="color: var(--border)"></i>
          <h2 class="text-lg font-semibold mb-2" style="color: var(--foreground)">
            Your workspace at a glance
          </h2>
          <p class="text-sm mb-6" style="color: var(--muted-foreground)">
            Create a project and start tracking tasks to see reports here.
          </p>
          <p class="text-sm font-medium" style="color: var(--primary)">
            Create a project from the sidebar
          </p>
        </div>
      } @else {
        <!-- Hero card: Workspace Health Score -->
        <div class="hero-card p-6 mb-8">
          <div class="flex flex-col sm:flex-row items-center gap-8">
            <!-- Score circle -->
            <div class="flex flex-col items-center gap-2">
              <div
                class="score-arc"
                [style.--score-color]="scoreColor()"
                [style.--score-rotation]="scoreRotation()"
              >
                <div class="flex flex-col items-center z-10">
                  <span
                    class="text-3xl font-bold"
                    [style.color]="scoreColor()"
                  >
                    {{ healthScore() }}
                  </span>
                  <span class="text-[10px] uppercase tracking-wider font-medium" style="color: var(--muted-foreground)">
                    Health
                  </span>
                </div>
              </div>
            </div>

            <!-- Right side stats -->
            <div class="flex-1 grid grid-cols-3 gap-6">
              <div>
                <p class="text-xs font-medium uppercase tracking-wider" style="color: var(--muted-foreground)">
                  Projects
                </p>
                <p class="text-2xl font-bold mt-1" style="color: var(--foreground)">
                  {{ projects().length }}
                </p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase tracking-wider" style="color: var(--muted-foreground)">
                  Active Tasks
                </p>
                <p class="text-2xl font-bold mt-1" style="color: var(--foreground)">
                  {{ totalActiveTasks() }}
                </p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase tracking-wider" style="color: var(--muted-foreground)">
                  Overdue
                </p>
                <p
                  class="text-2xl font-bold mt-1"
                  [style.color]="totalOverdueTasks() > 0 ? '#ef4444' : 'var(--foreground)'"
                >
                  {{ totalOverdueTasks() }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Project Rows Table -->
        <div class="project-table">
          <!-- Table header -->
          <div
            class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider"
            style="color: var(--muted-foreground); border-bottom: 1px solid var(--border)"
          >
            <div class="col-span-4">Project</div>
            <div class="col-span-3">Progress</div>
            <div class="col-span-2">Tasks</div>
            <div class="col-span-3">Status</div>
          </div>
          <!-- Rows -->
          @for (project of projects(); track project.id) {
            <div
              class="project-row grid grid-cols-12 gap-4 px-5 py-3.5 items-center text-sm"
              style="border-bottom: 1px solid var(--border)"
            >
              <!-- Project name -->
              <div class="col-span-4 font-medium truncate" style="color: var(--foreground)">
                {{ project.name }}
              </div>

              <!-- Progress bar + percentage -->
              <div class="col-span-3 flex items-center gap-2">
                <div class="progress-bar-track flex-1">
                  <div
                    class="progress-bar-fill"
                    [style.width.%]="project.progress_pct"
                    [style.background]="getProgressColor(project.progress_pct)"
                  ></div>
                </div>
                <span class="text-xs font-medium flex-shrink-0" style="color: var(--muted-foreground)">
                  {{ project.progress_pct }}%
                </span>
              </div>

              <!-- Task count + overdue -->
              <div class="col-span-2 text-xs" style="color: var(--muted-foreground)">
                <span>{{ project.total_tasks }} tasks</span>
                @if (project.overdue_tasks > 0) {
                  <span class="text-[var(--destructive)] ml-1">
                    ({{ project.overdue_tasks }} overdue)
                  </span>
                }
              </div>

              <!-- Status pill -->
              <div class="col-span-3">
                <span
                  class="status-pill"
                  [class]="getHealthClasses(project.health)"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full"
                    [class]="getHealthDotClass(project.health)"
                  ></span>
                  {{ getHealthLabel(project.health) }}
                </span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ReportsComponent implements OnInit {
  private readonly portfolioService = inject(PortfolioService);
  private readonly route = inject(ActivatedRoute);

  workspaceId = '';

  loading = signal(true);
  error = signal(false);
  projects = signal<PortfolioProject[]>([]);

  totalActiveTasks = computed(() =>
    this.projects().reduce((sum, p) => sum + p.active_tasks, 0),
  );

  totalOverdueTasks = computed(() =>
    this.projects().reduce((sum, p) => sum + p.overdue_tasks, 0),
  );

  totalTasks = computed(() =>
    this.projects().reduce((sum, p) => sum + p.total_tasks, 0),
  );

  completedTasks = computed(() =>
    this.projects().reduce((sum, p) => sum + p.completed_tasks, 0),
  );

  healthScore = computed(() => {
    const total = this.totalTasks();
    if (total === 0) return 0;
    return Math.round((this.completedTasks() / total) * 100);
  });

  scoreColor = computed(() => {
    const score = this.healthScore();
    if (score >= 70) return 'var(--success)';
    if (score >= 40) return 'var(--warning)';
    return 'var(--destructive)';
  });

  scoreRotation = computed(() => {
    const score = this.healthScore();
    const degrees = (score / 100) * 360;
    return `${degrees}deg`;
  });

  ngOnInit(): void {
    this.workspaceId = this.route.snapshot.paramMap.get('workspaceId') ?? '';
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(false);

    this.portfolioService.getPortfolio(this.workspaceId).subscribe({
      next: ({ projects }) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  getHealthClasses(health: string): string {
    switch (health) {
      case 'on_track':
        return 'bg-[var(--status-green-bg)] text-[var(--status-green-text)]';
      case 'at_risk':
        return 'bg-[var(--status-amber-bg)] text-[var(--status-amber-text)]';
      case 'behind':
        return 'bg-[var(--status-red-bg)] text-[var(--status-red-text)]';
      default:
        return 'bg-[var(--muted)] text-[var(--muted-foreground)]';
    }
  }

  getHealthDotClass(health: string): string {
    switch (health) {
      case 'on_track':
        return 'bg-emerald-500';
      case 'at_risk':
        return 'bg-amber-500';
      case 'behind':
        return 'bg-[var(--destructive)]';
      default:
        return 'bg-[var(--muted-foreground)]';
    }
  }

  getHealthLabel(health: string): string {
    switch (health) {
      case 'on_track':
        return 'On Track';
      case 'at_risk':
        return 'At Risk';
      case 'behind':
        return 'Behind';
      default:
        return health;
    }
  }

  getProgressColor(pct: number): string {
    if (pct >= 75) return 'var(--success)';
    if (pct >= 40) return 'var(--info)';
    if (pct >= 10) return 'var(--warning)';
    return 'var(--muted-foreground)';
  }
}
