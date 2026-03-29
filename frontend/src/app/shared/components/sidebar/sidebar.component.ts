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
        background: linear-gradient(
          180deg,
          color-mix(in srgb, var(--sidebar-bg) 88%, white) 0%,
          var(--sidebar-bg) 30%,
          color-mix(in srgb, var(--sidebar-bg) 92%, black) 70%,
          color-mix(in srgb, var(--sidebar-bg) 80%, black) 100%
        );
        position: relative;
        overflow: hidden;
      }
      /* Sidebar content above overlays */
      .sidebar-root > :not(.sidebar-overlay) {
        position: relative;
        z-index: 1;
      }
      /* Shared overlay base */
      .sidebar-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
      }

      /* --- A: Topographic — faint concentric rings --- */
      :host-context([data-bg-pattern="topographic"]) .sidebar-overlay {
        opacity: 0.35;
        background-image:
          repeating-radial-gradient(circle at 80% 20%, transparent 0, transparent 30px, rgba(255,255,255,0.05) 31px, transparent 32px),
          repeating-radial-gradient(circle at 20% 80%, transparent 0, transparent 50px, rgba(255,255,255,0.03) 51px, transparent 52px);
      }
      :host-context([data-bg-pattern="topographic"]) .sidebar-root::before {
        content: '';
        position: absolute; top: -20%; right: -30%; width: 100%; height: 70%;
        background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 55%);
        pointer-events: none;
      }

      /* --- B: Constellation — sparse dots --- */
      :host-context([data-bg-pattern="constellation"]) .sidebar-overlay {
        opacity: 0.3;
        background-image:
          radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 0.7px, transparent 0),
          radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 0.4px, transparent 0);
        background-size: 60px 60px, 30px 30px;
        animation: constellationSidebar 50s linear infinite;
      }
      :host-context([data-bg-pattern="constellation"]) .sidebar-root::before {
        content: '';
        position: absolute; bottom: -10%; left: -20%; width: 80%; height: 60%;
        background: radial-gradient(circle, rgba(0,0,0,0.06) 0%, transparent 55%);
        pointer-events: none;
      }
      @keyframes constellationSidebar {
        0% { background-position: 0 0, 10px 10px; }
        100% { background-position: 60px 60px, 70px 70px; }
      }

      /* --- C: Aurora — subtle diagonal gradient + soft glow --- */
      :host-context([data-bg-pattern="aurora"]) .sidebar-root {
        background: linear-gradient(
          155deg,
          color-mix(in srgb, var(--sidebar-bg) 90%, white) 0%,
          var(--sidebar-bg) 30%,
          color-mix(in srgb, var(--sidebar-bg) 88%, black) 70%,
          color-mix(in srgb, var(--sidebar-bg) 75%, black) 100%
        );
      }
      :host-context([data-bg-pattern="aurora"]) .sidebar-overlay {
        opacity: 0.2;
        background: conic-gradient(
          from 180deg at 50% 100%,
          rgba(255,255,255,0.06),
          transparent 40%,
          rgba(255,255,255,0.04) 60%,
          transparent
        );
      }
      :host-context([data-bg-pattern="aurora"]) .sidebar-root::before {
        content: '';
        position: absolute; top: -40%; right: -40%; width: 120%; height: 120%;
        background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 50%);
        pointer-events: none;
      }

      /* --- D: Blueprint — whisper-thin grid --- */
      :host-context([data-bg-pattern="blueprint"]) .sidebar-overlay {
        opacity: 0.2;
        background-image:
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
        background-size: 60px 60px;
      }
      :host-context([data-bg-pattern="blueprint"]) .sidebar-root::before {
        content: '';
        position: absolute; inset: 0;
        background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.05) 100%);
        pointer-events: none;
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
      .sidebar-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(100, 116, 139, 0.2) transparent;
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
      .home-item.active .pi { color: var(--primary) !important; }
      .nav-indicator {
        position: absolute; left: 0; top: 50%;
        transform: translateY(-50%);
        width: 3px; height: 16px;
        border-radius: 0 3px 3px 0;
        background: var(--primary); opacity: 0;
        box-shadow: 0 0 8px color-mix(in srgb, var(--primary) 40%, transparent);
        transition: opacity var(--duration-fast) var(--ease-standard);
      }
      .collapsed-home-btn {
        display: flex; align-items: center; justify-content: center;
        width: 100%; padding: 0.5rem 0;
        border-radius: 0.375rem;
        transition: background var(--duration-fast) var(--ease-standard);
      }
      .collapsed-home-btn:hover { background: var(--sidebar-surface-hover); }
      .sidebar-label {
        transition: opacity 200ms ease, max-width 200ms ease;
        overflow: hidden;
        white-space: nowrap;
        opacity: 1;
        max-width: 200px;
      }
      .sidebar-collapsed .sidebar-label {
        opacity: 0;
        max-width: 0;
        pointer-events: none;
      }
      .collapse-icon {
        transition: transform 200ms ease;
      }
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
           [class.sidebar-collapsed]="collapsed()"
           [class.sidebar-open]="isMobileOpen()">

      <!-- Abstract background overlay (styled per theme group via :host-context) -->
      <div class="sidebar-overlay"></div>

      <!-- Projects + Views (scrollable) -->
      <div class="flex-1 overflow-y-auto sidebar-scrollbar px-2 py-2">
        <a [routerLink]="dashboardRoute()"
           routerLinkActive="active"
           [routerLinkActiveOptions]="{ exact: true }"
           (click)="onNavClick()"
           class="home-item flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-2"
           [class.justify-center]="collapsed()"
           [pTooltip]="collapsed() ? 'Home' : ''" tooltipPosition="right">
          <span class="nav-indicator"></span>
          <i class="pi pi-home text-sm flex-shrink-0"
             style="color: var(--sidebar-text-muted)"></i>
          <span class="sidebar-label" style="color: var(--sidebar-text-secondary)">Home</span>
        </a>

        <a routerLink="/discover"
           routerLinkActive="active"
           [routerLinkActiveOptions]="{ exact: true }"
           (click)="onNavClick()"
           class="home-item flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-2"
           [class.justify-center]="collapsed()"
           [pTooltip]="collapsed() ? 'Discover' : ''" tooltipPosition="right">
          <span class="nav-indicator"></span>
          <i class="pi pi-compass text-sm flex-shrink-0"
             style="color: var(--sidebar-text-muted)"></i>
          <span class="sidebar-label" style="color: var(--sidebar-text-secondary)">Discover</span>
        </a>

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
          [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          <i class="pi pi-angle-double-left text-xs collapse-icon" aria-hidden="true"
             [style.transform]="collapsed() ? 'rotate(180deg)' : 'rotate(0)'"></i>
          <span class="sidebar-label text-xs ml-2" style="color: var(--sidebar-text-muted)">Collapse</span>
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
