import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    InputTextModule,
    ButtonModule,
    ProgressSpinner,
  ],
  template: `
    <div
      class="min-h-screen flex items-center justify-center px-4"
      style="background: var(--background)"
    >
      <div class="card-container w-full max-w-md">
        <div class="card-header">
          <h2 class="text-2xl font-bold text-center">Forgot Password</h2>
        </div>

        <div class="card-body">
          @if (!submitted) {
            <p class="text-gray-600 text-sm mb-6 text-center">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>

            <form [formGroup]="forgotForm" (ngSubmit)="onSubmit()">
              <div class="mb-4">
                <label for="forgot-email" class="field-label">Email</label>
                <input
                  pInputText
                  id="forgot-email"
                  type="email"
                  formControlName="email"
                  placeholder="you@example.com"
                  class="w-full"
                />
                @if (
                  forgotForm.get('email')?.hasError('required') &&
                  forgotForm.get('email')?.touched
                ) {
                  <small class="p-error">Email is required</small>
                }
                @if (
                  forgotForm.get('email')?.hasError('email') &&
                  forgotForm.get('email')?.touched
                ) {
                  <small class="p-error">Please enter a valid email</small>
                }
              </div>

              @if (errorMessage) {
                <div
                  class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded"
                >
                  {{ errorMessage }}
                </div>
              }

              <button
                pButton
                type="submit"
                class="w-full submit-btn"
                [disabled]="isLoading || forgotForm.invalid"
              >
                @if (isLoading) {
                  <p-progressSpinner
                    [style]="{ width: '20px', height: '20px' }"
                    strokeWidth="4"
                    styleClass="inline-spinner"
                  />
                  Sending...
                } @else {
                  Send Reset Link
                }
              </button>
            </form>
          } @else {
            <div class="text-center">
              <i
                class="pi pi-envelope text-green-500 mb-4"
                style="font-size: 48px;"
              ></i>
              <h3 class="text-lg font-semibold mb-2">Check your email</h3>
              <p class="text-gray-600 text-sm mb-6">
                If an account with that email exists, we've sent a password
                reset link. Please check your inbox and spam folder.
              </p>
            </div>
          }
        </div>

        <div class="card-footer">
          <p class="text-sm text-gray-600">
            Remember your password?
            <a routerLink="/auth/sign-in" class="text-blue-600 hover:underline">
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
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  forgotForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  isLoading = false;
  submitted = false;
  errorMessage = '';

  onSubmit(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email } = this.forgotForm.value;

    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.isLoading = false;
        this.submitted = true;
      },
      error: (error) => {
        this.isLoading = false;
        if (error.status === 0) {
          this.errorMessage = 'Unable to connect to server. Please try again.';
        } else {
          this.errorMessage =
            error.error?.message || 'An error occurred. Please try again.';
        }
      },
    });
  }
}
