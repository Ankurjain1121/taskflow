import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';
import { ProjectService, Board } from '../../../core/services/project.service';
import { FavoritesService, FavoriteItem } from '../../../core/services/favorites.service';
import { Workspace } from '../../../core/services/workspace.service';

interface WorkspaceWithProjects {
  workspace: Workspace;
  projects: Board[];
  loading: boolean;
  error: boolean;
}

const LS_KEY = 'taskbolt_all_projects_collapsed';

@Component({
  selector: 'app-sidebar-all-projects',
  standalone: true,
  imports: [RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; }
      .workspace-header {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.75rem;
        border-radius: 0.375rem;
        width: 100%;
        transition: background var(--duration-fast, 150ms) ease;
        cursor: pointer;
      }
      .workspace-header:hover { background: var(--sidebar-surface-hover); }
      .project-item {
        transition: background var(--duration-fast, 150ms) ease;
        position: relative;
      }
      .project-item:hover { background: var(--sidebar-surface-hover); }
      .project-item.active { background: var(--sidebar-surface-active); }
      .color-dot {
        width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
      }
      .star-btn {
        opacity: 0;
        transition: opacity 120ms ease, color 120ms ease;
        flex-shrink: 0;
      }
      .project-item:hover .star-btn { opacity: 1; }
      .star-btn.is-starred {
        opacity: 1;
        color: var(--warning, #d97706) !important;
      }
      .ws-avatar {
        display: flex; align-items: center; justify-content: center;
        border-radius: 0.25rem; font-weight: 700; color: #fff; flex-shrink: 0;
      }
      .section-label {
        font-size: 10px; font-weight: 600;
        letter-spacing: 0.1em; text-transform: uppercase;
        color: var(--sidebar-text-muted);
        padding: 0.25rem 0.75rem;
        display: flex; align-items: center; justify-content: space-between;
      }
      .skeleton {
        background: var(--sidebar-surface-hover);
        animation: pulse 1.5s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `,
  ],
  template: `
    @if (!collapsed()) {
      <div class="section-label mt-3 mb-1.5 uppercase tracking-wider">
        <span>All Projects</span>
      </div>

      @for (item of allData(); track item.workspace.id) {
        <!-- Workspace header (collapsible) -->
        <button (click)="toggleCollapse(item.workspace.id)"
                class="workspace-header">
          <i class="pi text-[10px] transition-transform duration-150"
             [class.pi-chevron-right]="isCollapsed(item.workspace.id)"
             [class.pi-chevron-down]="!isCollapsed(item.workspace.id)"
             [style.color]="'var(--sidebar-text-muted)'"
          ></i>
          <span class="ws-avatar w-5 h-5 text-[9px]"
                [style.background]="ctx.getWorkspaceColor(item.workspace.name)">
            {{ item.workspace.name.charAt(0).toUpperCase() }}
          </span>
          <span class="text-xs font-semibold truncate flex-1"
                style="color: var(--sidebar-text-secondary)">
            {{ item.workspace.name }}
          </span>
          <span class="text-[10px]" style="color: var(--sidebar-text-muted)">
            {{ item.projects.length }}
          </span>
        </button>

        <!-- Projects (collapsible) -->
        @if (!isCollapsed(item.workspace.id)) {
          <div class="overflow-hidden transition-all duration-150 ease-out">
            @if (item.loading) {
              @for (s of [1,2,3]; track s) {
                <div class="h-6 rounded mx-3 my-1 skeleton"></div>
              }
            } @else if (item.error) {
              <p class="text-[10px] px-3 py-1" style="color: var(--sidebar-text-muted)">
                Failed to load
              </p>
            } @else if (item.projects.length === 0) {
              <p class="text-[10px] px-3 py-1" style="color: var(--sidebar-text-muted)">
                No projects in {{ item.workspace.name }}
              </p>
            } @else {
              @for (project of item.projects; track project.id) {
                <a [routerLink]="['/workspace', item.workspace.id, 'project', project.id]"
                   routerLinkActive="active"
                   (click)="onProjectClick(item.workspace.id)"
                   class="project-item flex items-center gap-2 pl-8 pr-2 py-1 rounded-md text-xs cursor-pointer">
                  <span class="color-dot" [style.background]="ctx.getProjectColor(project.id)"></span>
                  <span class="truncate flex-1" style="color: var(--sidebar-text-secondary)">
                    {{ project.name }}
                  </span>
                  <button (click)="toggleStar(project.id); $event.preventDefault(); $event.stopPropagation()"
                          class="star-btn w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--sidebar-surface-active)]"
                          [class.is-starred]="isStarred(project.id)"
                          style="color: var(--sidebar-text-muted)"
                          [attr.aria-label]="isStarred(project.id) ? 'Unstar project' : 'Star project'">
                    <i [class]="isStarred(project.id) ? 'pi pi-star-fill text-[10px]' : 'pi pi-star text-[10px]'"></i>
                  </button>
                </a>
              }
            }
          </div>
        }
      }
    }
  `,
})
export class SidebarAllProjectsComponent {
  collapsed = input(false);
  navClick = output<void>();
  starChanged = output<void>();

  readonly ctx = inject(WorkspaceContextService);
  private readonly projectService = inject(ProjectService);
  private readonly favoritesService = inject(FavoritesService);

  readonly allData = signal<WorkspaceWithProjects[]>([]);
  private readonly collapsedState = signal<Record<string, boolean>>({});
  private readonly starredIds = signal<Set<string>>(new Set());

  constructor() {
    // Load collapsed state from localStorage
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.collapsedState.set(JSON.parse(raw));
    } catch { /* ignore corrupt data */ }

    // Load starred projects
    this.loadStarred();

    // Watch workspaces signal and load projects for each
    effect(() => {
      const workspaces = this.ctx.workspaces();
      if (workspaces.length === 0) {
        this.allData.set([]);
        return;
      }

      // Initialize with loading state
      this.allData.set(
        workspaces.map((ws) => ({
          workspace: ws,
          projects: [],
          loading: true,
          error: false,
        }))
      );

      // Load projects for each workspace in parallel
      const requests = workspaces.map((ws) =>
        this.projectService.listBoards(ws.id).pipe(
          catchError(() => of(null as Board[] | null))
        )
      );

      forkJoin(requests).subscribe((results) => {
        const data: WorkspaceWithProjects[] = workspaces.map((ws, i) => ({
          workspace: ws,
          projects: results[i] ?? [],
          loading: false,
          error: results[i] === null,
        }));
        this.allData.set(data);
      });
    });
  }

  isCollapsed(wsId: string): boolean {
    const state = this.collapsedState();
    if (wsId in state) return state[wsId];
    // Default: collapse all except active workspace
    return wsId !== this.ctx.activeWorkspaceId();
  }

  toggleCollapse(wsId: string): void {
    const current = { ...this.collapsedState() };
    current[wsId] = !this.isCollapsed(wsId);
    this.collapsedState.set(current);
    try { localStorage.setItem(LS_KEY, JSON.stringify(current)); } catch { /* ignore */ }
  }

  onProjectClick(wsId: string): void {
    if (wsId !== this.ctx.activeWorkspaceId()) {
      this.ctx.syncFromUrl(wsId);
    }
    this.navClick.emit();
  }

  isStarred(projectId: string): boolean {
    return this.starredIds().has(projectId);
  }

  toggleStar(projectId: string): void {
    if (this.isStarred(projectId)) {
      // Optimistic removal
      this.starredIds.update((prev) => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
      this.favoritesService.remove('board', projectId).subscribe({
        next: () => this.starChanged.emit(),
        error: () => this.loadStarred(),
      });
    } else {
      // Optimistic add
      this.starredIds.update((prev) => {
        const next = new Set(prev);
        next.add(projectId);
        return next;
      });
      this.favoritesService.add({ entity_type: 'board', entity_id: projectId }).subscribe({
        next: () => this.starChanged.emit(),
        error: () => this.loadStarred(),
      });
    }
  }

  private loadStarred(): void {
    this.favoritesService.list().subscribe((items) => {
      const ids = new Set(
        items.filter((f) => f.entity_type === 'board').map((f) => f.entity_id)
      );
      this.starredIds.set(ids);
    });
  }
}
