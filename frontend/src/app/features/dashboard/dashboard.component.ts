import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { DashboardService, DashboardStats, DashboardActivityEntry } from '../../core/services/dashboard.service';
import { TasksByStatusComponent } from './widgets/tasks-by-status.component';
import { TasksByPriorityComponent } from './widgets/tasks-by-priority.component';
import { OverdueTasksTableComponent } from './widgets/overdue-tasks-table.component';
import { CompletionTrendComponent } from './widgets/completion-trend.component';
import { UpcomingDeadlinesComponent } from './widgets/upcoming-deadlines.component';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  boards?: { id: string; name: string }[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TasksByStatusComponent,
    TasksByPriorityComponent,
    OverdueTasksTableComponent,
    CompletionTrendComponent,
    UpcomingDeadlinesComponent
  ],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <!-- Header -->
      <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div class="flex items-center justify-between">
            <div class="animate-fade-in-up">
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                {{ getGreeting() }}{{ userName() ? ', ' + userName() : '' }}
              </h1>
              <p class="text-gray-500 dark:text-gray-400 mt-1">Here's what's happening across your projects</p>
            </div>
            <a routerLink="/my-tasks"
               class="animate-fade-in-up stagger-2 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-indigo-900/30 font-medium text-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
              </svg>
              My Tasks
            </a>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        @if (loading()) {
          <!-- Skeleton Loading -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            @for (i of [1,2,3,4]; track i) {
              <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div class="flex items-center justify-between">
                  <div class="space-y-3 flex-1">
                    <div class="skeleton skeleton-text w-20"></div>
                    <div class="skeleton skeleton-heading w-16"></div>
                  </div>
                  <div class="skeleton skeleton-circle w-12 h-12"></div>
                </div>
              </div>
            }
          </div>
          <div class="space-y-4">
            <div class="skeleton skeleton-text w-32"></div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              @for (i of [1,2,3]; track i) {
                <div class="skeleton skeleton-card"></div>
              }
            </div>
          </div>
        } @else {
          <!-- Stats Cards with stagger -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <!-- Total Tasks -->
            <div class="animate-fade-in-up stagger-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tasks</p>
                  <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1 tracking-tight">{{ stats()?.total_tasks || 0 }}</p>
                </div>
                <div class="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                  <svg class="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Overdue -->
            <div class="animate-fade-in-up stagger-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Overdue</p>
                  <p class="text-3xl font-bold mt-1 tracking-tight" [class]="(stats()?.overdue || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'">{{ stats()?.overdue || 0 }}</p>
                </div>
                <div class="w-12 h-12 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                  <svg class="w-6 h-6 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Due Today -->
            <div class="animate-fade-in-up stagger-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Due Today</p>
                  <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1 tracking-tight">{{ stats()?.due_today || 0 }}</p>
                </div>
                <div class="w-12 h-12 bg-orange-50 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                  <svg class="w-6 h-6 text-orange-500 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Completed This Week -->
            <div class="animate-fade-in-up stagger-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Completed This Week</p>
                  <p class="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">{{ stats()?.completed_this_week || 0 }}</p>
                </div>
                <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                  <svg class="w-6 h-6 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Activity -->
          @if (recentActivity().length > 0) {
            <div class="animate-fade-in-up stagger-5 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
              </div>
              <div class="divide-y divide-gray-100 dark:divide-gray-700">
                @for (activity of recentActivity(); track activity.id; let i = $index) {
                  <div class="px-6 py-4 flex items-start gap-3 animate-fade-in-up"
                       [style.animation-delay]="(i * 0.04) + 's'">
                    <!-- Avatar -->
                    <div class="flex-shrink-0">
                      @if (activity.actor_avatar_url) {
                        <img [src]="activity.actor_avatar_url" [alt]="activity.actor_name"
                             class="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-gray-800">
                      } @else {
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                          <span class="text-xs font-medium text-white">{{ activity.actor_name.charAt(0).toUpperCase() }}</span>
                        </div>
                      }
                    </div>
                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-gray-900 dark:text-white">
                        <span class="font-medium">{{ activity.actor_name }}</span>
                        <span class="text-gray-500 dark:text-gray-400"> {{ formatAction(activity.action) }} </span>
                        <span class="text-gray-500 dark:text-gray-400">a {{ activity.entity_type }}</span>
                        @if (activity.metadata && activity.metadata['task_title']) {
                          <span class="text-gray-500 dark:text-gray-400"> &middot; </span>
                          <span class="font-medium text-indigo-600 dark:text-indigo-400">{{ activity.metadata['task_title'] }}</span>
                        }
                      </p>
                      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ formatRelativeTime(activity.created_at) }}</p>
                    </div>
                    <!-- Action badge -->
                    <div class="flex-shrink-0">
                      <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium"
                            [class]="getActionBadgeClass(activity.action)">
                        {{ activity.action }}
                      </span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Analytics & Insights Section -->
          <div class="animate-fade-in-up stagger-6 mb-8">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Analytics & Insights</h2>
            </div>

            <!-- Analytics Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Row 1: Tasks by Status & Tasks by Priority -->
              <app-tasks-by-status class="h-[400px]"></app-tasks-by-status>
              <app-tasks-by-priority class="h-[400px]"></app-tasks-by-priority>

              <!-- Row 2: Completion Trend & Upcoming Deadlines -->
              <app-completion-trend class="h-[400px]"></app-completion-trend>
              <app-upcoming-deadlines class="h-[400px]"></app-upcoming-deadlines>

              <!-- Row 3: Overdue Tasks (Full Width) -->
              <div class="lg:col-span-2">
                <app-overdue-tasks-table class="h-[400px]"></app-overdue-tasks-table>
              </div>
            </div>
          </div>

          <!-- Workspaces Section -->
          @if (workspaces().length === 0) {
            <!-- Beautiful Empty State -->
            <div class="animate-fade-in-up text-center py-16">
              <div class="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-orange-100 via-amber-50 to-indigo-100 dark:from-orange-900/30 dark:via-amber-900/20 dark:to-indigo-900/30 flex items-center justify-center mb-6">
                <svg class="w-12 h-12 text-orange-500 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"/>
                </svg>
              </div>
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Your workspace awaits</h3>
              <p class="text-gray-500 dark:text-gray-400 mb-1 max-w-sm mx-auto">
                Create your first workspace and start organizing your projects.
              </p>
              <p class="text-sm text-gray-400 dark:text-gray-500 mb-8">It only takes a few seconds to get going.</p>
              <a routerLink="/onboarding"
                 class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all hover:shadow-xl font-medium">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Create Workspace
              </a>
            </div>
          } @else {
            <!-- Workspaces Header -->
            <div class="animate-fade-in-up stagger-6 mb-4 flex items-center justify-between">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Your Workspaces</h2>
              <span class="text-sm text-gray-400">{{ workspaces().length }} workspace{{ workspaces().length !== 1 ? 's' : '' }}</span>
            </div>

            <!-- Workspaces Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              @for (workspace of workspaces(); track workspace.id; let i = $index) {
                <div class="animate-fade-in-up bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
                     [style.animation-delay]="(0.3 + i * 0.08) + 's'">
                  <div class="p-6">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{{ workspace.name }}</h3>
                        @if (workspace.description) {
                          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{{ workspace.description }}</p>
                        }
                      </div>
                      <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm">
                        <span class="text-white font-bold text-sm">{{ workspace.name.charAt(0).toUpperCase() }}</span>
                      </div>
                    </div>

                    @if (workspace.boards && workspace.boards.length > 0) {
                      <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Boards</p>
                        <div class="space-y-2">
                          @for (board of workspace.boards.slice(0, 3); track board.id) {
                            <a [routerLink]="['/workspace', workspace.id, 'board', board.id]"
                               class="flex items-center text-sm text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                              <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
                              </svg>
                              {{ board.name }}
                            </a>
                          }
                          @if (workspace.boards.length > 3) {
                            <p class="text-xs text-gray-400">+{{ workspace.boards.length - 3 }} more</p>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <div class="px-6 py-3 bg-gray-50/80 dark:bg-gray-750 border-t border-gray-100 dark:border-gray-700 group-hover:bg-indigo-50/50 dark:group-hover:bg-indigo-950/20 transition-colors">
                    <a [routerLink]="['/workspace', workspace.id]"
                       class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium inline-flex items-center gap-1">
                      Open Workspace
                      <svg class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                      </svg>
                    </a>
                  </div>
                </div>
              }
            </div>
          }
        }
      </main>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);
  private dashboardService = inject(DashboardService);

  workspaces = signal<Workspace[]>([]);
  loading = signal(true);
  userName = signal<string | null>(null);
  stats = signal<DashboardStats | null>(null);
  recentActivity = signal<DashboardActivityEntry[]>([]);

  ngOnInit(): void {
    // Check if user is authenticated
    const user = this.authService.currentUser();
    if (!user) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }

    this.userName.set(user.display_name?.split(' ')[0] || null);
    this.loadWorkspaces();
    this.loadStats();
    this.loadRecentActivity();
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  formatAction(action: string): string {
    const actionMap: Record<string, string> = {
      created: 'created',
      updated: 'updated',
      moved: 'moved',
      assigned: 'assigned',
      unassigned: 'unassigned',
      commented: 'commented on',
      attached: 'attached a file to',
      status_changed: 'changed status of',
      priority_changed: 'changed priority of',
      deleted: 'deleted',
    };
    return actionMap[action] || action;
  }

  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  getActionBadgeClass(action: string): string {
    const baseClass = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
    switch (action) {
      case 'created':
        return `${baseClass} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`;
      case 'deleted':
        return `${baseClass} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400`;
      case 'moved':
      case 'status_changed':
        return `${baseClass} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400`;
      case 'commented':
        return `${baseClass} bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400`;
      case 'assigned':
      case 'unassigned':
        return `${baseClass} bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400`;
      default:
        return `${baseClass} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300`;
    }
  }

  private loadWorkspaces(): void {
    this.workspaceService.list().subscribe({
      next: (workspaces) => {
        // Map to local interface (service Workspace may have different fields)
        this.workspaces.set(workspaces.map(w => ({
          id: w.id,
          name: w.name,
          description: undefined,
          boards: undefined,
        })));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadStats(): void {
    this.dashboardService.getStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
      },
      error: () => {
        // Stats loading failed silently - cards will show 0
      },
    });
  }

  private loadRecentActivity(): void {
    this.dashboardService.getRecentActivity(10).subscribe({
      next: (activity) => {
        this.recentActivity.set(activity);
      },
      error: () => {
        // Activity loading failed silently - section won't show
      },
    });
  }
}
