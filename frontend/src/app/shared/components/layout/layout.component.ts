import {
  Component,
  inject,
  signal,
  HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopNavComponent } from '../top-nav/top-nav.component';
import { GlobalSearchComponent } from '../global-search/global-search.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SidebarComponent,
    RouterOutlet,
    TopNavComponent,
    GlobalSearchComponent,
  ],
  styles: [
    `
      .sidebar-wrapper {
        top: 48px;
        height: calc(100vh - 48px);
      }
    `,
  ],
  template: `
    <!-- Top Navigation Bar -->
    <app-top-nav
      (menuToggle)="openMobileSidebar()"
      (searchOpen)="onSearchOpen()"
      (quickCreate)="onQuickCreate()"
    />

    <div
      class="flex pt-12 h-screen overflow-hidden"
      style="background: var(--background)"
    >
      <!-- Mobile backdrop overlay -->
      @if (mobileOpen()) {
        <div
          class="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
          style="top: 48px"
          (click)="closeMobileSidebar()"
        ></div>
      }

      <!-- Sidebar wrapper -->
      <div
        class="flex-shrink-0 z-40 transition-all duration-300 ease-in-out"
        [class]="getSidebarClasses()"
      >
        <app-sidebar
          [collapsed]="sidebarCollapsed()"
          [isMobileOpen]="isMobileSidebarOpen()"
          (toggleCollapse)="onToggleSidebar()"
          (sidebarClose)="closeMobileSidebar()"
          (searchOpen)="onSearchOpen()"
        />
      </div>

      <!-- Main content area -->
      <div class="flex-1 flex flex-col overflow-hidden min-w-0">
        <!-- Page content -->
        <main class="flex-1 overflow-auto">
          <router-outlet />
        </main>
      </div>
    </div>

    <!-- Global Search / Command Palette -->
    <app-global-search [isOpen]="searchOpen()" (closed)="onSearchClose()" />
  `,
})
export class LayoutComponent {
  isMobileSidebarOpen = signal(false);

  sidebarCollapsed = signal(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('taskflow_sidebar_collapsed') === 'true'
      : false,
  );

  mobileOpen = signal(false);

  private isMobile = signal(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  @HostListener('window:resize')
  onResize(): void {
    const mobile = window.innerWidth < 768;
    this.isMobile.set(mobile);
    if (!mobile && this.mobileOpen()) {
      this.mobileOpen.set(false);
      this.isMobileSidebarOpen.set(false);
    }
  }

  onToggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileOpen.update((v) => !v);
      this.isMobileSidebarOpen.set(this.mobileOpen());
    } else {
      this.sidebarCollapsed.update((v) => {
        const next = !v;
        localStorage.setItem('taskflow_sidebar_collapsed', String(next));
        return next;
      });
    }
  }

  openMobileSidebar(): void {
    this.mobileOpen.set(true);
    this.isMobileSidebarOpen.set(true);
  }

  closeMobileSidebar(): void {
    this.mobileOpen.set(false);
    this.isMobileSidebarOpen.set(false);
  }

  searchOpen = signal(false);

  onSearchOpen(): void {
    this.searchOpen.set(true);
  }

  onSearchClose(): void {
    this.searchOpen.set(false);
  }

  onQuickCreate(): void {
    // Quick create task - will be connected to a task creation dialog
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    // Ctrl+K (Windows/Linux) or Cmd+K (Mac) to toggle search
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      this.searchOpen.update((v) => !v);
    }
  }

  getSidebarClasses(): string {
    if (this.isMobile()) {
      return this.mobileOpen()
        ? 'sidebar-wrapper fixed left-0 translate-x-0'
        : 'sidebar-wrapper fixed left-0 -translate-x-full';
    }
    return 'relative';
  }
}
