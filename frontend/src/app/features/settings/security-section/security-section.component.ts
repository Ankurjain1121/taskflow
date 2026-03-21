import {
  Component,
  computed,
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
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/services/auth.service';
import {
  SessionService,
  SessionInfo,
} from '../../../core/services/session.service';
import { TwoFactorService } from '../../../core/services/two-factor.service';

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
    DialogModule,
  ],
  providers: [MessageService],
  templateUrl: './security-section.component.html',
  styleUrl: './security-section.component.css',
})
export class SecuritySectionComponent implements OnInit {
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private twoFactorService = inject(TwoFactorService);
  private messageService = inject(MessageService);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  passwordLoading = signal(false);
  sessionsLoading = signal(false);
  revokeAllLoading = signal(false);
  revokingSessionId = signal<string | null>(null);
  sessions = signal<SessionInfo[]>([]);
  showAllSessions = signal(false);
  visibleSessions = computed(() =>
    this.showAllSessions() ? this.sessions() : this.sessions().slice(0, 5),
  );

  hideCurrentPassword = signal(true);
  hideNewPassword = signal(true);
  hideConfirmPassword = signal(true);

  // 2FA state
  twoFactorLoading = signal(true);
  twoFactorEnabled = signal(false);
  setupStep = signal<'idle' | 'qr' | 'recovery'>('idle');
  setupLoading = signal(false);
  verifyLoading = signal(false);
  totpSecret = signal('');
  otpauthUri = signal('');
  setupCode = '';
  recoveryCodes = signal<string[]>([]);

  // Disable 2FA
  showDisableDialog = signal(false);
  disableLoading = signal(false);
  disableCode = '';
  disableRecoveryCode = '';
  disableUseRecovery = signal(false);

  get showDisableDialogValue(): boolean {
    return this.showDisableDialog();
  }
  set showDisableDialogValue(val: boolean) {
    this.showDisableDialog.set(val);
  }

  ngOnInit(): void {
    this.loadSessions();
    this.load2faStatus();
  }

  encodeURI(uri: string): string {
    return encodeURIComponent(uri);
  }

  // ==========================
  // 2FA Methods
  // ==========================

  load2faStatus(): void {
    this.twoFactorLoading.set(true);
    this.twoFactorService.getStatus().subscribe({
      next: (status) => {
        this.twoFactorEnabled.set(status.enabled);
        this.twoFactorLoading.set(false);
      },
      error: () => {
        this.twoFactorLoading.set(false);
      },
    });
  }

  startSetup(): void {
    this.setupLoading.set(true);
    this.twoFactorService.setup().subscribe({
      next: (response) => {
        this.totpSecret.set(response.secret);
        this.otpauthUri.set(response.otpauth_uri);
        this.setupStep.set('qr');
        this.setupLoading.set(false);
      },
      error: (error) => {
        this.setupLoading.set(false);
        const message =
          error.error?.error?.message ?? 'Failed to start 2FA setup';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: message,
        });
      },
    });
  }

  verifySetup(): void {
    this.verifyLoading.set(true);
    this.twoFactorService.verify(this.setupCode).subscribe({
      next: (response) => {
        this.recoveryCodes.set(response.recovery_codes);
        this.setupStep.set('recovery');
        this.verifyLoading.set(false);
      },
      error: (error) => {
        this.verifyLoading.set(false);
        const message =
          error.error?.error?.message ?? 'Invalid verification code';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: message,
        });
      },
    });
  }

  finishSetup(): void {
    this.twoFactorEnabled.set(true);
    this.setupStep.set('idle');
    this.setupCode = '';
    this.recoveryCodes.set([]);
    this.totpSecret.set('');
    this.otpauthUri.set('');
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Two-factor authentication has been enabled.',
    });
  }

  disable2fa(): void {
    this.disableLoading.set(true);

    const params: { code?: string; recovery_code?: string } = {};
    if (this.disableUseRecovery()) {
      params.recovery_code = this.disableRecoveryCode.trim();
    } else {
      params.code = this.disableCode.trim();
    }

    this.twoFactorService.disable(params).subscribe({
      next: () => {
        this.disableLoading.set(false);
        this.showDisableDialog.set(false);
        this.twoFactorEnabled.set(false);
        this.disableCode = '';
        this.disableRecoveryCode = '';
        this.disableUseRecovery.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Two-factor authentication has been disabled.',
        });
      },
      error: (error) => {
        this.disableLoading.set(false);
        const message = error.error?.error?.message ?? 'Failed to disable 2FA';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: message,
        });
      },
    });
  }

  // ==========================
  // Password Methods
  // ==========================

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

  // ==========================
  // Session Methods
  // ==========================

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
