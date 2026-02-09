import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { DashboardService, DashboardStats, DashboardActivityEntry } from '../../core/services/dashboard.service';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  boards?: { id: string; name: string }[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <!-- Header -->
      <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome back{{ userName() ? ', ' + userName() : '' }}!
              </h1>
              <p class="text-gray-500 dark:text-gray-400 mt-1">Here's an overview of your workspaces</p>
            </div>
            <a routerLink="/my-tasks"
               class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        } @else {
          <!-- Stats Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <!-- Total Tasks -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Total Tasks</p>
                  <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ stats()?.total_tasks || 0 }}</p>
                </div>
                <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Overdue -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
                  <p class="text-3xl font-bold mt-1" [class]="(stats()?.overdue || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'">{{ stats()?.overdue || 0 }}</p>
                </div>
                <div class="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                  <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Due Today -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Due Today</p>
                  <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ stats()?.due_today || 0 }}</p>
                </div>
                <div class="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                  <svg class="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Completed This Week -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Completed This Week</p>
                  <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ stats()?.completed_this_week || 0 }}</p>
                </div>
                <div class="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Activity -->
          @if (recentActivity().length > 0) {
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
              </div>
              <div class="divide-y divide-gray-100 dark:divide-gray-700">
                @for (activity of recentActivity(); track activity.id) {
                  <div class="px-6 py-4 flex items-start gap-3">
                    <!-- Avatar -->
                    <div class="flex-shrink-0">
                      @if (activity.actor_avatar_url) {
                        <img [src]="activity.actor_avatar_url" [alt]="activity.actor_name"
                             class="w-8 h-8 rounded-full object-cover">
                      } @else {
                        <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ activity.actor_name.charAt(0).toUpperCase() }}</span>
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
                          <span class="text-gray-500 dark:text-gray-400"> - </span>
                          <span class="font-medium">{{ activity.metadata['task_title'] }}</span>
                        }
                      </p>
                      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ formatRelativeTime(activity.created_at) }}</p>
                    </div>
                    <!-- Action badge -->
                    <div class="flex-shrink-0">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            [class]="getActionBadgeClass(activity.action)">
                        {{ activity.action }}
                      </span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Workspaces Section -->
          @if (workspaces().length === 0) {
            <!-- Empty State -->
            <div class="text-center py-12">
              <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">No workspaces yet</h3>
              <p class="mt-2 text-gray-500 dark:text-gray-400">Get started by creating your first workspace</p>
              <a routerLink="/onboarding"
                 class="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create Workspace
              </a>
            </div>
          } @else {
            <!-- Workspaces Header -->
            <div class="mb-4">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Your Workspaces</h2>
            </div>

            <!-- Workspaces Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              @for (workspace of workspaces(); track workspace.id) {
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
                  <div class="p-6">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ workspace.name }}</h3>
                        @if (workspace.description) {
                          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{{ workspace.description }}</p>
                        }
                      </div>
                      <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        <span class="text-blue-600 dark:text-blue-400 font-bold">{{ workspace.name.charAt(0).toUpperCase() }}</span>
                      </div>
                    </div>

                    @if (workspace.boards && workspace.boards.length > 0) {
                      <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Boards</p>
                        <div class="space-y-2">
                          @for (board of workspace.boards.slice(0, 3); track board.id) {
                            <a [routerLink]="['/workspace', workspace.id, 'board', board.id]"
                               class="flex items-center text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
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

                  <div class="px-6 py-3 bg-gray-50 dark:bg-gray-750 border-t border-gray-100 dark:border-gray-700">
                    <a [routerLink]="['/workspace', workspace.id]"
                       class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">
                      Open Workspace →
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
