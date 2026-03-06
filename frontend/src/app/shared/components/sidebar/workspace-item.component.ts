import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProjectService, Project } from '../../../core/services/project.service';
import { Workspace } from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { WorkspaceSettingsDialogService } from '../../../core/services/workspace-settings-dialog.service';
import {
  CreateBoardDialogComponent,
  CreateBoardDialogResult,
} from '../dialogs/create-board-dialog.component';

@Component({
  selector: 'app-workspace-item',
  standalone: true,
  imports: [CommonModule, RouterModule, CreateBoardDialogComponent],
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

      .project-link {
        transition:
          background var(--duration-fast) var(--ease-standard),
          color var(--duration-fast) var(--ease-standard);
        color: var(--sidebar-text-secondary);
      }
      .board-link:hover {
        background: var(--sidebar-surface-hover);
        color: var(--sidebar-text-primary);
      }

      .project-link-active {
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
      <button
        (click)="toggleExpanded()"
        class="workspace-header-btn w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md"
        style="color: var(--sidebar-text-secondary)"
      >
        <!-- Chevron -->
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

        <!-- Workspace Icon (flat accent color, no shadow) -->
        <span
          class="workspace-icon w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white"
          [style.background]="getColor()"
        >
          {{ workspace().name.charAt(0).toUpperCase() }}
        </span>

        <!-- Workspace Name -->
        <span class="flex-1 text-left truncate">{{ workspace().name }}</span>

        <!-- Add Project Button (manager/admin only) -->
        @if (canCreateBoard()) {
          <button
            (click)="onAddBoardClick($event)"
            class="add-board-btn p-1 rounded opacity-0 group-hover:opacity-100"
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
      </button>

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
          } @else if (projects().length === 0) {
            <div
              class="px-3 py-1.5 text-xs italic"
              style="color: var(--sidebar-text-muted)"
            >
              No projects
            </div>
          } @else {
            @for (project of projects(); track project.id) {
              <div class="relative group/project">
                <!-- Project menu backdrop -->
                @if (activeMenuProjectId() === project.id) {
                  <div
                    class="fixed inset-0 z-10"
                    (click)="closeProjectMenu()"
                  ></div>
                }
                <a
                  [routerLink]="[
                    '/workspace',
                    workspace().id,
                    'project',
                    project.id,
                  ]"
                  routerLinkActive="project-link-active"
                  class="project-link flex items-center gap-2 px-3 py-1.5 text-sm rounded-md pr-16"
                >
                  <i
                    class="pi pi-table text-xs flex-shrink-0"
                    style="color: var(--sidebar-text-muted)"
                  ></i>
                  <span class="truncate flex-1">{{ project.name }}</span>
                </a>
                <!-- Hover action buttons -->
                <div
                  class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/board:opacity-100 transition-opacity"
                >
                  <!-- Star toggle -->
                  <button
                    (click)="toggleFavorite(project, $event)"
                    class="p-1 rounded hover:bg-[var(--sidebar-surface-hover)] transition-colors"
                    [title]="
                      isFavorited(project.id)
                        ? 'Remove from favorites'
                        : 'Add to favorites'
                    "
                  >
                    <i
                      class="text-xs"
                      [class.pi-star-fill]="isFavorited(project.id)"
                      [class.pi-star]="!isFavorited(project.id)"
                      [class]="
                        'pi ' +
                        (isFavorited(project.id) ? 'text-amber-400' : '') +
                        ' sidebar-icon-color'
                      "
                    ></i>
                  </button>
                  <!-- Context menu trigger -->
                  <button
                    (click)="openProjectMenu(project.id, $event)"
                    class="p-1 rounded hover:bg-[var(--sidebar-surface-hover)] transition-colors"
                    title="More options"
                  >
                    <i class="pi pi-ellipsis-h text-xs sidebar-icon-color"></i>
                  </button>
                </div>
                <!-- Context menu dropdown -->
                @if (activeMenuProjectId() === project.id) {
                  <div
                    class="absolute right-0 top-full mt-0.5 w-40 rounded-md shadow-lg border py-1 z-20"
                    style="background: var(--surface-overlay); border-color: var(--sidebar-border)"
                  >
                    <a
                      [routerLink]="[
                        '/workspace',
                        workspace().id,
                        'project',
                        project.id,
                      ]"
                      (click)="closeProjectMenu()"
                      class="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--sidebar-surface-hover)] cursor-pointer"
                      style="color: var(--sidebar-text-secondary)"
                    >
                      <i class="pi pi-external-link text-xs"></i>
                      <span>Open</span>
                    </a>
                    <button
                      (click)="copyProjectLink(project, $event)"
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
                      (click)="archiveBoard(project, $event)"
                      class="flex items-center gap-2 px-3 py-1.5 text-xs w-full text-left hover:bg-[var(--sidebar-surface-hover)]"
                      style="color: var(--sidebar-text-secondary)"
                    >
                      <i class="pi pi-inbox text-xs"></i>
                      <span>Archive</span>
                    </button>
                  </div>
                }
              </div>
            }
          }

          <!-- Workspace quick links -->
          <div
            class="mt-1 pt-1"
            style="border-top: 1px solid var(--sidebar-border)"
          >
            <a
              [routerLink]="['/workspace', workspace().id, 'team']"
              routerLinkActive="project-link-active"
              class="project-link flex items-center gap-2 px-3 py-1 text-xs rounded-md"
            >
              <i
                class="pi pi-chart-bar text-[10px]"
                style="color: var(--sidebar-text-muted)"
              ></i>
              <span>Team Overview</span>
            </a>
            <button
              (click)="openSettings($event)"
              class="project-link flex items-center gap-2 px-3 py-1 text-xs rounded-md w-full text-left"
            >
              <i
                class="pi pi-cog text-[10px]"
                style="color: var(--sidebar-text-muted)"
              ></i>
              <span>Settings</span>
            </button>
          </div>
        </div>
      }
    </div>

    <!-- Create Project Dialog (PrimeNG) -->
    <app-create-board-dialog
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

  workspace = input.required<Workspace>();

  expanded = signal(false);
  loading = signal(false);
  projects = signal<Project[]>([]);
  showCreateProjectDialog = signal(false);
  favoriteIds = signal<Set<string>>(new Set());
  activeMenuProjectId = signal<string | null>(null);

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
    this.loadProjects();
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
    if (this.expanded() && this.projects().length === 0) {
      this.loadProjects();
    }
  }

  canCreateBoard(): boolean {
    const user = this.authService.currentUser();
    return !!user;
  }

  openSettings(event: Event): void {
    event.stopPropagation();
    this.settingsDialog.open(this.workspace().id);
  }

  onAddBoardClick(event: Event): void {
    event.stopPropagation();
    this.showCreateProjectDialog.set(true);
  }

  onBoardCreated(result: CreateBoardDialogResult): void {
    this.projectService
      .createProject(this.workspace().id, {
        name: result.name,
        description: result.description,
        template: result.template,
      })
      .subscribe({
        next: (proj) => {
          this.projects.update((projects) => [...projects, proj]);
          if (!this.expanded()) {
            this.expanded.set(true);
          }
        },
        error: () => {
          // Error handling - board creation failed
        },
      });
  }

  isFavorited(projectId: string): boolean {
    return this.favoriteIds().has(projectId);
  }

  toggleFavorite(board: Project, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.isFavorited(board.id)) {
      this.favoritesService.remove('project', board.id).subscribe({
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
        .add({ entity_type: 'project', entity_id: board.id })
        .subscribe({
          next: () => {
            this.favoriteIds.update((s) => new Set([...s, board.id]));
          },
          error: () => {},
        });
    }
  }

  openProjectMenu(projectId: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.activeMenuProjectId.set(
      this.activeMenuProjectId() === projectId ? null : projectId,
    );
  }

  closeProjectMenu(): void {
    this.activeMenuProjectId.set(null);
  }

  archiveBoard(board: Project, event: Event): void {
    event.stopPropagation();
    this.activeMenuProjectId.set(null);
    if (!confirm(`Are you sure you want to delete "${board.name}"? This cannot be undone.`)) {
      return;
    }
    this.projectService.deleteProject(board.id).subscribe({
      next: () => {
        this.projects.update((projects) => projects.filter((b) => b.id !== board.id));
      },
      error: () => {},
    });
  }

  copyProjectLink(board: Project, event: Event): void {
    event.stopPropagation();
    const url = `${window.location.origin}/workspace/${this.workspace().id}/project/${board.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    this.activeMenuProjectId.set(null);
  }

  private loadProjects(): void {
    this.loading.set(true);
    forkJoin({
      projects: this.projectService.listProjects(this.workspace().id),
      favorites: this.favoritesService.list(),
    }).subscribe({
      next: ({ projects, favorites }) => {
        this.projects.set(projects);
        const favSet = new Set(
          favorites
            .filter((f) => f.entity_type === 'project')
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
