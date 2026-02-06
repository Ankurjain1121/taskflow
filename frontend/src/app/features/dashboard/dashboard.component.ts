import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkspaceService } from '../../core/services/workspace.service';

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
        } @else if (workspaces().length === 0) {
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
      </main>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);

  workspaces = signal<Workspace[]>([]);
  loading = signal(true);
  userName = signal<string | null>(null);

  ngOnInit(): void {
    // Check if user is authenticated
    const user = this.authService.currentUser();
    if (!user) {
      this.router.navigate(['/auth/sign-in']);
      return;
    }

    this.userName.set(user.name?.split(' ')[0] || null);
    this.loadWorkspaces();
  }

  private loadWorkspaces(): void {
    this.workspaceService.getWorkspaces().subscribe({
      next: (workspaces: Workspace[]) => {
        this.workspaces.set(workspaces);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
