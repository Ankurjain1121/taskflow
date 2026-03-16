import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
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
    <div
      class="min-h-screen flex items-center justify-center px-4"
      style="background: var(--background)"
    >
      <div class="card-container w-full max-w-md">
        <div class="card-header">
          <h2 class="text-2xl font-bold text-center">Reset Password</h2>
        </div>

        <div class="card-body">
          @if (!token) {
            <div class="text-center">
              <i
                class="pi pi-exclamation-circle text-red-500 mb-4"
                style="font-size: 48px;"
              ></i>
              <h3 class="text-lg font-semibold mb-2">Invalid Reset Link</h3>
              <p class="text-[var(--muted-foreground)] text-sm mb-6">
                This password reset link is invalid. Please request a new one.
              </p>
              <a routerLink="/auth/forgot-password" class="action-btn inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium" style="background: var(--primary); color: var(--primary-foreground); text-decoration: none;">
                Request New Link
              </a>
            </div>
          } @else if (resetSuccess) {
            <div class="text-center">
              <i
                class="pi pi-check-circle text-green-500 mb-4"
                style="font-size: 48px;"
              ></i>
              <h3 class="text-lg font-semibold mb-2">
                Password Reset Successfully
              </h3>
              <p class="text-[var(--muted-foreground)] text-sm mb-6">
                Your password has been reset. You can now sign in with your new
                password.
              </p>
              <a routerLink="/auth/sign-in" class="action-btn inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium" style="background: var(--primary); color: var(--primary-foreground); text-decoration: none;">
                Go to Sign In
              </a>
            </div>
          } @else {
            <p class="text-[var(--muted-foreground)] text-sm mb-6 text-center">
              Enter your new password below.
            </p>

            <form [formGroup]="resetForm" (ngSubmit)="onSubmit()">
              <div class="mb-4">
                <label for="new-password" class="field-label"
                  >New Password</label
                >
                <p-password
                  id="new-password"
                  formControlName="newPassword"
                  placeholder="Enter new password"
                  [toggleMask]="true"
                  [feedback]="false"
                  styleClass="w-full"
                  inputStyleClass="w-full"
                  [attr.aria-describedby]="resetForm.get('newPassword')?.hasError('required') && resetForm.get('newPassword')?.touched ? 'reset-password-required-error' : resetForm.get('newPassword')?.hasError('minlength') && resetForm.get('newPassword')?.touched ? 'reset-password-minlength-error' : null"
                />
                @if (
                  resetForm.get('newPassword')?.hasError('required') &&
                  resetForm.get('newPassword')?.touched
                ) {
                  <small id="reset-password-required-error" class="p-error">Password is required</small>
                }
                @if (
                  resetForm.get('newPassword')?.hasError('minlength') &&
                  resetForm.get('newPassword')?.touched
                ) {
                  <small id="reset-password-minlength-error" class="p-error"
                    >Password must be at least 8 characters</small
                  >
                }
              </div>

              <div class="mb-4">
                <label for="confirm-new-password" class="field-label"
                  >Confirm Password</label
                >
                <p-password
                  id="confirm-new-password"
                  formControlName="confirmPassword"
                  placeholder="Confirm new password"
                  [toggleMask]="true"
                  [feedback]="false"
                  styleClass="w-full"
                  inputStyleClass="w-full"
                  [attr.aria-describedby]="resetForm.get('confirmPassword')?.hasError('required') && resetForm.get('confirmPassword')?.touched ? 'reset-confirm-required-error' : resetForm.get('confirmPassword')?.hasError('passwordMismatch') && resetForm.get('confirmPassword')?.touched ? 'reset-confirm-mismatch-error' : null"
                />
                @if (
                  resetForm.get('confirmPassword')?.hasError('required') &&
                  resetForm.get('confirmPassword')?.touched
                ) {
                  <small id="reset-confirm-required-error" class="p-error">Please confirm your password</small>
                }
                @if (
                  resetForm
                    .get('confirmPassword')
                    ?.hasError('passwordMismatch') &&
                  resetForm.get('confirmPassword')?.touched
                ) {
                  <small id="reset-confirm-mismatch-error" class="p-error">Passwords do not match</small>
                }
              </div>

              @if (errorMessage) {
                <div
                  class="mb-4 p-3 bg-[var(--status-red-bg)] border border-[var(--status-red-border)] text-[var(--status-red-text)] rounded"
                >
                  {{ errorMessage }}
                </div>
              }

              <button
                pButton
                type="submit"
                class="w-full submit-btn"
                [disabled]="isLoading || resetForm.invalid"
              >
                @if (isLoading) {
                  <p-progressSpinner
                    [style]="{ width: '20px', height: '20px' }"
                    strokeWidth="4"
                    styleClass="inline-spinner"
                  />
                  Resetting...
                } @else {
                  Reset Password
                }
              </button>
            </form>
          }
        </div>

        <div class="card-footer">
          <p class="text-sm text-[var(--muted-foreground)]">
            Remember your password?
            <a routerLink="/auth/sign-in" class="hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .card-container {
        background: var(--card);
        border-radius: 12px;
        box-shadow:
          0 4px 6px -1px rgba(0, 0, 0, 0.1),
          0 2px 4px -2px rgba(0, 0, 0, 0.1);
        padding: 2rem;
      }

      .card-header {
        margin-bottom: 1.5rem;
      }

      .card-body {
        margin-bottom: 1rem;
      }

      .card-footer {
        text-align: center;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border);
      }

      .field-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--foreground);
        margin-bottom: 0.375rem;
      }

      .submit-btn {
        height: 48px !important;
        font-size: 16px !important;
        border-radius: 8px !important;
        background: var(--primary) !important;
        color: var(--primary-foreground) !important;
        border: none !important;
      }

      .submit-btn:hover:not([disabled]) {
        opacity: 0.9;
      }

      .action-btn {
        border-radius: 8px !important;
        background: var(--primary) !important;
        color: var(--primary-foreground) !important;
        border: none !important;
      }

      .action-btn:hover {
        opacity: 0.9;
      }

      .card-header h2,
      .card-body h3 {
        color: var(--foreground);
      }

      .card-body p,
      .card-footer p {
        color: var(--muted-foreground);
      }

      .card-footer a {
        color: var(--primary);
      }

      :host ::ng-deep .inline-spinner .p-progress-spinner-circle {
        stroke: white !important;
      }

      :host ::ng-deep .inline-spinner {
        display: inline-block;
        vertical-align: middle;
        margin-right: 8px;
      }
    `,
  ],
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  token: string | null = null;

  resetForm: FormGroup = this.fb.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.passwordMatchValidator },
  );

  isLoading = false;
  resetSuccess = false;
  hidePassword = true;
  hideConfirmPassword = true;
  errorMessage = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
  }

  onSubmit(): void {
    if (this.resetForm.invalid || !this.token) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { newPassword } = this.resetForm.value;

    this.authService.resetPassword(this.token, newPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.resetSuccess = true;
      },
      error: (error) => {
        this.isLoading = false;
        if (error.status === 0) {
          this.errorMessage = 'Unable to connect to server. Please try again.';
        } else if (error.status === 400) {
          this.errorMessage =
            error.error?.error?.message ||
            'Invalid or expired reset token. Please request a new one.';
        } else {
          this.errorMessage =
            error.error?.message || 'An error occurred. Please try again.';
        }
      },
    });
  }

  private passwordMatchValidator(
    control: AbstractControl,
  ): ValidationErrors | null {
    const newPassword = control.get('newPassword');
    const confirmPassword = control.get('confirmPassword');

    if (
      newPassword &&
      confirmPassword &&
      newPassword.value !== confirmPassword.value
    ) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    // Clear the mismatch error if passwords now match (but preserve other errors)
    if (confirmPassword?.hasError('passwordMismatch')) {
      confirmPassword.setErrors(null);
    }

    return null;
  }
}
