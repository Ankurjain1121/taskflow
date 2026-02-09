import {
  Component,
  signal,
  inject,
  OnInit,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  WorkspaceService,
  Workspace,
} from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';
import { WorkspaceItemComponent } from './workspace-item.component';
import {
  CreateWorkspaceDialogComponent,
  CreateWorkspaceDialogResult,
} from '../dialogs/create-workspace-dialog.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatDialogModule, WorkspaceItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }

    .sidebar-root {
      background: linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%);
    }

    .sidebar-section-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(99, 102, 241, 0.2) 50%, transparent 100%);
    }

    .logo-icon {
      filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.5));
    }

    .brand-text {
      background: linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 50%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .create-workspace-btn {
      background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
      box-shadow: 0 0 16px rgba(99, 102, 241, 0.25), 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
    }
    .create-workspace-btn:hover {
      background: linear-gradient(135deg, #5b52f0 0%, #7577f5 100%);
      box-shadow: 0 0 24px rgba(99, 102, 241, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3);
      transform: translateY(-1px);
    }
    .create-workspace-btn:active {
      transform: translateY(0);
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.2), 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .collapsed-workspace-avatar {
      transition: all 0.2s ease;
    }
    .collapsed-workspace-avatar:hover {
      transform: scale(1.1);
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
    }

    .user-profile-section {
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .user-avatar-ring {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      padding: 2px;
    }
    .user-avatar-inner {
      background: #1e293b;
    }

    .header-action-btn {
      transition: all 0.2s ease;
    }
    .header-action-btn:hover {
      background: rgba(255, 255, 255, 0.08);
    }

    .signout-btn {
      transition: all 0.2s ease;
    }
    .signout-btn:hover {
      background: rgba(239, 68, 68, 0.1);
    }
    .signout-btn:hover svg {
      color: #f87171;
    }
  `],
  template: `
    <aside
      class="sidebar-root h-screen text-gray-100 flex flex-col transition-all duration-300 ease-in-out"
      [class.w-16]="collapsed()"
      [class.w-64]="!collapsed()"
    >
      <!-- Header / Logo Area -->
      <div
        class="flex items-center justify-between px-4 py-4"
      >
        @if (!collapsed()) {
          <div class="flex items-center gap-2.5">
            <svg
              class="w-8 h-8 text-indigo-400 logo-icon"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z"
              />
            </svg>
            <span class="text-xl font-bold tracking-tight brand-text">TaskFlow</span>
          </div>
        } @else {
          <svg
            class="w-8 h-8 text-indigo-400 mx-auto logo-icon"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z"
            />
          </svg>
        }

        <!-- Search Button -->
        <button
          (click)="onSearchClick()"
          class="header-action-btn p-1.5 rounded-lg"
          title="Search (Ctrl+K)"
        >
          <svg
            class="w-5 h-5 text-gray-400 transition-colors hover:text-indigo-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>

        <button
          (click)="toggleCollapsed()"
          class="header-action-btn p-1.5 rounded-lg"
          [class.mx-auto]="collapsed()"
        >
          <svg
            class="w-5 h-5 text-gray-400 transition-colors hover:text-indigo-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              [attr.d]="
                collapsed()
                  ? 'M13 5l7 7-7 7M5 5l7 7-7 7'
                  : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'
              "
            />
          </svg>
        </button>
      </div>

      <!-- Section Divider -->
      <div class="sidebar-section-divider mx-3"></div>

      <!-- Create Workspace Button (Admin Only) -->
      @if (!collapsed() && canCreateWorkspace()) {
        <div class="px-3 py-3">
          <button
            (click)="onCreateWorkspace()"
            class="create-workspace-btn w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg text-sm font-semibold"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Workspace
          </button>
        </div>
        <!-- Section Divider -->
        <div class="sidebar-section-divider mx-3"></div>
      }

      <!-- Workspaces List -->
      <div class="flex-1 overflow-y-auto sidebar-scrollbar px-2 py-3">
        @if (loading()) {
          <div class="px-3 py-2 text-sm text-gray-400">
            Loading workspaces...
          </div>
        } @else if (workspaces().length === 0) {
          <div class="px-3 py-4 text-center text-gray-500 text-sm">
            <p>No workspaces yet</p>
            @if (canCreateWorkspace()) {
              <p class="mt-1 text-gray-600">Create your first workspace above</p>
            }
          </div>
        } @else {
          @if (!collapsed()) {
            @for (workspace of workspaces(); track workspace.id) {
              <app-workspace-item
                [workspace]="workspace"
                class="group"
              ></app-workspace-item>
            }
          } @else {
            @for (workspace of workspaces(); track workspace.id) {
              <a
                [routerLink]="['/workspace', workspace.id]"
                class="collapsed-workspace-avatar block w-10 h-10 mx-auto mb-2 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold"
                [title]="workspace.name"
              >
                {{ workspace.name.charAt(0).toUpperCase() }}
              </a>
            }
          }
        }
      </div>

      <!-- User Profile & Sign Out -->
      <div class="user-profile-section px-3 py-3 mx-2 mb-2 rounded-xl">
        @if (currentUser(); as user) {
          <div class="flex items-center gap-3">
            <!-- Avatar with gradient ring -->
            <div class="user-avatar-ring rounded-full flex-shrink-0">
              <div
                class="user-avatar-inner w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium"
              >
                @if (user.avatar_url) {
                  <img
                    [src]="user.avatar_url"
                    [alt]="user.display_name"
                    class="w-full h-full rounded-full object-cover"
                  />
                } @else {
                  <span class="text-indigo-300">{{ user.display_name?.charAt(0)?.toUpperCase() || 'U' }}</span>
                }
              </div>
            </div>

            @if (!collapsed()) {
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate text-gray-100">
                  {{ user.display_name }}
                </p>
                <p class="text-xs text-gray-500 truncate">{{ user.email }}</p>
              </div>

              <!-- Sign Out Button -->
              <button
                (click)="onSignOut()"
                class="signout-btn p-2 rounded-lg"
                title="Sign out"
              >
                <svg
                  class="w-5 h-5 text-gray-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            }
          </div>
        }
      </div>
    </aside>
  `,
})
export class SidebarComponent implements OnInit {
  @Output() searchOpen = new EventEmitter<void>();

  private workspaceService = inject(WorkspaceService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);

  collapsed = signal(false);
  loading = signal(false);
  workspaces = signal<Workspace[]>([]);
  currentUser = this.authService.currentUser;

  ngOnInit(): void {
    this.loadWorkspaces();
  }

  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }

  onSearchClick(): void {
    this.searchOpen.emit();
  }

  canCreateWorkspace(): boolean {
    // For now, any authenticated user can create workspaces
    // In production, this would check if user has admin role
    return !!this.currentUser();
  }

  onCreateWorkspace(): void {
    const dialogRef = this.dialog.open(CreateWorkspaceDialogComponent);

    dialogRef.afterClosed().subscribe((result: CreateWorkspaceDialogResult | undefined) => {
      if (result) {
        this.workspaceService.create(result).subscribe({
          next: (workspace) => {
            this.workspaces.update((workspaces) => [...workspaces, workspace]);
          },
          error: (err) => {
            console.error('Failed to create workspace:', err);
          },
        });
      }
    });
  }

  onSignOut(): void {
    this.authService.signOut();
  }

  private loadWorkspaces(): void {
    this.loading.set(true);
    this.workspaceService.list().subscribe({
      next: (workspaces) => {
        this.workspaces.set(workspaces);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load workspaces:', err);
        this.loading.set(false);
      },
    });
  }
}
