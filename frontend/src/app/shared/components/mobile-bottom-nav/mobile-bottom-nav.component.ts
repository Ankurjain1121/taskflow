import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  output,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: true,
  imports: [RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
      }

      .bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: calc(56px + env(safe-area-inset-bottom, 0px));
        padding-bottom: env(safe-area-inset-bottom, 0px);
        background: var(--card);
        border-top: 1px solid var(--border);
        z-index: 40;
      }

      .nav-items {
        display: flex;
        align-items: center;
        justify-content: space-around;
        height: 56px;
        max-width: 500px;
        margin: 0 auto;
      }

      .nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        flex: 1;
        height: 100%;
        color: var(--muted-foreground);
        text-decoration: none;
        position: relative;
        -webkit-tap-highlight-color: transparent;
        transition: color 0.15s ease;
      }

      .nav-item.active {
        color: var(--primary);
      }

      .nav-item-label {
        font-size: 10px;
        font-weight: 500;
        line-height: 1;
      }

      .nav-item i {
        font-size: 1.25rem;
      }

      .create-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--primary);
        color: var(--primary-foreground);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transition: transform 0.1s ease, opacity 0.15s ease;
      }

      .create-btn:active {
        transform: scale(0.93);
      }

      .create-btn i {
        font-size: 1.25rem;
        color: inherit;
      }

      .badge {
        position: absolute;
        top: 4px;
        right: 50%;
        transform: translateX(calc(50% + 10px));
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 8px;
        background: var(--destructive, #ef4444);
        color: #fff;
        font-size: 10px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
    `,
  ],
  template: `
    <nav class="bottom-nav md:hidden" aria-label="Mobile navigation">
      <div class="nav-items">
        <!-- Home -->
        <a
          [routerLink]="dashboardRoute()"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          class="nav-item"
          aria-label="Home"
        >
          <i class="pi pi-home"></i>
          <span class="nav-item-label">Home</span>
        </a>

        <!-- My Work -->
        <a
          [routerLink]="myWorkRoute()"
          routerLinkActive="active"
          class="nav-item"
          aria-label="My Work"
        >
          <i class="pi pi-check-square"></i>
          <span class="nav-item-label">My Work</span>
        </a>

        <!-- Quick Add -->
        <div class="nav-item" style="flex: 0.8">
          <button
            class="create-btn"
            (click)="quickCreate.emit()"
            aria-label="Create task"
          >
            <i class="pi pi-plus"></i>
          </button>
        </div>

        <!-- Notifications -->
        <a
          [routerLink]="inboxRoute()"
          routerLinkActive="active"
          class="nav-item"
          aria-label="Notifications"
        >
          <i class="pi pi-bell"></i>
          @if (unreadCount() > 0) {
            <span class="badge">{{ displayBadge() }}</span>
          }
          <span class="nav-item-label">Inbox</span>
        </a>

        <!-- More (opens sidebar) -->
        <button
          class="nav-item"
          (click)="openSidebar.emit()"
          aria-label="More"
        >
          <i class="pi pi-bars"></i>
          <span class="nav-item-label">More</span>
        </button>
      </div>
    </nav>
  `,
})
export class MobileBottomNavComponent {
  private readonly wsContext = inject(WorkspaceContextService);
  private readonly notificationService = inject(NotificationService);

  readonly quickCreate = output<void>();
  readonly openSidebar = output<void>();

  readonly unreadCount = this.notificationService.unreadCount;
  readonly displayBadge = this.notificationService.displayBadge;

  private readonly wsBase = computed(() => {
    const wsId = this.wsContext.activeWorkspaceId();
    return wsId ? `/workspace/${wsId}` : '';
  });

  readonly dashboardRoute = computed(() => `${this.wsBase()}/dashboard`);
  readonly myWorkRoute = computed(() => `${this.wsBase()}/my-work`);
  readonly inboxRoute = computed(() => `${this.wsBase()}/inbox`);
}
