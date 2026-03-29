import {
  Component,
  inject,
  computed,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { BreadcrumbsComponent } from '../breadcrumbs/breadcrumbs.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { SaveStatusIndicatorComponent } from '../save-status-indicator/save-status-indicator.component';
import { WorkspaceSwitcherComponent } from '../sidebar/workspace-switcher.component';
import { AuthService } from '../../../core/services/auth.service';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    TooltipModule,
    AvatarModule,
    MenuModule,
    BreadcrumbsComponent,
    NotificationBellComponent,
    SaveStatusIndicatorComponent,
    WorkspaceSwitcherComponent,
  ],
  styles: [
    `
      :host {
        display: block;
      }

      .top-nav {
        height: 56px;
        background: linear-gradient(90deg,
          color-mix(in srgb, var(--sidebar-bg) 40%, var(--topbar-bg)) 0%,
          color-mix(in srgb, var(--topbar-bg) 85%, transparent) 15%,
          color-mix(in srgb, var(--topbar-bg) 85%, transparent) 100%);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 2px solid var(--primary);
        z-index: 50;
      }

      .create-btn {
        background: var(--primary);
        color: var(--primary-foreground);
        transition: opacity 0.15s ease, transform 0.1s ease;
      }
      .create-btn:hover {
        opacity: 0.9;
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

      .nav-link {
        color: var(--muted-foreground);
        transition: color 0.15s ease;
      }
      .nav-link:hover {
        color: var(--foreground);
      }
      .nav-link-active {
        color: var(--primary);
        font-weight: 600;
      }

      .search-pill {
        background: var(--muted);
        color: var(--muted-foreground);
        transition: background-color 0.15s ease;
        cursor: pointer;
      }
      .search-pill:hover {
        background: var(--border);
      }

      :host ::ng-deep button:focus-visible,
      :host ::ng-deep a:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: -2px;
        border-radius: 0.375rem;
      }
    `,
  ],
  template: `
    <nav
      class="top-nav fixed top-0 left-0 right-0 flex items-center px-4 gap-3"
    >
      <!-- Left: hamburger (mobile), Logo, WS Switcher, Nav links -->
      <div class="flex items-center gap-3 min-w-0">
        <!-- Mobile hamburger -->
        <button
          class="nav-icon-btn lg:hidden p-2.5 rounded-md"
          (click)="menuToggle.emit()"
          aria-label="Toggle sidebar"
        >
          <i class="pi pi-bars text-lg"></i>
        </button>

        <!-- Logo -->
        <a
          [routerLink]="dashboardRoute()"
          class="hidden md:flex items-center gap-2 flex-shrink-0"
          aria-label="TaskBolt – Go to dashboard"
        >
          <svg class="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="3" width="20" height="18" rx="3" stroke="var(--primary)" stroke-width="2"/>
            <path d="M7 12l3 3 7-7" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="text-base font-bold tracking-tight hidden lg:inline" style="color: var(--foreground)">TaskBolt</span>
        </a>

        <!-- Workspace Switcher (topbar mode) -->
        <div class="hidden md:block">
          <app-workspace-switcher [collapsed]="false" layout="topbar" />
        </div>

        <!-- Nav Links -->
        <div class="hidden md:flex items-center gap-1">
          <a
            [routerLink]="myWorkRoute()"
            routerLinkActive="nav-link-active"
            class="nav-link text-sm px-2.5 py-1.5 rounded-md"
          >My Work</a>
          <a
            [routerLink]="reportsRoute()"
            routerLinkActive="nav-link-active"
            class="nav-link text-sm px-2.5 py-1.5 rounded-md"
          >Reports</a>
        </div>
      </div>

      <!-- Center: Breadcrumbs + Search -->
      <div class="flex-1 flex items-center justify-center gap-3 min-w-0">
        <app-breadcrumbs class="min-w-0 hidden sm:block" />
      </div>

      <!-- Right: Save status + Search pill + Quick create + Notifications + User -->
      <div class="flex items-center gap-1.5">
        <app-save-status-indicator />

        <!-- Search pill -->
        <button
          class="search-pill hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
          (click)="searchOpen.emit()"
          aria-label="Search"
        >
          <i class="pi pi-search text-xs" aria-hidden="true"></i>
          <span class="hidden lg:inline">Search...</span>
          <kbd
            class="text-[10px] px-1 py-0.5 rounded border hidden lg:inline"
            style="
              border-color: var(--border);
              background: var(--background);
              font-family: inherit;
              color: var(--muted-foreground);
            "
          >&#8984;K</kbd>
        </button>

        <button
          class="create-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium"
          (click)="quickCreate.emit()"
          pTooltip="Create task (C)"
          tooltipPosition="bottom"
          aria-label="Create task"
        >
          <i class="pi pi-plus text-[11px]" aria-hidden="true"></i>
          <span class="hidden sm:inline">Task</span>
        </button>

        <app-notification-bell aria-label="Notifications" (click)="goToInbox()" />

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
  private readonly router = inject(Router);
  private readonly shortcutsService = inject(KeyboardShortcutsService);
  private readonly wsContext = inject(WorkspaceContextService);

  readonly menuToggle = output<void>();
  readonly searchOpen = output<void>();
  readonly quickCreate = output<void>();

  private readonly currentUser = this.authService.currentUser;

  private readonly wsBase = computed(() => {
    const wsId = this.wsContext.activeWorkspaceId();
    return wsId ? `/workspace/${wsId}` : '';
  });

  readonly dashboardRoute = computed(() => `${this.wsBase()}/dashboard`);
  readonly myWorkRoute = computed(() => `${this.wsBase()}/my-work`);
  readonly reportsRoute = computed(() => `${this.wsBase()}/reports`);

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

  openShortcutHelp(): void {
    this.shortcutsService.helpRequested.update((n) => n + 1);
  }

  goToInbox(): void {
    const wsId = this.wsContext.activeWorkspaceId();
    if (wsId) {
      this.router.navigate(['/workspace', wsId, 'inbox']);
    } else {
      this.router.navigate(['/inbox']);
    }
  }
}
