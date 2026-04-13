import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';
import { FavoritesService, FavoriteItem } from '../../../core/services/favorites.service';
import { Board } from '../../../core/services/project.service';

@Component({
  selector: 'app-sidebar-projects',
  standalone: true,
  imports: [RouterModule, TooltipModule, DragDropModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; }
      .project-item {
        transition: background var(--duration-fast) var(--ease-standard);
        position: relative;
      }
      .project-item:hover { background: var(--sidebar-surface-hover); }
      .project-item.active { background: var(--sidebar-surface-active); }
      .project-item.active .nav-indicator { opacity: 1; }
      .nav-indicator {
        position: absolute; left: 0; top: 50%;
        transform: translateY(-50%);
        width: 3px; height: 16px;
        border-radius: 0 3px 3px 0;
        background: var(--primary); opacity: 0;
        transition: opacity var(--duration-fast) var(--ease-standard);
      }
      .color-dot {
        width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      }
      .section-label {
        font-size: 10px; font-weight: 600;
        letter-spacing: 0.1em; text-transform: uppercase;
        color: var(--sidebar-text-muted);
        padding: 0.25rem 0.75rem;
        display: flex; align-items: center; justify-content: space-between;
      }
      .collapsed-dot {
        display: flex; align-items: center; justify-content: center;
        width: 100%; padding: 0.375rem 0;
        border-radius: 0.375rem;
        transition: background var(--duration-fast) var(--ease-standard);
      }
      .collapsed-dot:hover { background: var(--sidebar-surface-hover); }
      .sidebar-label {
        transition: opacity 200ms ease, max-width 200ms ease;
        overflow: hidden;
        white-space: nowrap;
        opacity: 1;
        max-width: 200px;
      }
      :host-context(.sidebar-collapsed) .sidebar-label {
        opacity: 0;
        max-width: 0;
        pointer-events: none;
      }
      .unstar-btn {
        opacity: 0;
        transition: opacity 120ms ease;
      }
      .group:hover .unstar-btn { opacity: 1; }
      .empty-hint {
        color: var(--sidebar-text-muted);
        font-size: 11px;
        line-height: 1.4;
      }
      .cdk-drag-preview {
        background: var(--sidebar-bg);
        border-radius: 0.375rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        opacity: 0.9;
      }
      .cdk-drag-placeholder { opacity: 0.3; }
    `,
  ],
  template: `
    <div class="section-label mt-1 mb-1.5 sidebar-label uppercase tracking-wider">
      <span>Starred</span>
    </div>

    @if (!collapsed()) {
      @if (starredProjects().length === 0) {
        <div class="px-3 py-3">
          <p class="empty-hint">
            Star projects from <span style="font-weight: 600">All Projects</span> below to pin them here.
          </p>
        </div>
      } @else {
        <div cdkDropList (cdkDropListDropped)="onDrop($event)" class="space-y-0.5 transition-opacity duration-150">
          @for (project of starredProjects(); track project.id) {
            <div cdkDrag class="group">
              <a [routerLink]="['/workspace', ctx.activeWorkspaceId(), 'project', project.id]"
                 routerLinkActive="active"
                 (click)="navClick.emit()"
                 class="project-item flex items-center gap-2.5 px-3 h-8 rounded-md text-sm cursor-pointer w-full">
                <span class="nav-indicator"></span>
                <span class="color-dot" [style.background]="ctx.getProjectColor(project.id)"></span>
                <span class="truncate flex-1 text-[13px]" style="color: var(--sidebar-text-secondary)">
                  {{ project.name }}
                </span>
                <button (click)="unstar(project); $event.preventDefault(); $event.stopPropagation()"
                        class="unstar-btn w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--sidebar-surface-active)] transition-colors"
                        style="color: var(--warning, #d97706)"
                        [pTooltip]="'Unstar'" tooltipPosition="right"
                        aria-label="Remove from starred">
                  <i class="pi pi-star-fill text-[10px]"></i>
                </button>
              </a>
            </div>
          }
        </div>
      }
    } @else {
      @for (project of starredProjects(); track project.id) {
        <a [routerLink]="['/workspace', ctx.activeWorkspaceId(), 'project', project.id]"
           routerLinkActive="active"
           class="collapsed-dot"
           [pTooltip]="project.name" tooltipPosition="right">
          <span class="color-dot" [style.background]="ctx.getProjectColor(project.id)"></span>
        </a>
      }
    }
  `,
})
export class SidebarProjectsComponent implements OnInit, OnDestroy {
  collapsed = input(false);
  navClick = output<void>();

  readonly ctx = inject(WorkspaceContextService);
  private readonly favoritesService = inject(FavoritesService);

  private readonly destroy$ = new Subject<void>();
  readonly favorites = signal<FavoriteItem[]>([]);

  /** Only board-type favorites that exist in current workspace projects */
  readonly starredProjects = computed(() => {
    const favs = this.favorites();
    const projects = this.ctx.getOrderedProjects();
    const favBoardIds = new Set(
      favs.filter((f) => f.entity_type === 'board').map((f) => f.entity_id)
    );
    return projects.filter((p) => favBoardIds.has(p.id));
  });

  ngOnInit(): void {
    this.loadFavorites();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadFavorites(): void {
    this.favoritesService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => this.favorites.set(items));
  }

  unstar(project: Board): void {
    // Optimistic removal
    this.favorites.update((prev) =>
      prev.filter((f) => !(f.entity_type === 'board' && f.entity_id === project.id))
    );
    this.favoritesService
      .remove('board', project.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: () => this.loadFavorites(), // revert on failure
      });
  }

  /** Called from ALL PROJECTS component when a project is starred */
  addStarredProject(projectId: string): void {
    this.favoritesService
      .add({ entity_type: 'board', entity_id: projectId })
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadFavorites());
  }

  onDrop(event: CdkDragDrop<Board[]>): void {
    const items = [...this.starredProjects()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    // Persist reorder if needed in the future
  }
}
