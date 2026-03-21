import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
  output,
  signal,
  ElementRef,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { SidebarProjectsComponent } from './sidebar-projects.component';
import { SidebarViewsComponent } from './sidebar-views.component';
import { SidebarAllProjectsComponent } from './sidebar-all-projects.component';
import { SidebarFooterComponent } from './sidebar-footer.component';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterModule,
    TooltipModule,
    SidebarProjectsComponent,
    SidebarAllProjectsComponent,
    SidebarViewsComponent,
    SidebarFooterComponent,
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
      .divider {
        height: 1px;
        background: var(--sidebar-border);
      }
      :host ::ng-deep a:focus-visible,
      :host ::ng-deep button:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: -2px;
        border-radius: 0.375rem;
      }
      .home-item {
        transition: background var(--duration-fast) var(--ease-standard);
        position: relative;
      }
      .home-item:hover { background: var(--sidebar-surface-hover); }
      .home-item.active {
        background: var(--sidebar-surface-active);
        color: var(--sidebar-text-primary);
      }
      .home-item.active .nav-indicator { opacity: 1; }
      .nav-indicator {
        position: absolute; left: 0; top: 50%;
        transform: translateY(-50%);
        width: 3px; height: 16px;
        border-radius: 0 3px 3px 0;
        background: var(--primary); opacity: 0;
        transition: opacity var(--duration-fast) var(--ease-standard);
      }
      .collapsed-home-btn {
        display: flex; align-items: center; justify-content: center;
        width: 100%; padding: 0.5rem 0;
        border-radius: 0.375rem;
        transition: background var(--duration-fast) var(--ease-standard);
      }
      .collapsed-home-btn:hover { background: var(--sidebar-surface-hover); }
    `,
  ],
  template: `
    <aside class="sidebar-root h-full flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
           role="navigation"
           aria-label="Main navigation"
           tabindex="-1"
           (keydown)="onSidebarKeydown($event)"
           [class.w-64]="!collapsed()"
           [class.w-14]="collapsed()"
           [class.sidebar-open]="isMobileOpen()">

      <!-- Projects + Views (scrollable) -->
      <div class="flex-1 overflow-y-auto sidebar-scrollbar px-2 py-2">
        @if (!collapsed()) {
          <a [routerLink]="dashboardRoute()"
             routerLinkActive="active"
             [routerLinkActiveOptions]="{ exact: true }"
             (click)="onNavClick()"
             class="home-item flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-2">
            <span class="nav-indicator"></span>
            <i class="pi pi-home text-sm flex-shrink-0"
               style="color: var(--sidebar-text-muted)"></i>
            <span style="color: var(--sidebar-text-secondary)">Home</span>
          </a>
        } @else {
          <a [routerLink]="dashboardRoute()"
             routerLinkActive="active"
             [routerLinkActiveOptions]="{ exact: true }"
             (click)="onNavClick()"
             class="collapsed-home-btn mb-1"
             pTooltip="Home" tooltipPosition="right">
            <i class="pi pi-home text-sm"
               style="color: var(--sidebar-text-muted)"></i>
          </a>
        }

        <app-sidebar-projects
          [collapsed]="collapsed()"
          (navClick)="onNavClick()" />

        <div class="divider my-2 mx-1"></div>

        <app-sidebar-all-projects
          [collapsed]="collapsed()"
          (navClick)="onNavClick()" />

        <div class="divider my-2 mx-1"></div>

        <app-sidebar-views
          [collapsed]="collapsed()"
          (navClick)="onNavClick()" />
      </div>

      <!-- Collapse toggle (bottom) -->
      <div class="flex-shrink-0 px-2 py-1"
           [class.justify-end]="!collapsed()"
           [class.justify-center]="collapsed()">
        <button
          (click)="toggleCollapse.emit()"
          class="hidden md:flex items-center justify-center w-full h-7 rounded-md hover:bg-[var(--sidebar-surface-hover)] transition-colors"
          style="color: var(--sidebar-text-secondary)"
          [title]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          <i class="pi text-xs"
             [class.pi-angle-double-right]="collapsed()"
             [class.pi-angle-double-left]="!collapsed()"></i>
          @if (!collapsed()) {
            <span class="text-xs ml-2" style="color: var(--sidebar-text-muted)">Collapse</span>
          }
        </button>
      </div>

      <!-- Zone 4: Footer -->
      <app-sidebar-footer
        [collapsed]="collapsed()"
        (toggleCollapse)="toggleCollapse.emit()" />
    </aside>
  `,
})
export class SidebarComponent {
  collapsed = input(false);
  isMobileOpen = input(false);
  toggleCollapse = output<void>();
  sidebarClose = output<void>();
  searchOpen = output<void>();

  private readonly elementRef = inject(ElementRef);
  private readonly ctx = inject(WorkspaceContextService);
  readonly dashboardRoute = computed(() => {
    const wsId = this.ctx.activeWorkspaceId();
    return wsId ? `/workspace/${wsId}/dashboard` : '/dashboard';
  });
  readonly focusIndex = signal(-1);

  onNavClick(): void {
    if (this.isMobileOpen()) {
      this.sidebarClose.emit();
    }
  }

  onSidebarKeydown(event: KeyboardEvent): void {
    const nativeEl = this.elementRef.nativeElement as HTMLElement;
    const focusableItems: HTMLElement[] = Array.from(
      nativeEl.querySelectorAll(
        'a[routerLink], button.collapsed-icon-btn, button.nav-item'
      )
    );

    if (focusableItems.length === 0) {
      return;
    }

    const currentIndex = focusableItems.findIndex(
      (el) => el === document.activeElement
    );

    let nextIndex: number;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'ArrowUp':
        event.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableItems.length - 1;
        break;
      case 'Home':
        event.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        nextIndex = focusableItems.length - 1;
        break;
      case 'Escape':
        event.preventDefault();
        this.focusIndex.set(-1);
        (document.querySelector('main') as HTMLElement)?.focus();
        return;
      default:
        return;
    }

    this.focusIndex.set(nextIndex);
    focusableItems[nextIndex].focus();
  }
}
