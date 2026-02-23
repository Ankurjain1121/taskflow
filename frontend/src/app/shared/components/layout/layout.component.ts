import {
  Component,
  inject,
  signal,
  HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { BreadcrumbsComponent } from '../breadcrumbs/breadcrumbs.component';
import { AuthService } from '../../../core/services/auth.service';
import {
  ThemeService,
  Theme,
  AccentColor,
  ACCENT_PRESETS,
} from '../../../core/services/theme.service';
import { TooltipModule } from 'primeng/tooltip';
import { PopoverModule } from 'primeng/popover';

@Component({
  selector: 'app-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SidebarComponent,
    RouterOutlet,
    NotificationBellComponent,
    BreadcrumbsComponent,
    TooltipModule,
    PopoverModule,
  ],
  styles: [
    `
      .layout-header {
        height: 48px;
        background: var(--background);
        border-bottom: 1px solid var(--border);
      }
      .theme-toggle {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.375rem;
        color: var(--muted-foreground);
        transition:
          color 0.15s ease,
          background-color 0.15s ease;
        cursor: pointer;
        border: none;
        background: transparent;
      }
      .theme-toggle:hover {
        color: var(--foreground);
        background: var(--muted);
      }
    `,
  ],
  template: `
    <div
      class="flex h-screen overflow-hidden"
      style="background: var(--background)"
    >
      <!-- Mobile backdrop overlay -->
      @if (mobileOpen()) {
        <div
          class="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
          (click)="closeMobileSidebar()"
        ></div>
      }

      <!-- Mobile sidebar backdrop -->
      @if (isMobileSidebarOpen()) {
        <div
          class="sidebar-backdrop md:hidden"
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
        <!-- Header -->
        <header
          class="layout-header flex items-center gap-3 px-4 flex-shrink-0"
        >
          <!-- Mobile hamburger (visible on mobile only) -->
          <button
            class="p-1.5 rounded-md transition-colors md:hidden"
            style="color: var(--muted-foreground)"
            (click)="openMobileSidebar()"
          >
            <i class="pi pi-bars" style="font-size: 1.125rem;"></i>
          </button>

          <!-- Breadcrumbs -->
          <div class="flex-1 min-w-0">
            <app-breadcrumbs />
          </div>

          <!-- Right-side actions -->
          <div class="flex items-center gap-2">
            <app-notification-bell />

            <!-- Theme popover trigger -->
            <button
              class="theme-toggle"
              (click)="themePanel.toggle($event)"
              pTooltip="Theme"
              tooltipPosition="bottom"
            >
              <i [class]="themeIcon()"></i>
            </button>
            <p-popover #themePanel>
              <div class="p-3 space-y-3" style="min-width: 220px">
                <!-- Mode -->
                <div>
                  <div
                    class="text-xs font-semibold uppercase tracking-wider mb-2"
                    style="color: var(--muted-foreground)"
                  >
                    Mode
                  </div>
                  <div class="flex gap-1.5">
                    @for (option of themeOptions; track option.value) {
                      <button
                        (click)="setTheme(option.value)"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all border"
                        [style.border-color]="
                          currentTheme() === option.value
                            ? 'var(--primary)'
                            : 'var(--border)'
                        "
                        [style.background]="
                          currentTheme() === option.value
                            ? 'var(--muted)'
                            : 'transparent'
                        "
                        [style.color]="
                          currentTheme() === option.value
                            ? 'var(--primary)'
                            : 'var(--foreground)'
                        "
                      >
                        <i [class]="option.icon" style="font-size: 0.75rem"></i>
                        {{ option.label }}
                      </button>
                    }
                  </div>
                </div>
                <!-- Accent color -->
                <div
                  style="
                    border-top: 1px solid var(--border);
                    padding-top: 0.75rem;
                  "
                >
                  <div
                    class="text-xs font-semibold uppercase tracking-wider mb-2"
                    style="color: var(--muted-foreground)"
                  >
                    Accent
                  </div>
                  <div class="flex gap-2 flex-wrap">
                    @for (a of accentPresets; track a.value) {
                      <button
                        class="w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center"
                        [style.background]="a.color"
                        [style.border-color]="
                          currentAccent() === a.value
                            ? 'var(--foreground)'
                            : 'transparent'
                        "
                        [style.transform]="
                          currentAccent() === a.value
                            ? 'scale(1.15)'
                            : 'scale(1)'
                        "
                        (click)="setAccent(a.value)"
                        [pTooltip]="a.label"
                        tooltipPosition="bottom"
                      >
                        @if (currentAccent() === a.value) {
                          <i
                            class="pi pi-check text-white"
                            style="font-size: 0.6rem"
                          ></i>
                        }
                      </button>
                    }
                  </div>
                </div>
                <!-- More themes link -->
                <div
                  style="
                    border-top: 1px solid var(--border);
                    padding-top: 0.75rem;
                  "
                >
                  <button
                    class="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all border"
                    style="border-color: var(--border); color: var(--muted-foreground)"
                    (click)="goToThemes(); themePanel.hide()"
                  >
                    <i class="pi pi-palette" style="font-size: 0.75rem"></i>
                    More themes...
                  </button>
                </div>
              </div>
            </p-popover>

            <!-- User avatar + name (no duplicate of sidebar user) -->
            <div
              class="hidden sm:flex items-center gap-2 pl-2 ml-1"
              style="border-left: 1px solid var(--border)"
            >
              <span
                class="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
              >
                {{ getUserInitials() }}
              </span>
              <span
                class="text-sm font-medium truncate max-w-[120px]"
                style="color: var(--foreground)"
              >
                {{ currentUser()?.name }}
              </span>
            </div>
          </div>
        </header>

        <!-- Page content -->
        <main class="flex-1 overflow-auto">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class LayoutComponent {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;

  isMobileSidebarOpen = signal(false);

  currentTheme = this.themeService.theme;
  currentAccent = this.themeService.accent;
  isDark = this.themeService.isDark;
  accentPresets = ACCENT_PRESETS;

  themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: 'pi pi-sun' },
    { value: 'dark', label: 'Dark', icon: 'pi pi-moon' },
    { value: 'system', label: 'System', icon: 'pi pi-desktop' },
  ];

  themeIcon = () => {
    const t = this.themeService.theme();
    if (t === 'light') return 'pi pi-sun';
    if (t === 'dark') return 'pi pi-moon';
    return 'pi pi-desktop';
  };

  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  setAccent(accent: AccentColor): void {
    this.themeService.setAccent(accent);
  }

  goToThemes(): void {
    this.router.navigate(['/settings/appearance']);
  }

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

  onSearchOpen(): void {
    // Will be connected to global search when implemented
  }

  getSidebarClasses(): string {
    if (this.isMobile()) {
      return this.mobileOpen()
        ? 'fixed inset-y-0 left-0 translate-x-0'
        : 'fixed inset-y-0 left-0 -translate-x-full';
    }
    return 'relative';
  }

  getUserInitials(): string {
    const name = this.currentUser()?.name;
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }
}
