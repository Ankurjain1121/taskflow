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
  template: `
    <aside
      [class]="
        'h-screen bg-gray-900 text-gray-100 flex flex-col transition-all duration-300 ' +
        (collapsed() ? 'w-16' : 'w-64')
      "
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-4 py-4 border-b border-gray-800"
      >
        @if (!collapsed()) {
          <div class="flex items-center gap-2">
            <svg
              class="w-8 h-8 text-indigo-500"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z"
              />
            </svg>
            <span class="text-xl font-bold">TaskFlow</span>
          </div>
        } @else {
          <svg
            class="w-8 h-8 text-indigo-500 mx-auto"
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
          class="p-1 hover:bg-gray-800 rounded-md transition-colors"
          title="Search (Ctrl+K)"
        >
          <svg
            class="w-5 h-5 text-gray-400 hover:text-white"
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
          class="p-1 hover:bg-gray-800 rounded-md transition-colors"
          [class.mx-auto]="collapsed()"
        >
          <svg
            class="w-5 h-5"
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

      <!-- Create Workspace Button (Admin Only) -->
      @if (!collapsed() && canCreateWorkspace()) {
        <div class="px-3 py-3 border-b border-gray-800">
          <button
            (click)="onCreateWorkspace()"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors text-sm font-medium"
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
      }

      <!-- Workspaces List -->
      <div class="flex-1 overflow-y-auto px-2 py-3">
        @if (loading()) {
          <div class="px-3 py-2 text-sm text-gray-400">
            Loading workspaces...
          </div>
        } @else if (workspaces().length === 0) {
          <div class="px-3 py-4 text-center text-gray-500 text-sm">
            <p>No workspaces yet</p>
            @if (canCreateWorkspace()) {
              <p class="mt-1">Create your first workspace above</p>
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
                class="block w-10 h-10 mx-auto mb-2 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold hover:bg-indigo-700 transition-colors"
                [title]="workspace.name"
              >
                {{ workspace.name.charAt(0).toUpperCase() }}
              </a>
            }
          }
        }
      </div>

      <!-- User Profile & Sign Out -->
      <div class="border-t border-gray-800 px-3 py-3">
        @if (currentUser(); as user) {
          <div class="flex items-center gap-3">
            <!-- Avatar -->
            <div
              class="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium"
            >
              @if (user.avatar_url) {
                <img
                  [src]="user.avatar_url"
                  [alt]="user.display_name"
                  class="w-full h-full rounded-full object-cover"
                />
              } @else {
                {{ user.display_name?.charAt(0)?.toUpperCase() || 'U' }}
              }
            </div>

            @if (!collapsed()) {
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">
                  {{ user.display_name }}
                </p>
                <p class="text-xs text-gray-400 truncate">{{ user.email }}</p>
              </div>

              <!-- Sign Out Button -->
              <button
                (click)="onSignOut()"
                class="p-2 hover:bg-gray-800 rounded-md transition-colors"
                title="Sign out"
              >
                <svg
                  class="w-5 h-5 text-gray-400 hover:text-white"
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
