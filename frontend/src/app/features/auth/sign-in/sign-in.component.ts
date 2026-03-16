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
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { PasswordModule } from 'primeng/password';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

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

              <div class="flex justify-end mb-5 -mt-1">
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
        min-height: 600px;
        border-radius: 1.5rem;
        overflow: hidden;
        box-shadow:
          0 25px 50px -12px rgba(0, 0, 0, 0.08),
          0 0 0 1px rgba(0, 0, 0, 0.03);
        position: relative;
        z-index: 1;
      }

      /* ===== Left brand panel ===== */
      .brand-panel {
        flex: 0 0 400px;
        background: var(--primary);
        padding: 3rem 2.5rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }

      .brand-pattern {
        position: absolute;
        inset: 0;
        opacity: 0.07;
        background-image: radial-gradient(circle at 1px 1px, white 1px, transparent 0);
        background-size: 20px 20px;
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
        font-size: 1.75rem;
        font-weight: 800;
        color: white;
        letter-spacing: -0.025em;
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
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        flex-shrink: 0;
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
        font-size: 1.625rem;
        font-weight: 700;
        color: var(--foreground);
        margin: 0 0 0.5rem 0;
        letter-spacing: -0.025em;
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
        height: 48px !important;
        font-size: 15px !important;
        font-weight: 600 !important;
        border-radius: 12px !important;
        letter-spacing: 0.01em;
        background: var(--primary) !important;
        color: var(--primary-foreground) !important;
        transition: all 0.2s ease !important;
        box-shadow:
          0 1px 3px rgba(59, 130, 246, 0.3),
          0 4px 12px rgba(59, 130, 246, 0.15) !important;
        border: none !important;
      }

      .submit-btn:hover:not([disabled]) {
        box-shadow:
          0 1px 3px rgba(59, 130, 246, 0.4),
          0 8px 24px rgba(59, 130, 246, 0.25) !important;
        transform: translateY(-1px);
      }

      .submit-btn:active:not([disabled]) {
        transform: translateY(0);
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
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  signInForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  isLoading = false;
  hidePassword = true;
  errorMessage = '';
  sessionExpiredMessage = '';

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

    const { email, password } = this.signInForm.value;

    this.authService
      .signIn(email, password)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          let returnUrl =
            this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
          // SECURITY: Validate returnUrl to prevent open redirect attacks
          // Only allow relative URLs starting with a single slash (not protocol-relative //)
          if (!returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
            returnUrl = '/dashboard';
          }
          this.router.navigateByUrl(returnUrl);
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
}
