import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
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
            Forgot Password
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          @if (!submitted) {
            <p class="text-gray-600 text-sm mb-6 text-center">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form [formGroup]="forgotForm" (ngSubmit)="onSubmit()">
              <mat-form-field appearance="outline" class="w-full mb-4">
                <mat-label>Email</mat-label>
                <input
                  matInput
                  type="email"
                  formControlName="email"
                  placeholder="you@example.com"
                />
                @if (forgotForm.get('email')?.hasError('required') && forgotForm.get('email')?.touched) {
                  <mat-error>Email is required</mat-error>
                }
                @if (forgotForm.get('email')?.hasError('email') && forgotForm.get('email')?.touched) {
                  <mat-error>Please enter a valid email</mat-error>
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
                [disabled]="isLoading || forgotForm.invalid"
              >
                @if (isLoading) {
                  <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
                  Sending...
                } @else {
                  Send Reset Link
                }
              </button>
            </form>
          } @else {
            <div class="text-center">
              <mat-icon class="text-green-500 mb-4" style="font-size: 48px; width: 48px; height: 48px;">
                mark_email_read
              </mat-icon>
              <h3 class="text-lg font-semibold mb-2">Check your email</h3>
              <p class="text-gray-600 text-sm mb-6">
                If an account with that email exists, we've sent a password reset link.
                Please check your inbox and spam folder.
              </p>
            </div>
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
