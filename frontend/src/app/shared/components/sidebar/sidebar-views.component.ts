import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  computed,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

interface ViewItem {
  icon: string;
  label: string;
  path: string;
}

@Component({
  selector: 'app-sidebar-views',
  standalone: true,
  imports: [RouterModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; }
      .view-item {
        transition: background var(--duration-fast) var(--ease-standard);
        position: relative;
      }
      .view-item:hover { background: var(--sidebar-surface-hover); }
      .view-item.active {
        background: var(--sidebar-surface-active);
        color: var(--sidebar-text-primary);
      }
      .view-item.active .nav-indicator { opacity: 1; }
      .nav-indicator {
        position: absolute; left: 0; top: 50%;
        transform: translateY(-50%);
        width: 3px; height: 16px;
        border-radius: 0 3px 3px 0;
        background: var(--primary); opacity: 0;
        transition: opacity var(--duration-fast) var(--ease-standard);
      }
      .section-label {
        font-size: 10px; font-weight: 600;
        letter-spacing: 0.1em; text-transform: uppercase;
        color: var(--sidebar-text-muted);
        padding: 0.25rem 0.75rem;
      }
      .collapsed-icon-btn {
        display: flex; align-items: center; justify-content: center;
        width: 100%; padding: 0.5rem 0;
        border-radius: 0.375rem;
        transition: background var(--duration-fast) var(--ease-standard);
      }
      .collapsed-icon-btn:hover { background: var(--sidebar-surface-hover); }
    `,
  ],
  template: `
    @if (!collapsed()) {
      <div class="section-label mt-1 mb-1.5">Views</div>
      <div class="space-y-0.5">
        @for (view of views(); track view.label) {
          <a [routerLink]="view.path"
             routerLinkActive="active"
             (click)="navClick.emit()"
             class="view-item flex items-center gap-3 px-3 py-2 rounded-md text-sm">
            <span class="nav-indicator"></span>
            <i class="pi {{ view.icon }} text-sm flex-shrink-0"
               style="color: var(--sidebar-text-muted)"></i>
            <span style="color: var(--sidebar-text-secondary)">{{ view.label }}</span>
          </a>
        }
      </div>
    } @else {
      <div class="space-y-0.5">
        @for (view of views(); track view.label) {
          <a [routerLink]="view.path"
             routerLinkActive="active"
             (click)="navClick.emit()"
             class="collapsed-icon-btn"
             [pTooltip]="view.label" tooltipPosition="right">
            <i class="pi {{ view.icon }} text-sm"
               style="color: var(--sidebar-text-muted)"></i>
          </a>
        }
      </div>
    }
  `,
})
export class SidebarViewsComponent {
  collapsed = input(false);
  navClick = output<void>();

  private readonly ctx = inject(WorkspaceContextService);

  views = computed<ViewItem[]>(() => {
    const wsId = this.ctx.activeWorkspaceId();
    if (!wsId) return [];
    const base = `/workspace/${wsId}`;
    return [
      { icon: 'pi-chart-bar', label: 'Portfolio', path: `${base}/portfolio` },
      { icon: 'pi-users', label: 'Manage', path: `${base}/manage` },
      { icon: 'pi-th-large', label: 'Eisenhower', path: `${base}/eisenhower` },
      { icon: 'pi-star', label: 'Favorites', path: `${base}/favorites` },
      { icon: 'pi-box', label: 'Archive', path: `${base}/archive` },
    ];
  });
}
