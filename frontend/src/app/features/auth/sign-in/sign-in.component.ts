import {
  Component,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { finalize } from 'rxjs';
import {
  AuthService,
  isTwoFactorRequired,
} from '../../../core/services/auth.service';
import { TwoFactorService } from '../../../core/services/two-factor.service';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    InputTextModule,
    ButtonModule,
    ProgressSpinner,
    PasswordModule,
    FormsModule,
    CheckboxModule,
  ],
  template: `
    <div class="auth-wrapper">
      <div class="auth-container">
        <!-- Left branded panel -->
        <div class="brand-panel">
          <!-- Subtle radial pattern -->
          <div class="brand-pattern"></div>
          <div class="brand-content">
            <!-- Logo -->
            <div class="logo-mark">
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  width="40"
                  height="40"
                  rx="10"
                  fill="white"
                  fill-opacity="0.2"
                />
                <path
                  d="M12 20.5L18 26.5L28 15.5"
                  stroke="white"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <h1 class="brand-title">TaskFlow</h1>
            <p class="brand-tagline">
              Manage projects with clarity.<br />Ship faster, together.
            </p>

            <div class="brand-features">
              <div class="feature-item">
                <div class="feature-dot"></div>
                <span>Kanban boards & timelines</span>
              </div>
              <div class="feature-item">
                <div class="feature-dot"></div>
                <span>Real-time collaboration</span>
              </div>
              <div class="feature-item">
                <div class="feature-dot"></div>
                <span>Smart project insights</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right form panel -->
        <div class="form-panel">
          <div class="form-wrapper fade-in">
            @if (!requires2fa) {
              <!-- Standard sign-in form -->
              <div class="form-header">
                <h2 class="form-title">Welcome back</h2>
                <p class="form-subtitle">Sign in to your account to continue</p>
              </div>

              <form [formGroup]="signInForm" (ngSubmit)="onSubmit()">
                <div class="field-spacing">
                  <label for="email" class="field-label">Email</label>
                  <input
                    pInputText
                    id="email"
                    type="email"
                    formControlName="email"
                    placeholder="you@example.com"
                    class="w-full"
                    [attr.aria-describedby]="signInForm.get('email')?.hasError('required') && signInForm.get('email')?.touched ? 'email-required-error' : signInForm.get('email')?.hasError('email') && signInForm.get('email')?.touched ? 'email-invalid-error' : null"
                  />
                  @if (
                    signInForm.get('email')?.hasError('required') &&
                    signInForm.get('email')?.touched
                  ) {
                    <small id="email-required-error" class="p-error">Email is required</small>
                  }
                  @if (
                    signInForm.get('email')?.hasError('email') &&
                    signInForm.get('email')?.touched
                  ) {
                    <small id="email-invalid-error" class="p-error">Please enter a valid email</small>
                  }
                </div>

                <div class="field-spacing">
                  <label for="signin-password" class="field-label">Password</label>
                  <p-password
                    inputId="signin-password"
                    formControlName="password"
                    placeholder="Enter your password"
                    [toggleMask]="true"
                    [feedback]="false"
                    styleClass="w-full"
                    inputStyleClass="w-full"
                    [attr.aria-describedby]="signInForm.get('password')?.hasError('required') && signInForm.get('password')?.touched ? 'signin-password-required-error' : signInForm.get('password')?.hasError('minlength') && signInForm.get('password')?.touched ? 'signin-password-minlength-error' : null"
                  />
                  @if (
                    signInForm.get('password')?.hasError('required') &&
                    signInForm.get('password')?.touched
                  ) {
                    <small id="signin-password-required-error" class="p-error">Password is required</small>
                  }
                  @if (
                    signInForm.get('password')?.hasError('minlength') &&
                    signInForm.get('password')?.touched
                  ) {
                    <small id="signin-password-minlength-error" class="p-error"
                      >Password must be at least 8 characters</small
                    >
                  }
                </div>

                <div class="flex items-center justify-between mb-5 -mt-1">
                  <label class="flex items-center gap-2 cursor-pointer text-sm text-[var(--muted-foreground)]">
                    <p-checkbox formControlName="rememberMe" [binary]="true" />
                    Remember me
                  </label>
                  <a
                    routerLink="/auth/forgot-password"
                    class="text-sm text-primary hover:text-primary transition-colors font-medium"
                  >
                    Forgot password?
                  </a>
                </div>

                @if (sessionExpiredMessage) {
                  <div
                    class="mb-5 p-3.5 bg-[var(--status-amber-bg)] border border-[var(--status-amber-border)] text-[var(--status-amber-text)] rounded-xl text-sm flex items-start gap-2"
                  >
                    <i
                      class="pi pi-clock text-[var(--status-amber-text)] shrink-0"
                      style="font-size: 20px; margin-top: 1px;"
                    ></i>
                    <span>{{ sessionExpiredMessage }}</span>
                  </div>
                }

                @if (errorMessage) {
                  <div
                    class="mb-5 p-3.5 bg-[var(--status-red-bg)] border border-[var(--status-red-border)] text-[var(--status-red-text)] rounded-xl text-sm flex items-start gap-2"
                  >
                    <i
                      class="pi pi-exclamation-circle text-[var(--status-red-text)] shrink-0"
                      style="font-size: 20px; margin-top: 1px;"
                    ></i>
                    <span>{{ errorMessage }}</span>
                  </div>
                }

                <button
                  pButton
                  type="submit"
                  class="submit-btn w-full"
                  [disabled]="isLoading || signInForm.invalid"
                >
                  @if (isLoading) {
                    <p-progressSpinner
                      [style]="{ width: '20px', height: '20px' }"
                      strokeWidth="4"
                      styleClass="inline-spinner"
                    />
                    Signing in...
                  } @else {
                    Sign In
                  }
                </button>
              </form>

              <div class="form-footer">
                <p class="text-sm text-[var(--muted-foreground)]">
                  Don't have an account?
                  <a
                    routerLink="/auth/sign-up"
                    class="text-primary hover:text-primary font-semibold transition-colors"
                  >
                    Sign up
                  </a>
                </p>
              </div>
            } @else {
              <!-- 2FA verification form -->
              <div class="form-header">
                <h2 class="form-title">Two-Factor Authentication</h2>
                <p class="form-subtitle">
                  @if (!useRecoveryCode) {
                    Enter the 6-digit code from your authenticator app
                  } @else {
                    Enter one of your recovery codes
                  }
                </p>
              </div>

              @if (errorMessage) {
                <div
                  class="mb-5 p-3.5 bg-[var(--status-red-bg)] border border-[var(--status-red-border)] text-[var(--status-red-text)] rounded-xl text-sm flex items-start gap-2"
                >
                  <i
                    class="pi pi-exclamation-circle text-[var(--status-red-text)] shrink-0"
                    style="font-size: 20px; margin-top: 1px;"
                  ></i>
                  <span>{{ errorMessage }}</span>
                </div>
              }

              <form (ngSubmit)="onSubmit2fa()">
                @if (!useRecoveryCode) {
                  <div class="field-spacing">
                    <label for="totp-code" class="field-label">Verification Code</label>
                    <input
                      pInputText
                      id="totp-code"
                      type="text"
                      [(ngModel)]="totpCode"
                      [ngModelOptions]="{standalone: true}"
                      placeholder="000000"
                      class="w-full text-center tracking-widest text-lg"
                      maxlength="6"
                      autocomplete="one-time-code"
                      inputmode="numeric"
                      pattern="[0-9]*"
                    />
                  </div>
                } @else {
                  <div class="field-spacing">
                    <label for="recovery-code" class="field-label">Recovery Code</label>
                    <input
                      pInputText
                      id="recovery-code"
                      type="text"
                      [(ngModel)]="recoveryCode"
                      [ngModelOptions]="{standalone: true}"
                      placeholder="Enter recovery code"
                      class="w-full"
                      autocomplete="off"
                    />
                  </div>
                }

                <button
                  pButton
                  type="submit"
                  class="submit-btn w-full"
                  [disabled]="isLoading || (!useRecoveryCode && totpCode.length !== 6) || (useRecoveryCode && !recoveryCode)"
                >
                  @if (isLoading) {
                    <p-progressSpinner
                      [style]="{ width: '20px', height: '20px' }"
                      strokeWidth="4"
                      styleClass="inline-spinner"
                    />
                    Verifying...
                  } @else {
                    Verify
                  }
                </button>
              </form>

              <div class="mt-4 text-center">
                <button
                  type="button"
                  class="text-sm text-primary hover:text-primary font-medium cursor-pointer bg-transparent border-none"
                  (click)="toggleRecoveryCode()"
                >
                  @if (!useRecoveryCode) {
                    Use a recovery code instead
                  } @else {
                    Use authenticator app instead
                  }
                </button>
              </div>

              <div class="form-footer">
                <button
                  type="button"
                  class="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer bg-transparent border-none transition-colors"
                  (click)="cancelTwoFactor()"
                >
                  Back to sign in
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* ===== Fade-in animation ===== */
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .fade-in {
        animation: fadeInUp 0.5s ease-out both;
      }

      .auth-wrapper {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--background);
        padding: 1rem;
        position: relative;
      }

      /* ===== Main container ===== */
      .auth-container {
        display: flex;
        width: 100%;
        max-width: 960px;
        min-height: 620px;
        border-radius: 1.5rem;
        overflow: hidden;
        box-shadow:
          0 32px 64px -16px rgba(0, 0, 0, 0.14),
          0 16px 32px -8px rgba(0, 0, 0, 0.08),
          0 0 0 1px rgba(0, 0, 0, 0.04);
        position: relative;
        z-index: 1;
      }

      /* ===== Left brand panel ===== */
      .brand-panel {
        flex: 0 0 420px;
        background: linear-gradient(
          155deg,
          color-mix(in srgb, var(--primary) 90%, white) 0%,
          var(--primary) 35%,
          color-mix(in srgb, var(--primary) 75%, black) 70%,
          color-mix(in srgb, var(--primary) 55%, black) 100%
        );
        padding: 3rem 2.5rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }

      .brand-panel::before {
        content: '';
        position: absolute;
        top: -40%;
        right: -40%;
        width: 120%;
        height: 120%;
        background: radial-gradient(
          circle,
          rgba(255, 255, 255, 0.12) 0%,
          transparent 55%
        );
        pointer-events: none;
      }

      .brand-panel::after {
        content: '';
        position: absolute;
        bottom: -20%;
        left: -20%;
        width: 80%;
        height: 80%;
        background: radial-gradient(
          circle,
          rgba(0, 0, 0, 0.12) 0%,
          transparent 55%
        );
        pointer-events: none;
      }

      .brand-pattern {
        position: absolute;
        inset: 0;
        opacity: 0.1;
        background-image: radial-gradient(circle at 1px 1px, white 1px, transparent 0);
        background-size: 24px 24px;
        pointer-events: none;
      }

      .brand-content {
        position: relative;
        z-index: 1;
      }

      .logo-mark {
        margin-bottom: 1.25rem;
      }

      .brand-title {
        font-size: 2.25rem;
        font-weight: 900;
        color: white;
        letter-spacing: -0.04em;
        margin: 0 0 0.625rem 0;
      }

      .brand-tagline {
        font-size: 1rem;
        color: rgba(255, 255, 255, 0.75);
        line-height: 1.6;
        margin: 0 0 2.5rem 0;
      }

      .brand-features {
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
      }

      .feature-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: rgba(255, 255, 255, 0.9);
        font-size: 0.875rem;
        font-weight: 500;
      }

      .feature-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        flex-shrink: 0;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
      }

      /* ===== Right form panel ===== */
      .form-panel {
        flex: 1;
        background: var(--card);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 3rem 2.5rem;
      }

      .form-wrapper {
        width: 100%;
        max-width: 380px;
      }

      .form-header {
        margin-bottom: 2rem;
      }

      .form-title {
        font-size: 1.75rem;
        font-weight: 800;
        color: var(--foreground);
        margin: 0 0 0.5rem 0;
        letter-spacing: -0.035em;
      }

      .form-subtitle {
        font-size: 0.925rem;
        color: var(--muted-foreground);
        margin: 0;
      }

      .field-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--foreground);
        margin-bottom: 0.375rem;
      }

      .field-spacing {
        margin-bottom: 1rem;
      }

      .form-footer {
        text-align: center;
        margin-top: 1.75rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--border);
      }

      /* ===== Submit button ===== */
      .submit-btn {
        height: 50px !important;
        font-size: 15px !important;
        font-weight: 700 !important;
        border-radius: 12px !important;
        letter-spacing: 0.01em;
        background: var(--primary) !important;
        color: var(--primary-foreground) !important;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        box-shadow:
          0 2px 4px rgba(59, 130, 246, 0.3),
          0 6px 20px rgba(59, 130, 246, 0.2) !important;
        border: none !important;
      }

      .submit-btn:hover:not([disabled]) {
        box-shadow:
          0 2px 4px rgba(59, 130, 246, 0.4),
          0 12px 32px rgba(59, 130, 246, 0.3) !important;
        transform: translateY(-2px);
      }

      .submit-btn:active:not([disabled]) {
        transform: translateY(0) scale(0.98);
      }

      .submit-btn[disabled] {
        background: var(--primary) !important;
        opacity: 0.5;
        color: var(--primary-foreground) !important;
        box-shadow: none !important;
      }

      :host ::ng-deep .inline-spinner .p-progress-spinner-circle {
        stroke: white !important;
      }

      :host ::ng-deep .inline-spinner {
        display: inline-block;
        vertical-align: middle;
        margin-right: 8px;
      }

      /* ===== Responsive: stack on small screens ===== */
      @media (max-width: 768px) {
        .auth-container {
          flex-direction: column;
          max-width: 480px;
          min-height: auto;
        }

        .brand-panel {
          flex: 0 0 auto;
          padding: 2rem 1.5rem;
        }

        .brand-features {
          display: none;
        }

        .brand-tagline {
          margin-bottom: 0;
        }

        .form-panel {
          padding: 2rem 1.5rem;
        }
      }
    `,
  ],
})
export class SignInComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private twoFactorService = inject(TwoFactorService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  signInForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    rememberMe: [true],
  });

  isLoading = false;
  hidePassword = true;
  errorMessage = '';
  sessionExpiredMessage = '';

  // 2FA state
  requires2fa = false;
  tempToken = '';
  totpCode = '';
  recoveryCode = '';
  useRecoveryCode = false;

  constructor() {
    const reason = this.route.snapshot.queryParams['reason'];
    if (reason === 'session_expired') {
      this.sessionExpiredMessage =
        'Your session has expired. Please sign in again.';
    }

    this.signInForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.errorMessage) {
          this.errorMessage = '';
          this.cdr.markForCheck();
        }
      });
  }

  onSubmit(): void {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password, rememberMe } = this.signInForm.value;

    this.authService
      .signIn(email, password, rememberMe ?? true)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          if (isTwoFactorRequired(response)) {
            this.requires2fa = true;
            this.tempToken = response.temp_token;
            this.cdr.markForCheck();
            return;
          }
          this.navigateAfterLogin();
        },
        error: (error) => {
          if (error.status === 401) {
            this.errorMessage = 'Invalid email or password';
          } else if (error.status === 429) {
            this.errorMessage =
              'Too many attempts. Please wait a minute and try again.';
          } else if (error.status === 0) {
            this.errorMessage =
              'Unable to connect to server. Please try again.';
          } else {
            this.errorMessage =
              error.error?.error?.message ||
              'An error occurred. Please try again.';
          }
        },
      });
  }

  onSubmit2fa(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const params: {
      temp_token: string;
      code?: string;
      recovery_code?: string;
    } = { temp_token: this.tempToken };

    if (this.useRecoveryCode) {
      params.recovery_code = this.recoveryCode.trim();
    } else {
      params.code = this.totpCode.trim();
    }

    this.twoFactorService
      .challenge(params)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          // The challenge returns the same shape as a normal auth response
          this.authService.handleTwoFactorSuccess(
            response as unknown as import('../../../core/services/auth.service').TokenResponse,
          );
          this.navigateAfterLogin();
        },
        error: (error) => {
          if (error.status === 401) {
            this.errorMessage = 'Invalid verification code';
          } else if (error.status === 429) {
            this.errorMessage =
              'Too many attempts. Please wait and try again.';
          } else {
            this.errorMessage =
              error.error?.error?.message ||
              'Verification failed. Please try again.';
          }
        },
      });
  }

  toggleRecoveryCode(): void {
    this.useRecoveryCode = !this.useRecoveryCode;
    this.errorMessage = '';
    this.totpCode = '';
    this.recoveryCode = '';
    this.cdr.markForCheck();
  }

  cancelTwoFactor(): void {
    this.requires2fa = false;
    this.tempToken = '';
    this.totpCode = '';
    this.recoveryCode = '';
    this.useRecoveryCode = false;
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  private navigateAfterLogin(): void {
    let returnUrl =
      this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    // SECURITY: Validate returnUrl to prevent open redirect attacks
    // Only allow relative URLs starting with a single slash (not protocol-relative //)
    if (!returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
      returnUrl = '/dashboard';
    }
    this.router.navigateByUrl(returnUrl);
  }
}
