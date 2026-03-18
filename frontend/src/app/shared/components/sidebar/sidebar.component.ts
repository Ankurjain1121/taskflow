import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  ElementRef,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { NotificationService } from '../../../core/services/notification.service';
import { SidebarNavItemComponent } from './sidebar-nav-item.component';
import { WorkspaceSwitcherComponent } from './workspace-switcher.component';
import { SidebarProjectsComponent } from './sidebar-projects.component';
import { SidebarViewsComponent } from './sidebar-views.component';
import { SidebarFooterComponent } from './sidebar-footer.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterModule,
    TooltipModule,
    SidebarNavItemComponent,
    WorkspaceSwitcherComponent,
    SidebarProjectsComponent,
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

      <!-- Zone 1: Workspace Switcher -->
      <app-workspace-switcher
        [collapsed]="collapsed()"
        (toggleCollapse)="toggleCollapse.emit()" />

      <!-- Zone 2: Primary Nav -->
      <div class="px-2 py-2 space-y-0.5">
        <app-sidebar-nav-item
          icon="pi-home" label="Home" route="/dashboard"
          [collapsed]="collapsed()" [exactMatch]="true"
          (navClick)="onNavClick()" />
        <app-sidebar-nav-item
          icon="pi-clipboard" label="My Work" route="/my-tasks"
          [collapsed]="collapsed()"
          (navClick)="onNavClick()" />
        <app-sidebar-nav-item
          icon="pi-inbox" label="Inbox" route="/inbox"
          [collapsed]="collapsed()" [badge]="unreadCount()"
          (navClick)="onNavClick()" />
      </div>

      <div class="divider mx-2"></div>

      <!-- Zone 3: Projects + Views (scrollable) -->
      <div class="flex-1 overflow-y-auto sidebar-scrollbar px-2 py-2">
        <app-sidebar-projects
          [collapsed]="collapsed()"
          (navClick)="onNavClick()" />

        <div class="divider my-2 mx-1"></div>

        <app-sidebar-views
          [collapsed]="collapsed()"
          (navClick)="onNavClick()" />
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

  private readonly notificationService = inject(NotificationService);
  private readonly elementRef = inject(ElementRef);
  readonly unreadCount = this.notificationService.unreadCount;
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
