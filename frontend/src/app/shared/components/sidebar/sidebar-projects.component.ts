import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';
import { FavoritesService } from '../../../core/services/favorites.service';
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
      .skeleton {
        background: var(--sidebar-surface-hover);
        animation: pulse 1.5s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .menu-overlay {
        background: var(--surface-overlay);
        border: 1px solid var(--sidebar-border);
      }
      .menu-item:hover { background: var(--sidebar-surface-hover); }
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
    @if (!collapsed()) {
      <div class="section-label mt-1 mb-1.5">
        <span>Projects</span>
      </div>
    }

    @if (ctx.loading()) {
      <div class="px-3 space-y-2 py-1">
        @for (i of skeletons; track i) {
          <div class="h-7 rounded bg-[var(--sidebar-surface)] animate-pulse"
               [class]="skeletonWidths[i - 1]"></div>
        }
      </div>
    } @else if (projects().length === 0) {
      @if (!collapsed()) {
        <div class="px-3 py-4 text-center">
          <p class="text-xs" style="color: var(--sidebar-text-muted)">No projects</p>
          <button (click)="createProject()"
                  class="mt-2 text-xs text-primary hover:brightness-90 transition-colors">
            Create Project
          </button>
        </div>
      }
    } @else {
      @if (!collapsed()) {
        <div cdkDropList (cdkDropListDropped)="onDrop($event)" class="space-y-0.5 transition-opacity duration-150">
          @for (project of projects(); track project.id) {
            <div cdkDrag class="group">
              <a [routerLink]="['/workspace', ctx.activeWorkspaceId(), 'project', project.id]"
                 routerLinkActive="active"
                 (click)="navClick.emit()"
                 class="project-item flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm cursor-pointer">
                <span class="nav-indicator"></span>
                <span class="color-dot" [style.background]="ctx.getProjectColor(project.id)"></span>
                <span class="truncate flex-1" style="color: var(--sidebar-text-secondary)">
                  {{ project.name }}
                </span>
                <!-- Hover actions -->
                <span class="hidden group-hover:flex items-center gap-1">
                  <button (click)="toggleFavorite(project); $event.preventDefault(); $event.stopPropagation()"
                          class="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--sidebar-surface-active)] transition-colors"
                          style="color: var(--sidebar-text-muted)">
                    <i class="pi pi-star text-[10px]"></i>
                  </button>
                  <button (click)="openMenu(project, $event)"
                          class="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--sidebar-surface-active)] transition-colors"
                          style="color: var(--sidebar-text-muted)">
                    <i class="pi pi-ellipsis-h text-[10px]"></i>
                  </button>
                </span>
              </a>
            </div>
          }
        </div>
      } @else {
        <div class="space-y-0.5">
          @for (project of projects(); track project.id) {
            <a [routerLink]="['/workspace', ctx.activeWorkspaceId(), 'project', project.id]"
               routerLinkActive="active"
               class="collapsed-dot"
               [pTooltip]="project.name" tooltipPosition="right">
              <span class="color-dot" [style.background]="ctx.getProjectColor(project.id)"></span>
            </a>
          }
        </div>
      }
    }

    <!-- Context menu -->
    @if (menuProject()) {
      <div class="fixed inset-0 z-10" (click)="closeMenu()"></div>
      <div class="menu-overlay fixed z-20 rounded-lg shadow-lg py-1 w-40"
           [style.top.px]="menuPos().y" [style.left.px]="menuPos().x">
        <button (click)="openProject(menuProject()!)"
                class="menu-item w-full flex items-center gap-2 px-3 py-1.5 text-sm"
                style="color: var(--sidebar-text-secondary)">
          <i class="pi pi-external-link text-xs"></i> Open
        </button>
        <button (click)="copyLink(menuProject()!)"
                class="menu-item w-full flex items-center gap-2 px-3 py-1.5 text-sm"
                style="color: var(--sidebar-text-secondary)">
          <i class="pi pi-copy text-xs"></i> Copy Link
        </button>
        <button (click)="archiveProject(menuProject()!)"
                class="menu-item w-full flex items-center gap-2 px-3 py-1.5 text-sm"
                style="color: var(--sidebar-text-secondary)">
          <i class="pi pi-box text-xs"></i> Archive
        </button>
      </div>
    }
  `,
})
export class SidebarProjectsComponent {
  collapsed = input(false);
  navClick = output<void>();

  readonly ctx = inject(WorkspaceContextService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly router = inject(Router);

  readonly skeletons = [1, 2, 3, 4];
  readonly skeletonWidths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-3/5'];
  menuProject = signal<Board | null>(null);
  menuPos = signal({ x: 0, y: 0 });

  projects = computed(() => this.ctx.getOrderedProjects());

  onDrop(event: CdkDragDrop<Board[]>): void {
    const items = [...this.projects()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.ctx.saveProjectOrder(items.map((p) => p.id));
  }

  toggleFavorite(project: Board): void {
    this.favoritesService.add({ entity_type: 'board', entity_id: project.id }).subscribe();
  }

  openMenu(project: Board, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuProject.set(project);
    this.menuPos.set({ x: event.clientX, y: event.clientY });
  }

  closeMenu(): void {
    this.menuProject.set(null);
  }

  openProject(project: Board): void {
    this.closeMenu();
    this.router.navigate(['/workspace', this.ctx.activeWorkspaceId(), 'project', project.id]);
  }

  copyLink(project: Board): void {
    this.closeMenu();
    const url = `${window.location.origin}/workspace/${this.ctx.activeWorkspaceId()}/project/${project.id}`;
    navigator.clipboard.writeText(url);
  }

  archiveProject(_project: Board): void {
    this.closeMenu();
    // Archive handled by project service — future implementation
  }

  createProject(): void {
    const wsId = this.ctx.activeWorkspaceId();
    if (wsId) {
      this.router.navigate(['/workspace', wsId], { queryParams: { newProject: true } });
    }
  }
}
