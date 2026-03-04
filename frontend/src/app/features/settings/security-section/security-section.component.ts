import {
  Component,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/services/auth.service';
import {
  SessionService,
  SessionInfo,
} from '../../../core/services/session.service';

@Component({
  selector: 'app-security-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <!-- Change Password Card -->
    <div
      class="rounded-lg border shadow-sm p-6"
      style="background: var(--card); border-color: var(--border)"
    >
      <h2 class="text-xl font-semibold mb-4" style="color: var(--foreground)">
        Change Password
      </h2>

      <form
        (ngSubmit)="changePassword()"
        #passwordForm="ngForm"
        class="space-y-4"
      >
        <!-- Current Password -->
        <div class="flex flex-col gap-2">
          <label
            for="secCurrentPassword"
            class="text-sm font-medium"
            style="color: var(--foreground)"
            >Current Password</label
          >
          <div class="p-inputgroup">
            <span class="p-inputgroup-addon"><i class="pi pi-lock"></i></span>
            <input
              pInputText
              id="secCurrentPassword"
              [type]="hideCurrentPassword() ? 'password' : 'text'"
              name="currentPassword"
              [(ngModel)]="currentPassword"
              required
              class="w-full"
            />
            <button
              type="button"
              class="p-inputgroup-addon cursor-pointer"
              (click)="hideCurrentPassword.set(!hideCurrentPassword())"
            >
              <i
                [class]="
                  hideCurrentPassword() ? 'pi pi-eye-slash' : 'pi pi-eye'
                "
              ></i>
            </button>
          </div>
        </div>

        <!-- New Password -->
        <div class="flex flex-col gap-2">
          <label
            for="secNewPassword"
            class="text-sm font-medium"
            style="color: var(--foreground)"
            >New Password</label
          >
          <div class="p-inputgroup">
            <span class="p-inputgroup-addon"><i class="pi pi-lock"></i></span>
            <input
              pInputText
              id="secNewPassword"
              [type]="hideNewPassword() ? 'password' : 'text'"
              name="newPassword"
              [(ngModel)]="newPassword"
              required
              minlength="8"
              #newPasswordInput="ngModel"
              class="w-full"
            />
            <button
              type="button"
              class="p-inputgroup-addon cursor-pointer"
              (click)="hideNewPassword.set(!hideNewPassword())"
            >
              <i
                [class]="hideNewPassword() ? 'pi pi-eye-slash' : 'pi pi-eye'"
              ></i>
            </button>
          </div>
          @if (
            newPasswordInput.invalid &&
            (newPasswordInput.dirty || newPasswordInput.touched)
          ) {
            @if (newPasswordInput.errors?.['minlength']) {
              <small class="text-red-500"
                >Password must be at least 8 characters</small
              >
            }
          }
        </div>

        <!-- Confirm New Password -->
        <div class="flex flex-col gap-2">
          <label
            for="secConfirmPassword"
            class="text-sm font-medium"
            style="color: var(--foreground)"
            >Confirm New Password</label
          >
          <div class="p-inputgroup">
            <span class="p-inputgroup-addon"><i class="pi pi-lock"></i></span>
            <input
              pInputText
              id="secConfirmPassword"
              [type]="hideConfirmPassword() ? 'password' : 'text'"
              name="confirmPassword"
              [(ngModel)]="confirmPassword"
              required
              #confirmPasswordInput="ngModel"
              class="w-full"
            />
            <button
              type="button"
              class="p-inputgroup-addon cursor-pointer"
              (click)="hideConfirmPassword.set(!hideConfirmPassword())"
            >
              <i
                [class]="
                  hideConfirmPassword() ? 'pi pi-eye-slash' : 'pi pi-eye'
                "
              ></i>
            </button>
          </div>
          @if (
            confirmPasswordInput.touched && newPassword !== confirmPassword
          ) {
            <small class="text-red-500">Passwords do not match</small>
          }
        </div>

        <!-- Submit -->
        <div class="flex justify-end">
          <p-button
            type="submit"
            [label]="passwordLoading() ? 'Changing...' : 'Change Password'"
            [disabled]="
              passwordLoading() ||
              passwordForm.invalid ||
              newPassword !== confirmPassword
            "
            [loading]="passwordLoading()"
          />
        </div>
      </form>
    </div>

    <!-- Active Sessions Card -->
    <div
      class="rounded-lg border shadow-sm p-6 mt-6"
      style="background: var(--card); border-color: var(--border)"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold" style="color: var(--foreground)">
          Active Sessions
        </h2>
        @if (sessions().length > 1) {
          <p-button
            label="Revoke All Others"
            severity="danger"
            [outlined]="true"
            icon="pi pi-sign-out"
            size="small"
            [disabled]="revokeAllLoading()"
            [loading]="revokeAllLoading()"
            (onClick)="revokeAllOther()"
          />
        }
      </div>

      @if (sessionsLoading()) {
        <!-- Loading skeleton -->
        <div class="space-y-3">
          @for (i of [1, 2, 3]; track i) {
            <div
              class="rounded-lg border p-4 animate-pulse"
              style="border-color: var(--border)"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-full"
                  style="background: var(--muted)"
                ></div>
                <div class="flex-1 space-y-2">
                  <div
                    class="h-4 rounded w-1/3"
                    style="background: var(--muted)"
                  ></div>
                  <div
                    class="h-3 rounded w-1/2"
                    style="background: var(--muted)"
                  ></div>
                </div>
              </div>
            </div>
          }
        </div>
      } @else if (sessions().length === 0) {
        <p class="text-sm" style="color: var(--muted-foreground)">
          No active sessions found.
        </p>
      } @else {
        <div class="space-y-3">
          @for (session of sessions(); track session.id) {
            <div
              class="rounded-lg border p-4 flex items-center gap-4"
              style="border-color: var(--border)"
              [style.background]="
                session.is_current ? 'var(--muted)' : 'transparent'
              "
            >
              <!-- Device icon -->
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style="background: var(--muted)"
              >
                <i
                  [class]="getDeviceIcon(session.user_agent)"
                  style="color: var(--muted-foreground)"
                ></i>
              </div>

              <!-- Session info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span
                    class="text-sm font-medium truncate"
                    style="color: var(--foreground)"
                    >{{
                      session.device_name || parseUserAgent(session.user_agent)
                    }}</span
                  >
                  @if (session.is_current) {
                    <span
                      class="text-xs px-2 py-0.5 rounded-full font-medium"
                      style="background: #22c55e20; color: #22c55e"
                      >Current</span
                    >
                  }
                </div>
                <div
                  class="flex items-center gap-3 text-xs"
                  style="color: var(--muted-foreground)"
                >
                  <span
                    ><i class="pi pi-map-marker mr-1"></i
                    >{{ session.ip_address }}</span
                  >
                  <span
                    ><i class="pi pi-clock mr-1"></i>Last active
                    {{ formatRelativeTime(session.last_active_at) }}</span
                  >
                </div>
              </div>

              <!-- Revoke button -->
              @if (!session.is_current) {
                <p-button
                  label="Revoke"
                  severity="danger"
                  [outlined]="true"
                  size="small"
                  [disabled]="revokingSessionId() === session.id"
                  [loading]="revokingSessionId() === session.id"
                  (onClick)="revokeSession(session.id)"
                />
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class SecuritySectionComponent implements OnInit {
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private messageService = inject(MessageService);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  passwordLoading = signal(false);
  sessionsLoading = signal(false);
  revokeAllLoading = signal(false);
  revokingSessionId = signal<string | null>(null);
  sessions = signal<SessionInfo[]>([]);

  hideCurrentPassword = signal(true);
  hideNewPassword = signal(true);
  hideConfirmPassword = signal(true);

  ngOnInit(): void {
    this.loadSessions();
  }

  changePassword(): void {
    if (this.newPassword !== this.confirmPassword) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Passwords do not match',
      });
      return;
    }

    this.passwordLoading.set(true);

    this.authService
      .changePassword({
        current_password: this.currentPassword,
        new_password: this.newPassword,
      })
      .subscribe({
        next: () => {
          this.passwordLoading.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Password changed. Other sessions revoked.',
          });
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.loadSessions();
        },
        error: (error) => {
          this.passwordLoading.set(false);
          const message = error.error?.message ?? 'Failed to change password';
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: message,
          });
        },
      });
  }

  loadSessions(): void {
    this.sessionsLoading.set(true);
    this.sessionService.listSessions().subscribe({
      next: (sessions) => {
        // Sort: current session first, then by last_active_at desc
        const sorted = [...sessions].sort((a, b) => {
          if (a.is_current) return -1;
          if (b.is_current) return 1;
          return (
            new Date(b.last_active_at).getTime() -
            new Date(a.last_active_at).getTime()
          );
        });
        this.sessions.set(sorted);
        this.sessionsLoading.set(false);
      },
      error: () => {
        this.sessionsLoading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load sessions',
        });
      },
    });
  }

  revokeSession(id: string): void {
    this.revokingSessionId.set(id);
    this.sessionService.revokeSession(id).subscribe({
      next: () => {
        this.revokingSessionId.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'Session revoked',
          detail: 'The session has been terminated.',
        });
        this.loadSessions();
      },
      error: (error) => {
        this.revokingSessionId.set(null);
        const message = error.error?.message ?? 'Failed to revoke session';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: message,
        });
      },
    });
  }

  revokeAllOther(): void {
    this.revokeAllLoading.set(true);
    this.sessionService.revokeAllOtherSessions().subscribe({
      next: ({ revoked_count }) => {
        this.revokeAllLoading.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Sessions revoked',
          detail: `${revoked_count} session(s) have been terminated.`,
        });
        this.loadSessions();
      },
      error: (error) => {
        this.revokeAllLoading.set(false);
        const message = error.error?.message ?? 'Failed to revoke sessions';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: message,
        });
      },
    });
  }

  getDeviceIcon(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (
      ua.includes('mobile') ||
      ua.includes('android') ||
      ua.includes('iphone')
    ) {
      return 'pi pi-mobile';
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'pi pi-tablet';
    }
    return 'pi pi-desktop';
  }

  parseUserAgent(userAgent: string): string {
    if (!userAgent) return 'Unknown Device';

    // Extract browser name
    let browser = 'Unknown Browser';
    if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
    } else if (userAgent.includes('Chrome')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Safari')) {
      browser = 'Safari';
    }

    // Extract OS
    let os = '';
    if (userAgent.includes('Windows')) {
      os = 'Windows';
    } else if (userAgent.includes('Mac OS')) {
      os = 'macOS';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      os = 'iOS';
    }

    return os ? `${browser} on ${os}` : browser;
  }

  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }
}
