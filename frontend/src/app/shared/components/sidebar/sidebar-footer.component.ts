import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sidebar-footer',
  standalone: true,
  imports: [RouterModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; }
      .footer-item {
        transition: background var(--duration-fast) var(--ease-standard);
        position: relative;
      }
      .footer-item:hover { background: var(--sidebar-surface-hover); }
      .footer-item.active { background: var(--sidebar-surface-active); }
      .footer-item.active .nav-indicator { opacity: 1; }
      .nav-indicator {
        position: absolute; left: 0; top: 50%;
        transform: translateY(-50%);
        width: 3px; height: 16px;
        border-radius: 0 3px 3px 0;
        background: var(--primary); opacity: 0;
        transition: opacity var(--duration-fast) var(--ease-standard);
      }
      .collapsed-icon-btn {
        display: flex; align-items: center; justify-content: center;
        width: 100%; padding: 0.5rem 0;
        border-radius: 0.375rem;
        transition: background var(--duration-fast) var(--ease-standard);
      }
      .collapsed-icon-btn:hover { background: var(--sidebar-surface-hover); }
      .profile-popup {
        background: var(--surface-overlay);
        border: 1px solid var(--sidebar-border);
      }
      .popup-item:hover { background: var(--sidebar-surface-hover); }
    `,
  ],
  template: `
    <div class="flex-shrink-0 px-2 pb-2 relative">
      <div class="h-px mx-1 mb-2" style="background: var(--sidebar-border)"></div>

      <!-- Profile popup backdrop -->
      @if (profileMenuOpen()) {
        <div class="fixed inset-0 z-10" (click)="profileMenuOpen.set(false)"></div>
      }

      <!-- Profile popup -->
      @if (profileMenuOpen()) {
        <div class="profile-popup absolute bottom-full left-0 right-0 mb-1 z-20 rounded-lg shadow-lg py-1">
          @if (currentUser()) {
            <div class="px-3 py-2 border-b" style="border-color: var(--sidebar-border)">
              <div class="font-medium text-sm truncate" style="color: var(--sidebar-text-primary)">
                {{ currentUser()!.name }}
              </div>
              <div class="text-xs truncate" style="color: var(--sidebar-text-muted)">
                {{ currentUser()!.email }}
              </div>
            </div>
          }
          <button (click)="handleSignOut()"
                  class="popup-item flex items-center gap-2 px-3 py-2 text-sm w-full text-left"
                  style="color: var(--sidebar-text-secondary)">
            <i class="pi pi-sign-out text-xs"></i>
            <span>Sign Out</span>
          </button>
        </div>
      }

      @if (!collapsed()) {
        <!-- Settings -->
        <a routerLink="/settings/profile" routerLinkActive="active"
           class="footer-item flex items-center gap-3 px-3 py-2 rounded-md text-sm">
          <span class="nav-indicator"></span>
          <i class="pi pi-cog text-sm flex-shrink-0" style="color: var(--sidebar-text-muted)"></i>
          <span style="color: var(--sidebar-text-secondary)">Settings</span>
        </a>
        <!-- Help -->
        <a routerLink="/help" routerLinkActive="active"
           class="footer-item flex items-center gap-3 px-3 py-2 rounded-md text-sm">
          <span class="nav-indicator"></span>
          <i class="pi pi-question-circle text-sm flex-shrink-0" style="color: var(--sidebar-text-muted)"></i>
          <span style="color: var(--sidebar-text-secondary)">Help</span>
        </a>
        <!-- User profile -->
        <button (click)="toggleProfileMenu(); $event.stopPropagation()"
                class="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-[var(--sidebar-surface-hover)] transition-colors">
          @if (currentUser()?.avatar_url) {
            <img [src]="currentUser()!.avatar_url"
                 class="w-7 h-7 rounded-full object-cover flex-shrink-0"
                 [alt]="currentUser()!.name" />
          } @else {
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                 style="background: var(--primary)">
              {{ getUserInitials(currentUser()?.name || '?') }}
            </div>
          }
          <span class="flex-1 text-left text-sm truncate" style="color: var(--sidebar-text-secondary)">
            {{ currentUser()?.name || 'Profile' }}
          </span>
          <i class="pi pi-chevron-up text-xs transition-transform duration-200"
             style="color: var(--sidebar-text-muted)"
             [class.rotate-180]="profileMenuOpen()"></i>
        </button>
      } @else {
        <!-- Collapsed footer -->
        <div class="space-y-0.5">
          <a routerLink="/settings/profile" routerLinkActive="active"
             class="collapsed-icon-btn" pTooltip="Settings" tooltipPosition="right">
            <i class="pi pi-cog text-sm" style="color: var(--sidebar-text-muted)"></i>
          </a>
          <a routerLink="/help" routerLinkActive="active"
             class="collapsed-icon-btn" pTooltip="Help" tooltipPosition="right">
            <i class="pi pi-question-circle text-sm" style="color: var(--sidebar-text-muted)"></i>
          </a>
          <button (click)="toggleProfileMenu(); $event.stopPropagation()"
                  class="collapsed-icon-btn"
                  [pTooltip]="currentUser()?.name || 'Profile'" tooltipPosition="right">
            @if (currentUser()?.avatar_url) {
              <img [src]="currentUser()!.avatar_url"
                   class="w-6 h-6 rounded-full object-cover"
                   [alt]="currentUser()!.name" />
            } @else {
              <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                   style="background: var(--primary)">
                {{ getUserInitials(currentUser()?.name || '?') }}
              </div>
            }
          </button>
          <button (click)="toggleCollapse.emit()"
                  class="collapsed-icon-btn"
                  pTooltip="Expand sidebar" tooltipPosition="right">
            <i class="pi pi-angle-double-right text-xs" style="color: var(--sidebar-text-muted)"></i>
          </button>
        </div>
      }
    </div>
  `,
})
export class SidebarFooterComponent {
  collapsed = input(false);
  toggleCollapse = output<void>();

  private readonly authService = inject(AuthService);
  readonly currentUser = this.authService.currentUser;
  profileMenuOpen = signal(false);

  toggleProfileMenu(): void {
    this.profileMenuOpen.update((v) => !v);
  }

  handleSignOut(): void {
    this.profileMenuOpen.set(false);
    this.authService.signOut('manual');
  }

  getUserInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
