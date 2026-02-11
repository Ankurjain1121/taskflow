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
import { RouterModule, Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  WorkspaceService,
  Workspace,
} from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  CreateWorkspaceDialogComponent,
  CreateWorkspaceDialogResult,
} from '../dialogs/create-workspace-dialog.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; height: 100%; }

    .sidebar-root {
      background: linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%);
    }

    .sidebar-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .sidebar-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .sidebar-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(99, 102, 241, 0.3);
      border-radius: 3px;
    }
    .sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(99, 102, 241, 0.5);
    }

    .nav-item {
      transition: all 0.2s ease;
      position: relative;
    }
    .nav-item:hover {
      background: rgba(99, 102, 241, 0.1);
    }
    .nav-item.active {
      background: rgba(99, 102, 241, 0.15);
      border-left: 3px solid #6366f1;
    }
    .nav-item.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%);
    }

    .section-header {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: rgba(148, 163, 184, 0.7);
    }

    .workspace-item {
      transition: all 0.2s ease;
    }
    .workspace-item:hover {
      background: rgba(99, 102, 241, 0.08);
      padding-left: 1rem;
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

    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(99, 102, 241, 0.2) 50%, transparent 100%);
    }

    .user-section {
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(12px);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
  `],
  template: `
    <aside class="sidebar-root h-full flex flex-col text-gray-100">
      <!-- Header: Logo & Search -->
      <div class="px-4 py-4">
        <div class="flex items-center gap-2.5 mb-3">
          <svg
            class="w-8 h-8 text-indigo-400 logo-icon"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z"/>
          </svg>
          <span class="text-xl font-bold tracking-tight brand-text">TaskFlow</span>
        </div>

        <!-- Search Button -->
        <button
          (click)="onSearchClick()"
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800/70 transition-colors text-sm text-gray-400"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <span>Search</span>
          <span class="ml-auto text-xs text-gray-500">⌘K</span>
        </button>
      </div>

      <div class="divider mx-3"></div>

      <!-- Main Navigation -->
      <nav class="flex-1 overflow-y-auto sidebar-scrollbar px-3 py-3 space-y-1">
        <!-- Home -->
        <a
          routerLink="/dashboard"
          routerLinkActive="active"
          class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
        >
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          <span>Home</span>
        </a>

        <!-- My Work -->
        <a
          routerLink="/my-tasks"
          routerLinkActive="active"
          class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
        >
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <span>My Work</span>
        </a>

        <!-- Dashboard -->
        <a
          routerLink="/dashboard"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{exact: true}"
          class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
        >
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <span>Dashboard</span>
        </a>

        <div class="divider my-3"></div>

        <!-- Workspaces Section -->
        <div class="mb-2">
          <div class="section-header px-3 mb-2">Workspaces</div>

          @if (loading()) {
            <!-- Loading skeletons -->
            <div class="px-3 space-y-2">
              @for (i of [1,2,3]; track i) {
                <div class="flex items-center gap-2 py-1.5">
                  <div class="w-4 h-4 bg-slate-700 rounded animate-pulse"></div>
                  <div class="flex-1 h-3 bg-slate-700 rounded animate-pulse"></div>
                </div>
              }
            </div>
          } @else if (workspaces().length === 0) {
            <!-- Empty state -->
            <div class="px-3 py-4 text-center">
              <p class="text-xs text-gray-500">No workspaces yet</p>
              @if (canCreateWorkspace()) {
                <button
                  (click)="onCreateWorkspace()"
                  class="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Create one
                </button>
              }
            </div>
          } @else {
            <!-- Workspaces list -->
            <div class="space-y-0.5">
              @for (workspace of workspaces(); track workspace.id) {
                <a
                  [routerLink]="['/workspace', workspace.id]"
                  routerLinkActive="active"
                  class="workspace-item flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
                >
                  <svg class="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                  </svg>
                  <span class="truncate">{{ workspace.name }}</span>
                </a>
              }
            </div>
          }

          <!-- New Workspace Button -->
          @if (canCreateWorkspace()) {
            <button
              (click)="onCreateWorkspace()"
              class="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg text-sm text-gray-400 hover:text-indigo-300 hover:bg-slate-800/50 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              <span>New Workspace</span>
            </button>
          }
        </div>

        <div class="divider my-3"></div>

        <!-- Favorites & Archive -->
        <div class="space-y-1">
          <!-- Favorites -->
          <a
            routerLink="/favorites"
            routerLinkActive="active"
            class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
            </svg>
            <span>Favorites</span>
          </a>

          <!-- Archive -->
          <a
            routerLink="/archive"
            routerLinkActive="active"
            class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
            </svg>
            <span>Archive</span>
          </a>
        </div>

        <div class="divider my-3"></div>

        <!-- Settings, Team, WhatsApp, Help -->
        <div class="space-y-1">
          <!-- Settings -->
          <a
            routerLink="/settings/profile"
            routerLinkActive="active"
            class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span>Settings</span>
          </a>

          <!-- Team -->
          <a
            routerLink="/team"
            routerLinkActive="active"
            class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            <span>Team</span>
          </a>

          <!-- WhatsApp -->
          <a
            routerLink="/whatsapp"
            routerLinkActive="active"
            class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
            <span>WhatsApp</span>
          </a>

          <!-- Help -->
          <a
            routerLink="/help"
            routerLinkActive="active"
            class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>Help</span>
          </a>
        </div>
      </nav>

      <!-- User Profile Section -->
      <div class="user-section px-4 py-3">
        @if (currentUser(); as user) {
          <div class="flex items-center gap-3">
            <!-- Avatar -->
            <div class="flex-shrink-0">
              @if (user.avatar_url) {
                <img
                  [src]="user.avatar_url"
                  [alt]="user.name"
                  class="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/50"
                />
              } @else {
                <div class="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center ring-2 ring-indigo-500/50">
                  <span class="text-sm font-medium text-white">{{ user.name?.charAt(0)?.toUpperCase() || 'U' }}</span>
                </div>
              }
            </div>

            <!-- User Info -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate text-gray-100">
                {{ user.name }}
              </p>
              <p class="text-xs text-gray-500 truncate">{{ user.email }}</p>
            </div>

            <!-- Sign Out Button -->
            <button
              (click)="onSignOut()"
              class="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
              title="Sign out"
            >
              <svg
                class="w-5 h-5 text-gray-500 hover:text-red-400 transition-colors"
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
  private router = inject(Router);

  loading = signal(false);
  workspaces = signal<Workspace[]>([]);
  currentUser = this.authService.currentUser;

  ngOnInit(): void {
    this.loadWorkspaces();
  }

  onSearchClick(): void {
    this.searchOpen.emit();
  }

  canCreateWorkspace(): boolean {
    return !!this.currentUser();
  }

  onCreateWorkspace(): void {
    const dialogRef = this.dialog.open(CreateWorkspaceDialogComponent);

    dialogRef.afterClosed().subscribe((result: CreateWorkspaceDialogResult | undefined) => {
      if (result) {
        this.workspaceService.create(result).subscribe({
          next: (workspace) => {
            this.workspaces.update((workspaces) => [...workspaces, workspace]);
            // Navigate to new workspace
            this.router.navigate(['/workspace', workspace.id]);
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
