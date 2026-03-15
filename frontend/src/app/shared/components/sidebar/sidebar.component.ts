import {
  Component,
  computed,
  signal,
  inject,
  input,
  output,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import {
  WorkspaceService,
  Workspace,
} from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  CreateWorkspaceDialogComponent,
  CreateWorkspaceDialogResult,
} from '../dialogs/create-workspace-dialog.component';
import { WorkspaceItemComponent } from './workspace-item.component';
import { SidebarFavoritesComponent } from './sidebar-favorites.component';
import { SidebarRecentComponent } from './sidebar-recent.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TooltipModule,
    CreateWorkspaceDialogComponent,
    WorkspaceItemComponent,
    SidebarFavoritesComponent,
    SidebarRecentComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .sidebar-root {
        background: var(--sidebar-bg);
      }

      .sidebar-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .sidebar-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .sidebar-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(100, 116, 139, 0.2);
        border-radius: 2px;
      }
      .sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(100, 116, 139, 0.35);
      }

      .nav-item {
        transition:
          background var(--duration-fast) var(--ease-standard),
          color var(--duration-fast) var(--ease-standard);
        position: relative;
      }
      .nav-item:hover {
        background: var(--sidebar-surface-hover);
      }
      .nav-item.active {
        background: var(--sidebar-surface-active);
        color: var(--sidebar-text-primary);
      }
      .nav-item.active .nav-indicator {
        opacity: 1;
      }

      .nav-indicator {
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 16px;
        border-radius: 0 3px 3px 0;
        background: var(--primary);
        opacity: 0;
        transition: opacity var(--duration-fast) var(--ease-standard);
      }

      .divider {
        height: 1px;
        background: var(--sidebar-border);
      }

      .collapsed-icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 0.5rem 0;
        transition: background var(--duration-fast) var(--ease-standard);
        border-radius: 0.375rem;
        position: relative;
      }
      .collapsed-icon-btn:hover {
        background: var(--sidebar-surface-hover);
      }
      .collapsed-icon-btn.active {
        background: var(--sidebar-surface-active);
      }

      .search-btn {
        background: var(--sidebar-surface);
        border: 1px solid var(--sidebar-border);
        transition:
          background var(--duration-fast) var(--ease-standard),
          border-color var(--duration-fast) var(--ease-standard);
      }
      .search-btn:hover {
        background: var(--sidebar-surface-hover);
        border-color: var(--sidebar-border);
      }

      .sidebar-icon-color {
        color: var(--sidebar-text-muted);
      }

      /* Collapse animation: text fades before width shrinks */
      .sidebar-text {
        transition: opacity 100ms ease;
      }
    `,
  ],
  template: `
    <aside
      class="sidebar-root h-full flex flex-col transition-all duration-300"
      [class.w-64]="!collapsed()"
      [class.w-14]="collapsed()"
      [class.sidebar-open]="isMobileOpen()"
    >
      <!-- Header: Logo & Search -->
      <div
        class="h-12 flex items-center flex-shrink-0"
        [class.px-3]="!collapsed()"
        [class.px-2]="collapsed()"
      >
        @if (!collapsed()) {
          <div class="flex items-center gap-2.5 w-full">
            <svg
              class="w-7 h-7 text-primary flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z"
              />
            </svg>
            <span
              class="text-base font-bold tracking-tight sidebar-text"
              style="letter-spacing: -0.02em; color: var(--sidebar-text-primary)"
              >TaskFlow</span
            >
            <button
              (click)="toggleCollapse.emit(); $event.stopPropagation()"
              class="hidden md:flex items-center justify-center w-7 h-7 rounded-md hover:bg-[var(--sidebar-surface-hover)] text-[var(--sidebar-text-secondary)] transition-colors ml-auto"
              [title]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
            >
              <svg
                class="w-4 h-4 transition-transform duration-200"
                [class.rotate-180]="collapsed()"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </div>
        } @else {
          <div class="flex justify-center w-full">
            <svg
              class="w-6 h-6 text-primary"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z"
              />
            </svg>
          </div>
        }
      </div>

      <!-- Search Button -->
      <div class="px-2 pb-3" [class.px-2]="collapsed()">
        @if (!collapsed()) {
          <button
            (click)="searchOpen.emit()"
            class="search-btn w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm sidebar-icon-color"
          >
            <i class="pi pi-search text-xs"></i>
            <span class="sidebar-text">Search</span>
            <span class="ml-auto text-xs sidebar-icon-color">{{
              searchShortcut
            }}</span>
          </button>
        } @else {
          <button
            (click)="searchOpen.emit()"
            class="collapsed-icon-btn"
            pTooltip="Search ({{ searchShortcut }})"
            tooltipPosition="right"
          >
            <i class="pi pi-search sidebar-icon-color text-sm"></i>
          </button>
        }
      </div>

      <div class="divider mx-2"></div>

      <!-- Main Navigation -->
      <nav
        class="flex-1 overflow-y-auto sidebar-scrollbar px-2 py-3 space-y-0.5"
      >
        <!-- Dashboard -->
        @if (!collapsed()) {
          <a
            routerLink="/dashboard"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            (click)="onNavItemClick()"
            class="nav-item flex items-center gap-3 px-3 py-2 rounded-md text-sm"
          >
            <span class="nav-indicator"></span>
            <i
              class="pi pi-objects-column text-sm flex-shrink-0 sidebar-icon-color"
            ></i>
            <span
              class="sidebar-text"
              style="color: var(--sidebar-text-secondary)"
              >Dashboard</span
            >
          </a>
        } @else {
          <a
            routerLink="/dashboard"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            (click)="onNavItemClick()"
            class="collapsed-icon-btn"
            pTooltip="Dashboard"
            tooltipPosition="right"
          >
            <i class="pi pi-objects-column sidebar-icon-color text-sm"></i>
          </a>
        }

        <!-- My Work -->
        @if (!collapsed()) {
          <a
            routerLink="/my-tasks"
            routerLinkActive="active"
            (click)="onNavItemClick()"
            class="nav-item flex items-center gap-3 px-3 py-2 rounded-md text-sm"
          >
            <span class="nav-indicator"></span>
            <i
              class="pi pi-clipboard text-sm flex-shrink-0 sidebar-icon-color"
            ></i>
            <span
              class="sidebar-text"
              style="color: var(--sidebar-text-secondary)"
              >My Work</span
            >
            @if (unreadCount() > 0) {
              <span
                class="ml-auto min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1"
              >
                {{ unreadCount() > 99 ? '99+' : unreadCount() }}
              </span>
            }
          </a>
        } @else {
          <a
            routerLink="/my-tasks"
            routerLinkActive="active"
            (click)="onNavItemClick()"
            class="collapsed-icon-btn relative"
            pTooltip="My Work"
            tooltipPosition="right"
          >
            <i class="pi pi-clipboard sidebar-icon-color text-sm"></i>
            @if (unreadCount() > 0) {
              <span
                class="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"
              ></span>
            }
          </a>
        }

        <!-- Archived -->
        @if (!collapsed()) {
          <a
            routerLink="/archive"
            routerLinkActive="active"
            (click)="onNavItemClick()"
            class="nav-item flex items-center gap-3 px-3 py-2 rounded-md text-sm"
          >
            <span class="nav-indicator"></span>
            <i class="pi pi-inbox text-sm flex-shrink-0 sidebar-icon-color"></i>
            <span
              class="sidebar-text"
              style="color: var(--sidebar-text-secondary)"
              >Archived</span
            >
          </a>
        } @else {
          <a
            routerLink="/archive"
            routerLinkActive="active"
            (click)="onNavItemClick()"
            class="collapsed-icon-btn"
            pTooltip="Archived"
            tooltipPosition="right"
          >
            <i class="pi pi-inbox sidebar-icon-color text-sm"></i>
          </a>
        }

        <div class="divider my-3 mx-1"></div>

        <!-- Favorites Section -->
        <app-sidebar-favorites [collapsed]="collapsed()" />

        <div class="divider my-3 mx-1"></div>

        <!-- Recent Section -->
        <app-sidebar-recent
          [collapsed]="collapsed()"
          [workspaceIds]="workspaceIdList()"
        />

        <div class="divider my-3 mx-1"></div>

        <!-- Workspaces Section -->
        <div class="mb-2">
          @if (!collapsed()) {
            <div class="sidebar-section-label">
              <i class="pi pi-th-large text-xs"></i>
              <span>Workspaces</span>
            </div>
          }

          @if (loading()) {
            <div class="px-3 space-y-2">
              @for (i of [1, 2, 3]; track i) {
                <div class="flex items-center gap-2 py-1.5">
                  <div class="w-4 h-4 skeleton rounded"></div>
                  @if (!collapsed()) {
                    <div class="flex-1 h-3 skeleton rounded"></div>
                  }
                </div>
              }
            </div>
          } @else if (workspaces().length === 0) {
            @if (!collapsed()) {
              <div class="px-3 py-4 text-center">
                <p class="text-xs" style="color: var(--sidebar-text-muted)">
                  No workspaces yet
                </p>
                @if (canCreateWorkspace()) {
                  <button
                    (click)="onCreateWorkspace()"
                    class="mt-2 text-xs text-primary hover:text-primary hover:brightness-90 transition-colors"
                  >
                    Create one
                  </button>
                }
              </div>
            }
          } @else {
            <div class="space-y-0.5">
              @for (workspace of workspaces(); track workspace.id) {
                @if (!collapsed()) {
                  <div class="group">
                    <app-workspace-item [workspace]="workspace" />
                  </div>
                } @else {
                  <a
                    [routerLink]="['/workspace', workspace.id]"
                    routerLinkActive="active"
                    class="collapsed-icon-btn"
                    [pTooltip]="workspace.name"
                    tooltipPosition="right"
                  >
                    <span
                      class="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
                      [style.background]="getWorkspaceColor(workspace)"
                    >
                      {{ workspace.name.charAt(0).toUpperCase() }}
                    </span>
                  </a>
                }
              }
            </div>
          }

          <!-- New Workspace -->
          @if (canCreateWorkspace()) {
            @if (!collapsed()) {
              <button
                (click)="onCreateWorkspace()"
                class="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-md text-sm transition-colors"
                style="color: var(--sidebar-text-muted)"
                onmouseover="this.style.color='var(--sidebar-text-secondary)'; this.style.background='var(--sidebar-surface-hover)'"
                onmouseout="this.style.color='var(--sidebar-text-muted)'; this.style.background='transparent'"
              >
                <i class="pi pi-plus text-xs"></i>
                <span>New Workspace</span>
              </button>
            } @else {
              <button
                (click)="onCreateWorkspace()"
                class="collapsed-icon-btn mt-1"
                pTooltip="New Workspace"
                tooltipPosition="right"
              >
                <i class="pi pi-plus sidebar-icon-color text-sm"></i>
              </button>
            }
          }
        </div>
      </nav>

      <!-- Footer -->
      @if (!collapsed()) {
        <div class="flex-shrink-0 px-2 pb-2 space-y-0.5 relative">
          <!-- Profile popup backdrop -->
          @if (profileMenuOpen()) {
            <div
              class="fixed inset-0 z-10"
              (click)="profileMenuOpen.set(false)"
            ></div>
          }

          <!-- Profile popup -->
          @if (profileMenuOpen()) {
            <div
              class="absolute bottom-full left-2 right-2 mb-1 z-20 rounded-lg shadow-lg border py-1"
              style="background: var(--surface-overlay); border-color: var(--sidebar-border)"
            >
              @if (currentUser()) {
                <div
                  class="px-3 py-2 border-b"
                  style="border-color: var(--sidebar-border)"
                >
                  <div
                    class="font-medium text-sm truncate"
                    style="color: var(--sidebar-text-primary)"
                  >
                    {{ currentUser()!.name }}
                  </div>
                  <div
                    class="text-xs truncate"
                    style="color: var(--sidebar-text-muted)"
                  >
                    {{ currentUser()!.email }}
                  </div>
                </div>
              }
              <a
                routerLink="/settings/profile"
                (click)="profileMenuOpen.set(false)"
                class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--sidebar-surface-hover)] cursor-pointer"
                style="color: var(--sidebar-text-secondary)"
              >
                <i class="pi pi-cog text-xs"></i>
                <span>Settings</span>
              </a>
              <button
                (click)="handleSignOut()"
                class="flex items-center gap-2 px-3 py-2 text-sm w-full text-left hover:bg-[var(--sidebar-surface-hover)]"
                style="color: var(--sidebar-text-secondary)"
              >
                <i class="pi pi-sign-out text-xs"></i>
                <span>Sign Out</span>
              </button>
            </div>
          }

          <!-- Divider -->
          <div class="divider mx-1 mb-2"></div>

          <!-- Settings link -->
          <a
            routerLink="/settings/profile"
            routerLinkActive="active"
            class="nav-item flex items-center gap-3 px-3 py-2 rounded-md text-sm"
          >
            <span class="nav-indicator"></span>
            <i class="pi pi-cog text-sm flex-shrink-0 sidebar-icon-color"></i>
            <span
              class="sidebar-text"
              style="color: var(--sidebar-text-secondary)"
              >Settings</span
            >
          </a>

          <!-- Help link -->
          <a
            routerLink="/help"
            routerLinkActive="active"
            class="nav-item flex items-center gap-3 px-3 py-2 rounded-md text-sm"
          >
            <span class="nav-indicator"></span>
            <i
              class="pi pi-question-circle text-sm flex-shrink-0 sidebar-icon-color"
            ></i>
            <span
              class="sidebar-text"
              style="color: var(--sidebar-text-secondary)"
              >Help</span
            >
          </a>

          <!-- User profile button -->
          <button
            (click)="toggleProfileMenu(); $event.stopPropagation()"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-[var(--sidebar-surface-hover)] transition-colors"
          >
            @if (currentUser()?.avatar_url) {
              <img
                [src]="currentUser()!.avatar_url"
                class="w-7 h-7 rounded-full object-cover flex-shrink-0"
                [alt]="currentUser()!.name"
              />
            } @else {
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style="background: var(--primary)"
              >
                {{ getUserInitials(currentUser()?.name || '?') }}
              </div>
            }
            <span
              class="flex-1 text-left text-sm truncate sidebar-text"
              style="color: var(--sidebar-text-secondary)"
            >
              {{ currentUser()?.name || 'Profile' }}
            </span>
            <i
              class="pi pi-chevron-up text-xs sidebar-icon-color sidebar-text transition-transform duration-200"
              [class.rotate-180]="profileMenuOpen()"
            ></i>
          </button>
        </div>
      }

      <!-- Collapse Toggle Button (with collapsed footer) -->
      <div class="px-2 py-1.5">
        @if (collapsed()) {
          <!-- Collapsed footer icons -->
          <div class="px-2 space-y-0.5 mb-1">
            <a
              routerLink="/settings/profile"
              routerLinkActive="active"
              class="collapsed-icon-btn"
              pTooltip="Settings"
              tooltipPosition="right"
            >
              <i class="pi pi-cog sidebar-icon-color text-sm"></i>
            </a>
            <a
              routerLink="/help"
              routerLinkActive="active"
              class="collapsed-icon-btn"
              pTooltip="Help"
              tooltipPosition="right"
            >
              <i class="pi pi-question-circle sidebar-icon-color text-sm"></i>
            </a>
            <button
              (click)="toggleProfileMenu(); $event.stopPropagation()"
              class="collapsed-icon-btn"
              [pTooltip]="currentUser()?.name || 'Profile'"
              tooltipPosition="right"
            >
              @if (currentUser()?.avatar_url) {
                <img
                  [src]="currentUser()!.avatar_url"
                  class="w-6 h-6 rounded-full object-cover"
                  [alt]="currentUser()!.name"
                />
              } @else {
                <div
                  class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style="background: var(--primary)"
                >
                  {{ getUserInitials(currentUser()?.name || '?') }}
                </div>
              }
            </button>
          </div>
        }
        <button
          (click)="toggleCollapse.emit()"
          class="collapsed-icon-btn"
          [pTooltip]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
          tooltipPosition="right"
        >
          <i
            class="pi sidebar-icon-color text-xs"
            [class.pi-angle-double-right]="collapsed()"
            [class.pi-angle-double-left]="!collapsed()"
          ></i>
        </button>
      </div>
    </aside>

    <!-- Create Workspace Dialog -->
    <app-create-workspace-dialog
      [(visible)]="showCreateWorkspaceDialog"
      (created)="onWorkspaceCreated($event)"
    />
  `,
})
export class SidebarComponent implements OnInit {
  collapsed = input(false);
  isMobileOpen = input(false);
  toggleCollapse = output<void>();
  sidebarClose = output<void>();
  searchOpen = output<void>();

  private workspaceService = inject(WorkspaceService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  loading = signal(false);
  workspaces = signal<Workspace[]>([]);
  workspaceIdList = computed(() => this.workspaces().map((w) => w.id));
  currentUser = this.authService.currentUser;
  showCreateWorkspaceDialog = signal(false);
  unreadCount = this.notificationService.unreadCount;
  profileMenuOpen = signal(false);
  searchShortcut =
    typeof navigator !== 'undefined' &&
    navigator.platform.toLowerCase().includes('mac')
      ? '\u2318K'
      : 'Ctrl+K';

  private readonly workspaceColors = [
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#f43f5e',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#06b6d4',
  ];

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.loadWorkspaces();
    }
  }

  canCreateWorkspace(): boolean {
    return !!this.currentUser();
  }

  getWorkspaceColor(workspace: Workspace): string {
    const charCode = workspace.name.charCodeAt(0) || 0;
    return this.workspaceColors[charCode % this.workspaceColors.length];
  }

  onCreateWorkspace(): void {
    this.showCreateWorkspaceDialog.set(true);
  }

  onWorkspaceCreated(result: CreateWorkspaceDialogResult): void {
    this.workspaceService.create(result).subscribe({
      next: (workspace) => {
        this.workspaces.update((ws) => [...ws, workspace]);
        this.router.navigate(['/workspace', workspace.id]);
      },
      error: () => {
        // Error handling - workspace creation failed
      },
    });
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.update((v) => !v);
  }

  handleSignOut(): void {
    this.profileMenuOpen.set(false);
    this.authService.signOut('manual');
  }

  getUserInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  onNavItemClick(): void {
    if (this.isMobileOpen()) this.sidebarClose.emit();
  }

  private loadWorkspaces(): void {
    this.loading.set(true);
    this.workspaceService.list().subscribe({
      next: (workspaces) => {
        this.workspaces.set(workspaces);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
