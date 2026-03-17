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
  PortfolioMilestone,
} from '../../core/services/portfolio.service';

@Component({
  selector: 'app-portfolio-dashboard',
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
      .project-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        transition:
          box-shadow 0.2s ease,
          border-color 0.2s ease;
      }
      .project-card:hover {
        border-color: var(--primary);
        box-shadow:
          0 4px 6px -1px rgba(0, 0, 0, 0.07),
          0 2px 4px -2px rgba(0, 0, 0, 0.05);
      }
      .stat-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
      }
      .milestone-row {
        transition: background 0.15s ease;
      }
      .milestone-row:hover {
        background: var(--muted);
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
        <h1 class="text-2xl font-bold tracking-tight" style="color: var(--foreground)">
          Portfolio
        </h1>
        <p class="text-sm mt-1" style="color: var(--muted-foreground)">
          Overview of all projects in this workspace
        </p>
      </div>

      @if (loading()) {
        <!-- Loading skeleton -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="stat-card p-5">
              <p-skeleton width="60%" height="0.75rem" styleClass="mb-2" />
              <p-skeleton width="40%" height="1.75rem" />
            </div>
          }
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (i of [1, 2, 3]; track i) {
            <div class="project-card p-5">
              <p-skeleton width="70%" height="1.25rem" styleClass="mb-3" />
              <p-skeleton width="100%" height="0.5rem" styleClass="mb-4" />
              <p-skeleton width="50%" height="0.75rem" styleClass="mb-2" />
              <p-skeleton width="80%" height="0.75rem" />
            </div>
          }
        </div>
      } @else if (error()) {
        <div
          class="flex flex-col items-center justify-center py-20"
          style="color: var(--muted-foreground)"
        >
          <i class="pi pi-exclamation-triangle text-4xl mb-3" style="color: var(--border)"></i>
          <p class="text-sm">Failed to load portfolio data.</p>
          <button
            (click)="loadData()"
            class="mt-3 text-sm px-4 py-2 rounded-lg"
            style="background: var(--primary); color: white"
          >
            Retry
          </button>
        </div>
      } @else {
        <!-- Stats Row -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div class="stat-card p-5">
            <p class="text-xs font-medium uppercase tracking-wider" style="color: var(--muted-foreground)">
              Projects
            </p>
            <p class="text-2xl font-bold mt-1" style="color: var(--foreground)">
              {{ projects().length }}
            </p>
          </div>
          <div class="stat-card p-5">
            <p class="text-xs font-medium uppercase tracking-wider" style="color: var(--muted-foreground)">
              Active Tasks
            </p>
            <p class="text-2xl font-bold mt-1" style="color: var(--foreground)">
              {{ totalActiveTasks() }}
            </p>
          </div>
          <div class="stat-card p-5">
            <p class="text-xs font-medium uppercase tracking-wider" style="color: var(--muted-foreground)">
              Overdue
            </p>
            <p class="text-2xl font-bold mt-1" [style.color]="totalOverdueTasks() > 0 ? '#ef4444' : 'var(--foreground)'">
              {{ totalOverdueTasks() }}
            </p>
          </div>
          <div class="stat-card p-5">
            <p class="text-xs font-medium uppercase tracking-wider" style="color: var(--muted-foreground)">
              Avg Progress
            </p>
            <p class="text-2xl font-bold mt-1" style="color: var(--foreground)">
              {{ avgProgress() }}%
            </p>
          </div>
        </div>

        <!-- Project Cards Grid -->
        @if (projects().length === 0) {
          <div
            class="flex flex-col items-center justify-center py-16"
            style="color: var(--muted-foreground)"
          >
            <i class="pi pi-folder-open text-5xl mb-3" style="color: var(--border)"></i>
            <p class="text-base font-medium mb-1" style="color: var(--foreground)">No projects yet</p>
            <p class="text-sm">Create a project from the sidebar to get started.</p>
          </div>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            @for (project of projects(); track project.id) {
              <div class="project-card p-5 flex flex-col">
                <!-- Project Header -->
                <div class="flex items-start justify-between gap-3 mb-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div
                      class="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      [style.background]="project.background_color || '#6366f1'"
                    >
                      {{ project.name.charAt(0).toUpperCase() }}
                    </div>
                    <div class="min-w-0">
                      <a
                        [routerLink]="['/workspace', workspaceId, 'project', project.id]"
                        class="text-sm font-semibold hover:underline truncate block"
                        style="color: var(--foreground)"
                      >
                        {{ project.name }}
                      </a>
                      @if (project.prefix) {
                        <span class="text-xs" style="color: var(--muted-foreground)">
                          {{ project.prefix }}
                        </span>
                      }
                    </div>
                  </div>
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0 whitespace-nowrap"
                    [class]="getHealthClasses(project.health)"
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full"
                      [class]="getHealthDotClass(project.health)"
                    ></span>
                    {{ getHealthLabel(project.health) }}
                  </span>
                </div>

                <!-- Description -->
                @if (project.description) {
                  <p
                    class="text-xs mb-3 line-clamp-2"
                    style="color: var(--muted-foreground)"
                  >
                    {{ project.description }}
                  </p>
                }

                <!-- Progress Bar -->
                <div class="mb-3">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-xs font-medium" style="color: var(--muted-foreground)">
                      Progress
                    </span>
                    <span class="text-xs font-semibold" style="color: var(--foreground)">
                      {{ project.progress_pct }}%
                    </span>
                  </div>
                  <div class="progress-bar-track">
                    <div
                      class="progress-bar-fill"
                      [style.width.%]="project.progress_pct"
                      [style.background]="getProgressColor(project.progress_pct)"
                    ></div>
                  </div>
                </div>

                <!-- Stats -->
                <div
                  class="flex items-center gap-4 text-xs mb-3 flex-wrap"
                  style="color: var(--muted-foreground)"
                >
                  <span class="flex items-center gap-1">
                    <i class="pi pi-bolt text-[10px]"></i>
                    {{ project.active_tasks }} active
                  </span>
                  @if (project.overdue_tasks > 0) {
                    <span class="flex items-center gap-1 text-red-500">
                      <i class="pi pi-exclamation-circle text-[10px]"></i>
                      {{ project.overdue_tasks }} overdue
                    </span>
                  }
                  <span class="flex items-center gap-1">
                    <i class="pi pi-users text-[10px]"></i>
                    {{ project.member_count }} members
                  </span>
                </div>

                <!-- Next Milestone -->
                @if (project.next_milestone_name) {
                  <div
                    class="mt-auto pt-3 flex items-center gap-2 text-xs"
                    style="border-top: 1px solid var(--border); color: var(--muted-foreground)"
                  >
                    <i class="pi pi-flag text-[10px]" style="color: var(--primary)"></i>
                    <span class="truncate">{{ project.next_milestone_name }}</span>
                    @if (project.next_milestone_due) {
                      <span class="ml-auto flex-shrink-0">
                        {{ formatDate(project.next_milestone_due) }}
                      </span>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Milestones Timeline Section -->
        @if (milestones().length > 0) {
          <div class="mt-2">
            <h2 class="text-lg font-semibold mb-4" style="color: var(--foreground)">
              Milestones
            </h2>
            <div
              class="rounded-xl overflow-hidden"
              style="background: var(--card); border: 1px solid var(--border)"
            >
              <!-- Table Header -->
              <div
                class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider"
                style="color: var(--muted-foreground); border-bottom: 1px solid var(--border)"
              >
                <div class="col-span-4">Milestone</div>
                <div class="col-span-3">Project</div>
                <div class="col-span-2">Due Date</div>
                <div class="col-span-3">Progress</div>
              </div>
              <!-- Rows -->
              @for (milestone of milestones(); track milestone.id) {
                <div
                  class="milestone-row grid grid-cols-12 gap-4 px-5 py-3 items-center text-sm"
                  style="border-bottom: 1px solid var(--border)"
                  [class.last:border-b-0]="false"
                >
                  <div class="col-span-4 font-medium truncate" style="color: var(--foreground)">
                    {{ milestone.name }}
                  </div>
                  <div class="col-span-3 flex items-center gap-2 min-w-0">
                    <span
                      class="w-2 h-2 rounded-full flex-shrink-0"
                      [style.background]="milestone.project_color || '#6366f1'"
                    ></span>
                    <span class="text-xs truncate" style="color: var(--muted-foreground)">
                      {{ milestone.project_name }}
                    </span>
                  </div>
                  <div class="col-span-2 text-xs" [class]="getMilestoneDateClass(milestone.due_date)">
                    {{ milestone.due_date ? formatDate(milestone.due_date) : 'No date' }}
                  </div>
                  <div class="col-span-3 flex items-center gap-2">
                    <div class="progress-bar-track flex-1">
                      <div
                        class="progress-bar-fill"
                        [style.width.%]="getMilestoneProgress(milestone)"
                        [style.background]="getProgressColor(getMilestoneProgress(milestone))"
                      ></div>
                    </div>
                    <span class="text-xs flex-shrink-0" style="color: var(--muted-foreground)">
                      {{ milestone.completed_tasks }}/{{ milestone.total_tasks }}
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class PortfolioDashboardComponent implements OnInit {
  private readonly portfolioService = inject(PortfolioService);
  private readonly route = inject(ActivatedRoute);

  workspaceId = '';

  loading = signal(true);
  error = signal(false);
  projects = signal<PortfolioProject[]>([]);
  milestones = signal<PortfolioMilestone[]>([]);

  totalActiveTasks = computed(() =>
    this.projects().reduce((sum, p) => sum + p.active_tasks, 0),
  );

  totalOverdueTasks = computed(() =>
    this.projects().reduce((sum, p) => sum + p.overdue_tasks, 0),
  );

  avgProgress = computed(() => {
    const list = this.projects();
    if (list.length === 0) return 0;
    const total = list.reduce((sum, p) => sum + p.progress_pct, 0);
    return Math.round(total / list.length);
  });

  ngOnInit(): void {
    this.workspaceId = this.route.snapshot.paramMap.get('workspaceId') ?? '';
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(false);

    this.portfolioService.getPortfolio(this.workspaceId).subscribe({
      next: ({ projects, milestones }) => {
        this.projects.set(projects);
        const sorted = [...milestones].sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        });
        this.milestones.set(sorted);
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
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'at_risk':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'behind':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
  }

  getHealthDotClass(health: string): string {
    switch (health) {
      case 'on_track':
        return 'bg-emerald-500';
      case 'at_risk':
        return 'bg-amber-500';
      case 'behind':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
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
    if (pct >= 75) return '#22c55e';
    if (pct >= 40) return '#3b82f6';
    if (pct >= 10) return '#f59e0b';
    return '#94a3b8';
  }

  getMilestoneProgress(milestone: PortfolioMilestone): number {
    if (milestone.total_tasks === 0) return 0;
    return Math.round(
      (milestone.completed_tasks / milestone.total_tasks) * 100,
    );
  }

  getMilestoneDateClass(dueDate: string | null): string {
    if (!dueDate) return 'text-[var(--muted-foreground)]';
    const due = new Date(dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (due < now) return 'text-red-500 font-medium';
    return 'text-[var(--muted-foreground)]';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year:
        date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  }
}
