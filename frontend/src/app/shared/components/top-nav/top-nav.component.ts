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
import { MenuItem } from 'primeng/api';
import { BreadcrumbsComponent } from '../breadcrumbs/breadcrumbs.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { SaveStatusIndicatorComponent } from '../save-status-indicator/save-status-indicator.component';
import { AuthService } from '../../../core/services/auth.service';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
    AvatarModule,
    MenuModule,
    BreadcrumbsComponent,
    NotificationBellComponent,
    SaveStatusIndicatorComponent,
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

    `,
  ],
  template: `
    <nav
      class="top-nav fixed top-0 left-0 right-0 flex items-center px-4 gap-3"
    >
      <!-- Left: Mobile hamburger + Breadcrumbs -->
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <button
          class="nav-icon-btn lg:hidden p-2.5 rounded-md"
          (click)="menuToggle.emit()"
          aria-label="Toggle sidebar"
        >
          <i class="pi pi-bars text-lg"></i>
        </button>
        <app-breadcrumbs class="min-w-0" />
      </div>

      <!-- Right: Save status + Search + Quick create + Notifications + User -->
      <div class="flex items-center gap-1.5">
        <app-save-status-indicator />

        <button
          class="nav-icon-btn hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm"
          (click)="searchOpen.emit()"
          pTooltip="Search"
          tooltipPosition="bottom"
          aria-label="Search"
        >
          <i class="pi pi-search" style="font-size: 0.85rem" aria-hidden="true"></i>
          <kbd
            class="text-[10px] opacity-60 px-1 py-0.5 rounded border"
            style="
              border-color: var(--border);
              background: var(--muted);
              font-family: inherit;
              color: var(--muted-foreground);
            "
          >&#8984;K</kbd>
        </button>

        <button
          class="nav-icon-btn p-2 rounded-md"
          (click)="quickCreate.emit()"
          pTooltip="Create task"
          tooltipPosition="bottom"
          aria-label="Create task"
        >
          <i class="pi pi-plus" aria-hidden="true"></i>
        </button>

        <app-notification-bell (click)="goToInbox()" />

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
