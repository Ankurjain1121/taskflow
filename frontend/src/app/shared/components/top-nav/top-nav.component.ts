import {
  Component,
  inject,
  computed,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { PopoverModule } from 'primeng/popover';
import { MenuItem } from 'primeng/api';
import { BreadcrumbsComponent } from '../breadcrumbs/breadcrumbs.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { AuthService } from '../../../core/services/auth.service';
import {
  ThemeService,
  Theme,
  AccentColor,
  ACCENT_PRESETS,
} from '../../../core/services/theme.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
    AvatarModule,
    MenuModule,
    PopoverModule,
    BreadcrumbsComponent,
    NotificationBellComponent,
  ],
  styles: [
    `
      :host {
        display: block;
      }

      .top-nav {
        height: 48px;
        background: var(--card);
        border-bottom: 1px solid var(--border);
        z-index: 40;
      }

      .search-trigger {
        border: 1px solid var(--border);
        background: var(--background);
        color: var(--muted-foreground);
        transition:
          background 0.15s ease,
          border-color 0.15s ease;
      }
      .search-trigger:hover {
        background: var(--muted);
        border-color: var(--muted-foreground);
      }

      .nav-icon-btn {
        color: var(--muted-foreground);
        transition:
          color 0.15s ease,
          background-color 0.15s ease;
      }
      .nav-icon-btn:hover {
        color: var(--foreground);
        background: var(--muted);
      }

      .theme-swatch {
        transition:
          transform 0.15s ease,
          border-color 0.15s ease;
      }
    `,
  ],
  template: `
    <nav
      class="top-nav fixed top-0 left-0 right-0 flex items-center px-4 gap-3"
    >
      <!-- Left: Mobile hamburger + Breadcrumbs -->
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <button
          class="nav-icon-btn lg:hidden p-1.5 rounded-md"
          (click)="menuToggle.emit()"
          aria-label="Toggle sidebar"
        >
          <i class="pi pi-bars text-lg"></i>
        </button>
        <app-breadcrumbs class="min-w-0" />
      </div>

      <!-- Center: Search trigger -->
      <button
        class="search-trigger hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer"
        (click)="searchOpen.emit()"
      >
        <i class="pi pi-search text-xs"></i>
        <span>Search...</span>
        <kbd
          class="text-xs opacity-60 ml-1 px-1.5 py-0.5 rounded border"
          style="
            border-color: var(--border);
            background: var(--muted);
            font-family: inherit;
          "
          >Ctrl+K</kbd
        >
      </button>

      <!-- Right: Quick create + Notifications + Theme + User -->
      <div class="flex items-center gap-1">
        <button
          class="nav-icon-btn p-2 rounded-md"
          (click)="quickCreate.emit()"
          pTooltip="Create task"
          tooltipPosition="bottom"
        >
          <i class="pi pi-plus"></i>
        </button>

        <app-notification-bell />

        <!-- Theme popover trigger -->
        <button
          class="nav-icon-btn p-2 rounded-md"
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
                    class="theme-swatch w-6 h-6 rounded-full border-2 flex items-center justify-center"
                    [style.background]="a.color"
                    [style.border-color]="
                      currentAccent() === a.value
                        ? 'var(--foreground)'
                        : 'transparent'
                    "
                    [style.transform]="
                      currentAccent() === a.value ? 'scale(1.15)' : 'scale(1)'
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

        <!-- User Avatar Dropdown -->
        <button
          class="nav-icon-btn p-1 rounded-full"
          (click)="userMenu.toggle($event)"
          aria-label="User menu"
        >
          <p-avatar
            [label]="userInitials()"
            shape="circle"
            size="normal"
            styleClass="bg-primary text-white text-xs font-semibold"
          />
        </button>
        <p-menu #userMenu [model]="userMenuItems()" [popup]="true" />
      </div>
    </nav>
  `,
})
export class TopNavComponent {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);

  readonly menuToggle = output<void>();
  readonly searchOpen = output<void>();
  readonly quickCreate = output<void>();

  private readonly currentUser = this.authService.currentUser;
  readonly currentTheme = this.themeService.theme;
  readonly currentAccent = this.themeService.accent;
  readonly accentPresets = ACCENT_PRESETS;

  readonly themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: 'pi pi-sun' },
    { value: 'dark', label: 'Dark', icon: 'pi pi-moon' },
    { value: 'system', label: 'System', icon: 'pi pi-desktop' },
  ];

  readonly themeIcon = computed(() => {
    const t = this.themeService.theme();
    if (t === 'light') return 'pi pi-sun';
    if (t === 'dark') return 'pi pi-moon';
    return 'pi pi-desktop';
  });

  readonly userInitials = computed(() => {
    const name = this.currentUser()?.name;
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  });

  readonly userMenuItems = computed<MenuItem[]>(() => {
    const user = this.currentUser();
    const items: MenuItem[] = [];

    if (user) {
      items.push({
        label: user.name,
        disabled: true,
        styleClass: 'opacity-70 font-semibold',
      });
      items.push({ separator: true });
    }

    items.push(
      {
        label: 'Profile',
        icon: 'pi pi-user',
        command: () => this.router.navigate(['/settings/profile']),
      },
      {
        label: 'Settings',
        icon: 'pi pi-cog',
        command: () => this.router.navigate(['/settings']),
      },
      { separator: true },
      {
        label: 'Sign Out',
        icon: 'pi pi-sign-out',
        command: () => this.authService.signOut('manual'),
      },
    );

    return items;
  });

  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  setAccent(accent: AccentColor): void {
    this.themeService.setAccent(accent);
  }

  goToThemes(): void {
    this.router.navigate(['/settings/appearance']);
  }
}
