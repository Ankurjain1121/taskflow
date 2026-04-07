import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import {
  RouterModule,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

@Component({
  selector: 'app-settings-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="settings-container">
      <nav class="settings-sidebar">
        <h2 class="sidebar-title font-display">Settings</h2>
        <ul class="nav-list">
          @for (item of navItems; track item.path) {
            <li>
              <a
                [routerLink]="item.path"
                routerLinkActive="active"
                class="nav-link"
              >
                <i [class]="item.icon"></i>
                <span>{{ item.label }}</span>
              </a>
            </li>
          }
        </ul>
        @if (manageLink()) {
          <div class="manage-link-section">
            <a [routerLink]="manageLink()" class="manage-link">
              <i class="pi pi-arrow-right"></i>
              <span>Manage Workspace</span>
            </a>
          </div>
        }
      </nav>
      <main class="settings-content view-enter">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .settings-container {
        display: flex;
        height: 100%;
        background: var(--background);
      }

      .settings-sidebar {
        width: 220px;
        min-width: 220px;
        border-right: 1px solid var(--border);
        background: var(--card);
        padding: 24px 0;
        display: flex;
        flex-direction: column;
      }

      .sidebar-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--foreground);
        padding: 0 20px;
        margin: 0 0 16px;
      }

      .manage-link-section {
        margin-top: auto;
        padding: 16px 20px;
        border-top: 1px solid var(--border);
      }

      .manage-link {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--primary);
        text-decoration: none;
        transition: opacity 0.15s;
      }

      .manage-link:hover {
        opacity: 0.8;
      }

      .manage-link i {
        font-size: 0.75rem;
      }

      .nav-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .nav-link {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 20px;
        color: var(--muted-foreground);
        text-decoration: none;
        font-size: 0.875rem;
        font-weight: 500;
        transition:
          background 0.15s,
          color 0.15s;
        border-left: 3px solid transparent;
      }

      .nav-link:hover {
        background: var(--muted, rgba(0, 0, 0, 0.04));
        color: var(--foreground);
      }

      .nav-link.active {
        color: var(--primary);
        background: var(--muted, rgba(0, 0, 0, 0.04));
        border-left-color: var(--primary);
      }

      .nav-link i {
        font-size: 1rem;
        width: 20px;
        text-align: center;
      }

      .settings-content {
        flex: 1;
        overflow-y: auto;
        padding: 32px;
      }

      .settings-content > * {
        max-width: 720px;
      }

      @media (max-width: 768px) {
        .settings-container {
          flex-direction: column;
        }

        .settings-sidebar {
          width: 100%;
          min-width: unset;
          border-right: none;
          border-bottom: 1px solid var(--border);
          padding: 16px 0 0;
        }

        .sidebar-title {
          padding: 0 16px;
          margin-bottom: 12px;
        }

        .nav-list {
          display: flex;
          overflow-x: auto;
          padding: 0 16px;
          gap: 4px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }

        .nav-link {
          border-left: none;
          border-bottom: 3px solid transparent;
          padding: 8px 14px;
          white-space: nowrap;
          scroll-snap-align: start;
        }

        .nav-link.active {
          border-left-color: transparent;
          border-bottom-color: var(--primary);
        }

        .settings-content {
          padding: 20px 16px;
        }
      }
    `,
  ],
})
export class SettingsLayoutComponent {
  private ctx = inject(WorkspaceContextService);

  manageLink = computed(() => {
    const wsId = this.ctx.activeWorkspaceId();
    return wsId ? `/workspace/${wsId}/manage` : null;
  });

  navItems = [
    { path: 'profile', label: 'Profile', icon: 'pi pi-user' },
    { path: 'security', label: 'Security', icon: 'pi pi-shield' },
    { path: 'appearance', label: 'Appearance', icon: 'pi pi-palette' },
    { path: 'notifications', label: 'Notifications', icon: 'pi pi-bell' },
    { path: 'templates', label: 'Templates', icon: 'pi pi-copy' },
  ];
}
