import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProjectService, Board } from '../../../core/services/project.service';
import { Workspace } from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { WorkspaceSettingsDialogService } from '../../../core/services/workspace-settings-dialog.service';
import {
  CreateProjectDialogComponent,
  CreateProjectDialogResult,
} from '../dialogs/create-project-dialog.component';

@Component({
  selector: 'app-workspace-item',
  standalone: true,
  imports: [CommonModule, RouterModule, CreateProjectDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
      }

      .workspace-header-btn {
        transition: background var(--duration-fast) var(--ease-standard);
      }
      .workspace-header-btn:hover {
        background: var(--sidebar-surface-hover);
      }

      .workspace-icon {
        transition: transform var(--duration-fast) var(--ease-standard);
      }
      .workspace-header-btn:hover .workspace-icon {
        transform: scale(1.05);
      }

      .board-link {
        transition:
          background var(--duration-fast) var(--ease-standard),
          color var(--duration-fast) var(--ease-standard);
        color: var(--sidebar-text-secondary);
      }
      .board-link:hover {
        background: var(--sidebar-surface-hover);
        color: var(--sidebar-text-primary);
      }

      .board-link-active {
        background: var(--sidebar-surface-active) !important;
        color: var(--sidebar-text-primary) !important;
      }

      /* Tree-view vertical guide line */
      .board-tree {
        position: relative;
      }
      .board-tree::before {
        content: '';
        position: absolute;
        left: 1.125rem;
        top: 0;
        bottom: 0.5rem;
        width: 1px;
        background: var(--sidebar-border);
      }

      .add-board-btn {
        transition:
          opacity var(--duration-fast) var(--ease-standard),
          background var(--duration-fast) var(--ease-standard);
      }
      .add-board-btn:hover {
        background: var(--sidebar-surface-hover);
      }

      .sidebar-icon-color {
        color: var(--sidebar-text-muted);
      }
    `,
  ],
  template: `
    <div class="mb-0.5">
      <!-- Workspace Header -->
      <div
        class="workspace-header-btn w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md"
        style="color: var(--sidebar-text-secondary)"
      >
        <!-- Chevron: toggles expand/collapse -->
        <button
          (click)="toggleExpanded(); $event.stopPropagation()"
          class="flex items-center justify-center flex-shrink-0 p-0.5 rounded hover:bg-[var(--sidebar-surface-hover)]"
          title="Toggle projects"
        >
          <svg
            [class]="
              'w-3.5 h-3.5 transition-transform duration-200 ' +
              (expanded() ? 'rotate-90' : '')
            "
            style="color: var(--sidebar-text-muted)"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        <!-- Workspace name area: navigates to portfolio -->
        <button
          (click)="navigateToPortfolio()"
          class="flex items-center gap-2 flex-1 min-w-0 text-left"
          title="Open portfolio"
        >
          <!-- Workspace Icon -->
          <span
            class="workspace-icon w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            [style.background]="getColor()"
          >
            {{ workspace().name.charAt(0).toUpperCase() }}
          </span>

          <!-- Workspace Name -->
          <span class="flex-1 text-left truncate">{{ workspace().name }}</span>
        </button>

        <!-- Add Board Button (manager/admin only) -->
        @if (canCreateBoard()) {
          <button
            (click)="onAddBoardClick($event)"
            class="add-board-btn p-1 rounded opacity-0 group-hover:opacity-100 flex-shrink-0"
            title="Add Project"
          >
            <svg
              class="w-3.5 h-3.5"
              style="color: var(--sidebar-text-muted)"
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
          </button>
        }

        <!-- Workspace menu (3-dot) -->
        <div class="relative">
          <button
            (click)="toggleWorkspaceMenu($event)"
            class="add-board-btn p-1 rounded opacity-0 group-hover:opacity-100 flex-shrink-0"
            title="Workspace options"
          >
            <i class="pi pi-ellipsis-h text-xs sidebar-icon-color"></i>
          </button>

          @if (workspaceMenuOpen()) {
            <div
              class="fixed inset-0 z-10"
              (click)="workspaceMenuOpen.set(false)"
            ></div>
            <div
              class="absolute right-0 top-full mt-1 w-44 rounded-lg shadow-lg border py-1 z-20"
              style="background: var(--surface-overlay); border-color: var(--sidebar-border)"
            >
              <a
                [routerLink]="['/workspace', workspace().id, 'portfolio']"
                (click)="workspaceMenuOpen.set(false)"
                class="flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-[var(--sidebar-surface-hover)] cursor-pointer"
                style="color: var(--sidebar-text-secondary)"
              >
                <i class="pi pi-th-large text-xs"></i>
                <span>Portfolio</span>
              </a>
              <a
                [routerLink]="['/workspace', workspace().id, 'manage']"
                (click)="workspaceMenuOpen.set(false)"
                class="flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-[var(--sidebar-surface-hover)] cursor-pointer"
                style="color: var(--sidebar-text-secondary)"
              >
                <i class="pi pi-users text-xs"></i>
                <span>Manage Workspace</span>
              </a>
            </div>
          }
        </div>
      </div>

      <!-- Boards List -->
      @if (expanded()) {
        <div class="board-tree ml-4 mt-0.5 space-y-0.5">
          @if (loading()) {
            <div
              class="px-3 py-1.5 text-sm"
              style="color: var(--sidebar-text-muted)"
            >
              Loading...
            </div>
          } @else if (boards().length === 0) {
            <div
              class="px-3 py-1.5 text-xs italic"
              style="color: var(--sidebar-text-muted)"
            >
              No projects
            </div>
          } @else {
            @for (board of boards(); track board.id) {
              <div class="relative group/board">
                <!-- Board menu backdrop -->
                @if (activeMenuBoardId() === board.id) {
                  <div
                    class="fixed inset-0 z-10"
                    (click)="closeBoardMenu()"
                  ></div>
                }
                <a
                  [routerLink]="[
                    '/workspace',
                    workspace().id,
                    'project',
                    board.id,
                  ]"
                  routerLinkActive="board-link-active"
                  class="board-link flex items-center gap-2 px-3 py-1.5 text-sm rounded-md pr-16"
                >
                  <i
                    class="pi pi-table text-xs flex-shrink-0"
                    style="color: var(--sidebar-text-muted)"
                  ></i>
                  <span class="truncate flex-1">{{ board.name }}</span>
                </a>
                <!-- Hover action buttons -->
                <div
                  class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/board:opacity-100 transition-opacity"
                >
                  <!-- Star toggle -->
                  <button
                    (click)="toggleFavorite(board, $event)"
                    class="p-1 rounded hover:bg-[var(--sidebar-surface-hover)] transition-colors"
                    [title]="
                      isFavorited(board.id)
                        ? 'Remove from favorites'
                        : 'Add to favorites'
                    "
                  >
                    <i
                      class="text-xs"
                      [class.pi-star-fill]="isFavorited(board.id)"
                      [class.pi-star]="!isFavorited(board.id)"
                      [class]="
                        'pi ' +
                        (isFavorited(board.id) ? 'text-amber-400' : '') +
                        ' sidebar-icon-color'
                      "
                    ></i>
                  </button>
                  <!-- Context menu trigger -->
                  <button
                    (click)="openBoardMenu(board.id, $event)"
                    class="p-1 rounded hover:bg-[var(--sidebar-surface-hover)] transition-colors"
                    title="More options"
                  >
                    <i class="pi pi-ellipsis-h text-xs sidebar-icon-color"></i>
                  </button>
                </div>
                <!-- Context menu dropdown -->
                @if (activeMenuBoardId() === board.id) {
                  <div
                    class="absolute right-0 top-full mt-0.5 w-40 rounded-md shadow-lg border py-1 z-20"
                    style="background: var(--surface-overlay); border-color: var(--sidebar-border)"
                  >
                    <a
                      [routerLink]="[
                        '/workspace',
                        workspace().id,
                        'project',
                        board.id,
                      ]"
                      (click)="closeBoardMenu()"
                      class="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--sidebar-surface-hover)] cursor-pointer"
                      style="color: var(--sidebar-text-secondary)"
                    >
                      <i class="pi pi-external-link text-xs"></i>
                      <span>Open</span>
                    </a>
                    <button
                      (click)="copyBoardLink(board, $event)"
                      class="flex items-center gap-2 px-3 py-1.5 text-xs w-full text-left hover:bg-[var(--sidebar-surface-hover)]"
                      style="color: var(--sidebar-text-secondary)"
                    >
                      <i class="pi pi-link text-xs"></i>
                      <span>Copy link</span>
                    </button>
                    <div
                      style="border-top: 1px solid var(--sidebar-border); margin: 2px 0"
                    ></div>
                    <button
                      (click)="archiveBoard(board, $event)"
                      class="flex items-center gap-2 px-3 py-1.5 text-xs w-full text-left hover:bg-[var(--sidebar-surface-hover)]"
                      style="color: var(--sidebar-text-secondary)"
                    >
                      <i class="pi pi-box text-xs"></i>
                      <span>Archive</span>
                    </button>
                  </div>
                }
              </div>
            }
          }

        </div>
      }
    </div>

    <!-- Create Board Dialog (PrimeNG) -->
    <app-create-project-dialog
      [(visible)]="showCreateProjectDialog"
      [workspaceId]="workspace().id"
      [workspaceName]="workspace().name"
      (created)="onBoardCreated($event)"
    />
  `,
})
export class WorkspaceItemComponent implements OnInit {
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);
  private favoritesService = inject(FavoritesService);
  private settingsDialog = inject(WorkspaceSettingsDialogService);
  private router = inject(Router);

  workspace = input.required<Workspace>();

  expanded = signal(false);
  loading = signal(false);
  boards = signal<Board[]>([]);
  showCreateProjectDialog = signal(false);
  favoriteIds = signal<Set<string>>(new Set());
  activeMenuBoardId = signal<string | null>(null);
  workspaceMenuOpen = signal(false);

  private readonly colors = [
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
    const saved = localStorage.getItem(
      `taskflow_ws_expanded_${this.workspace().id}`,
    );
    this.expanded.set(saved !== null ? saved === 'true' : true);
    this.loadBoards();
  }

  getColor(): string {
    const charCode = this.workspace().name.charCodeAt(0) || 0;
    return this.colors[charCode % this.colors.length];
  }

  toggleExpanded(): void {
    this.expanded.update((v) => !v);
    localStorage.setItem(
      `taskflow_ws_expanded_${this.workspace().id}`,
      String(this.expanded()),
    );
    if (this.expanded() && this.boards().length === 0) {
      this.loadBoards();
    }
  }

  navigateToPortfolio(): void {
    this.router.navigate(['/workspace', this.workspace().id, 'portfolio']);
  }

  canCreateBoard(): boolean {
    const user = this.authService.currentUser();
    return !!user;
  }

  toggleWorkspaceMenu(event: Event): void {
    event.stopPropagation();
    this.workspaceMenuOpen.update((v) => !v);
  }

  openSettings(event: Event): void {
    event.stopPropagation();
    this.settingsDialog.open(this.workspace().id);
  }

  onAddBoardClick(event: Event): void {
    event.stopPropagation();
    this.showCreateProjectDialog.set(true);
  }

  onBoardCreated(result: CreateProjectDialogResult): void {
    this.projectService
      .createBoard(this.workspace().id, {
        name: result.name,
        description: result.description,
        template: result.template,
      })
      .subscribe({
        next: (board) => {
          this.boards.update((boards) => [...boards, board]);
          if (!this.expanded()) {
            this.expanded.set(true);
          }
        },
        error: () => {
          // Error handling - board creation failed
        },
      });
  }

  isFavorited(boardId: string): boolean {
    return this.favoriteIds().has(boardId);
  }

  toggleFavorite(board: Board, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.isFavorited(board.id)) {
      this.favoritesService.remove('board', board.id).subscribe({
        next: () => {
          this.favoriteIds.update((s) => {
            const next = new Set(s);
            next.delete(board.id);
            return next;
          });
        },
        error: () => {},
      });
    } else {
      this.favoritesService
        .add({ entity_type: 'board', entity_id: board.id })
        .subscribe({
          next: () => {
            this.favoriteIds.update((s) => new Set([...s, board.id]));
          },
          error: () => {},
        });
    }
  }

  openBoardMenu(boardId: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.activeMenuBoardId.set(
      this.activeMenuBoardId() === boardId ? null : boardId,
    );
  }

  closeBoardMenu(): void {
    this.activeMenuBoardId.set(null);
  }

  archiveBoard(board: Board, event: Event): void {
    event.stopPropagation();
    this.activeMenuBoardId.set(null);
    this.projectService.deleteBoard(board.id).subscribe({
      next: () => {
        this.boards.update((boards) => boards.filter((b) => b.id !== board.id));
      },
      error: () => {},
    });
  }

  copyBoardLink(board: Board, event: Event): void {
    event.stopPropagation();
    const url = `${window.location.origin}/workspace/${this.workspace().id}/project/${board.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    this.activeMenuBoardId.set(null);
  }

  private loadBoards(): void {
    this.loading.set(true);
    forkJoin({
      boards: this.projectService.listBoards(this.workspace().id),
      favorites: this.favoritesService.list(),
    }).subscribe({
      next: ({ boards, favorites }) => {
        this.boards.set(boards);
        const favSet = new Set(
          favorites
            .filter((f) => f.entity_type === 'board')
            .map((f) => f.entity_id),
        );
        this.favoriteIds.set(favSet);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
