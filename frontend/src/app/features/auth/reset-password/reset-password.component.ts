import { Component, inject, OnInit } from '@angular/core';
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
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <mat-card class="w-full max-w-md">
        <mat-card-header class="justify-center mb-6">
          <mat-card-title class="text-2xl font-bold text-center">
            Reset Password
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          @if (!token) {
            <div class="text-center">
              <mat-icon class="text-red-500 mb-4" style="font-size: 48px; width: 48px; height: 48px;">
                error_outline
              </mat-icon>
              <h3 class="text-lg font-semibold mb-2">Invalid Reset Link</h3>
              <p class="text-gray-600 text-sm mb-6">
                This password reset link is invalid. Please request a new one.
              </p>
              <a
                mat-flat-button
                color="primary"
                routerLink="/auth/forgot-password"
              >
                Request New Link
              </a>
            </div>
          } @else if (resetSuccess) {
            <div class="text-center">
              <mat-icon class="text-green-500 mb-4" style="font-size: 48px; width: 48px; height: 48px;">
                check_circle
              </mat-icon>
              <h3 class="text-lg font-semibold mb-2">Password Reset Successfully</h3>
              <p class="text-gray-600 text-sm mb-6">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <a
                mat-flat-button
                color="primary"
                routerLink="/auth/sign-in"
              >
                Go to Sign In
              </a>
            </div>
          } @else {
            <p class="text-gray-600 text-sm mb-6 text-center">
              Enter your new password below.
            </p>

            <form [formGroup]="resetForm" (ngSubmit)="onSubmit()">
              <mat-form-field appearance="outline" class="w-full mb-4">
                <mat-label>New Password</mat-label>
                <input
                  matInput
                  [type]="hidePassword ? 'password' : 'text'"
                  formControlName="newPassword"
                  placeholder="Enter new password"
                />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="hidePassword = !hidePassword"
                >
                  <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (resetForm.get('newPassword')?.hasError('required') && resetForm.get('newPassword')?.touched) {
                  <mat-error>Password is required</mat-error>
                }
                @if (resetForm.get('newPassword')?.hasError('minlength') && resetForm.get('newPassword')?.touched) {
                  <mat-error>Password must be at least 8 characters</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="w-full mb-4">
                <mat-label>Confirm Password</mat-label>
                <input
                  matInput
                  [type]="hideConfirmPassword ? 'password' : 'text'"
                  formControlName="confirmPassword"
                  placeholder="Confirm new password"
                />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="hideConfirmPassword = !hideConfirmPassword"
                >
                  <mat-icon>{{ hideConfirmPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (resetForm.get('confirmPassword')?.hasError('required') && resetForm.get('confirmPassword')?.touched) {
                  <mat-error>Please confirm your password</mat-error>
                }
                @if (resetForm.get('confirmPassword')?.hasError('passwordMismatch') && resetForm.get('confirmPassword')?.touched) {
                  <mat-error>Passwords do not match</mat-error>
                }
              </mat-form-field>

              @if (errorMessage) {
                <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {{ errorMessage }}
                </div>
              }

              <button
                mat-flat-button
                color="primary"
                type="submit"
                class="w-full h-12"
                [disabled]="isLoading || resetForm.invalid"
              >
                @if (isLoading) {
                  <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
                  Resetting...
                } @else {
                  Reset Password
                }
              </button>
            </form>
          }
        </mat-card-content>

        <mat-card-actions class="justify-center mt-4">
          <p class="text-sm text-gray-600">
            Remember your password?
            <a routerLink="/auth/sign-in" class="text-blue-600 hover:underline">
              Sign in
            </a>
          </p>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      mat-card {
        padding: 2rem;
      }

      mat-card-header {
        display: flex;
        justify-content: center;
      }

      mat-form-field {
        width: 100%;
      }

      button[type='submit'] {
        height: 48px;
        font-size: 16px;
      }

      mat-spinner {
        display: inline-block;
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
    { validators: this.passwordMatchValidator }
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

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword');
    const confirmPassword = control.get('confirmPassword');

    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
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
