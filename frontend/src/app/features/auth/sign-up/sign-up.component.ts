import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sign-up',
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
    MatProgressBarModule,
  ],
  template: `
    <div class="auth-wrapper">
      <!-- Decorative background blobs -->
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>

      <div class="auth-container">
        <!-- Left branded panel -->
        <div class="brand-panel">
          <div class="brand-content">
            <!-- Logo -->
            <div class="logo-mark">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="12" fill="white" fill-opacity="0.15"/>
                <path d="M14 24.5L21 31.5L34 17.5" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h1 class="brand-title">TaskFlow</h1>
            <p class="brand-tagline">Start building something great.<br/>Your team is waiting.</p>

            <!-- Decorative grid dots -->
            <div class="grid-dots">
              @for (dot of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25]; track dot) {
                <div class="dot"></div>
              }
            </div>

            <div class="brand-features">
              <div class="feature-item">
                <mat-icon class="feature-icon">rocket_launch</mat-icon>
                <span>Get started in under a minute</span>
              </div>
              <div class="feature-item">
                <mat-icon class="feature-icon">lock</mat-icon>
                <span>Enterprise-grade security</span>
              </div>
              <div class="feature-item">
                <mat-icon class="feature-icon">auto_awesome</mat-icon>
                <span>Free for teams up to 10</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right form panel -->
        <div class="form-panel">
          <div class="form-wrapper fade-in">
            <div class="form-header">
              <h2 class="form-title">Create your account</h2>
              <p class="form-subtitle">Get started with TaskFlow in seconds</p>
            </div>

            <form [formGroup]="signUpForm" (ngSubmit)="onSubmit()">
              <mat-form-field appearance="outline" class="w-full field-spacing">
                <mat-label>Full Name</mat-label>
                <input
                  matInput
                  type="text"
                  formControlName="name"
                  placeholder="John Doe"
                />
                @if (signUpForm.get('name')?.hasError('required') && signUpForm.get('name')?.touched) {
                  <mat-error>Name is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="w-full field-spacing">
                <mat-label>Email</mat-label>
                <input
                  matInput
                  type="email"
                  formControlName="email"
                  placeholder="you@example.com"
                />
                @if (signUpForm.get('email')?.hasError('required') && signUpForm.get('email')?.touched) {
                  <mat-error>Email is required</mat-error>
                }
                @if (signUpForm.get('email')?.hasError('email') && signUpForm.get('email')?.touched) {
                  <mat-error>Please enter a valid email</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="w-full field-spacing">
                <mat-label>Password</mat-label>
                <input
                  matInput
                  [type]="hidePassword ? 'password' : 'text'"
                  formControlName="password"
                  placeholder="At least 8 characters"
                />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="hidePassword = !hidePassword"
                >
                  <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (signUpForm.get('password')?.hasError('required') && signUpForm.get('password')?.touched) {
                  <mat-error>Password is required</mat-error>
                }
                @if (signUpForm.get('password')?.hasError('minlength') && signUpForm.get('password')?.touched) {
                  <mat-error>Password must be at least 8 characters</mat-error>
                }
              </mat-form-field>

              <!-- Password strength indicator -->
              @if (signUpForm.get('password')?.value) {
                <div class="strength-bar-wrapper">
                  <mat-progress-bar
                    mode="determinate"
                    [value]="passwordStrength"
                    [color]="passwordStrengthColor"
                  ></mat-progress-bar>
                  <p class="text-xs mt-1" [class]="passwordStrengthTextClass">
                    {{ passwordStrengthLabel }}
                  </p>
                </div>
              }

              <mat-form-field appearance="outline" class="w-full field-spacing">
                <mat-label>Confirm Password</mat-label>
                <input
                  matInput
                  [type]="hideConfirmPassword ? 'password' : 'text'"
                  formControlName="confirmPassword"
                  placeholder="Re-enter your password"
                />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="hideConfirmPassword = !hideConfirmPassword"
                >
                  <mat-icon>{{ hideConfirmPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (signUpForm.get('confirmPassword')?.hasError('required') && signUpForm.get('confirmPassword')?.touched) {
                  <mat-error>Please confirm your password</mat-error>
                }
                @if (signUpForm.get('confirmPassword')?.hasError('passwordMismatch') && signUpForm.get('confirmPassword')?.touched) {
                  <mat-error>Passwords do not match</mat-error>
                }
              </mat-form-field>

              @if (errorMessage) {
                <div class="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
                  <mat-icon class="text-red-500 shrink-0" style="font-size: 20px; width: 20px; height: 20px;">error_outline</mat-icon>
                  <span>{{ errorMessage }}</span>
                </div>
              }

              <button
                mat-flat-button
                type="submit"
                class="submit-btn w-full"
                [disabled]="isLoading || signUpForm.invalid"
              >
                @if (isLoading) {
                  <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
                  Creating account...
                } @else {
                  Create Account
                }
              </button>
            </form>

            <div class="form-footer">
              <p class="text-sm text-gray-500">
                Already have an account?
                <a routerLink="/auth/sign-in" class="text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
                  Sign in
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

      /* ===== Background blobs ===== */
      @keyframes blobFloat {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(30px, -20px) scale(1.05); }
        66% { transform: translate(-15px, 15px) scale(0.97); }
      }

      .auth-wrapper {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f5f3ff 100%);
        padding: 1rem;
        position: relative;
        overflow: hidden;
      }

      .blob {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.5;
        animation: blobFloat 20s ease-in-out infinite;
        pointer-events: none;
      }

      .blob-1 {
        width: 500px;
        height: 500px;
        background: radial-gradient(circle, rgba(129, 140, 248, 0.3) 0%, transparent 70%);
        top: -10%;
        right: -5%;
        animation-delay: 0s;
      }

      .blob-2 {
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(167, 139, 250, 0.25) 0%, transparent 70%);
        bottom: -10%;
        left: -5%;
        animation-delay: -7s;
      }

      .blob-3 {
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        animation-delay: -14s;
      }

      /* ===== Main container ===== */
      .auth-container {
        display: flex;
        width: 100%;
        max-width: 960px;
        min-height: 680px;
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
        background: linear-gradient(145deg, #4f46e5 0%, #7c3aed 50%, #6d28d9 100%);
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
        top: -50%;
        right: -50%;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%);
        pointer-events: none;
      }

      .brand-panel::after {
        content: '';
        position: absolute;
        bottom: -30%;
        left: -30%;
        width: 80%;
        height: 80%;
        background: radial-gradient(circle, rgba(0,0,0,0.1) 0%, transparent 60%);
        pointer-events: none;
      }

      .brand-content {
        position: relative;
        z-index: 1;
      }

      .logo-mark {
        margin-bottom: 1.5rem;
      }

      .brand-title {
        font-size: 2rem;
        font-weight: 800;
        color: white;
        letter-spacing: -0.025em;
        margin: 0 0 0.75rem 0;
      }

      .brand-tagline {
        font-size: 1.05rem;
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.6;
        margin: 0 0 2.5rem 0;
      }

      .grid-dots {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 1.25rem;
        margin-bottom: 2.5rem;
        opacity: 0.25;
        max-width: 140px;
      }

      .dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: white;
      }

      .brand-features {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .feature-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.9rem;
        font-weight: 500;
      }

      .feature-icon {
        font-size: 20px !important;
        width: 20px !important;
        height: 20px !important;
        color: rgba(255, 255, 255, 0.7);
      }

      /* ===== Right form panel ===== */
      .form-panel {
        flex: 1;
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2.5rem;
      }

      .form-wrapper {
        width: 100%;
        max-width: 400px;
      }

      .form-header {
        margin-bottom: 1.75rem;
      }

      .form-title {
        font-size: 1.625rem;
        font-weight: 700;
        color: #111827;
        margin: 0 0 0.5rem 0;
        letter-spacing: -0.025em;
      }

      .form-subtitle {
        font-size: 0.925rem;
        color: #6b7280;
        margin: 0;
      }

      .field-spacing {
        margin-bottom: 0.125rem;
      }

      .strength-bar-wrapper {
        margin-bottom: 0.5rem;
        margin-top: -0.25rem;
      }

      .form-footer {
        text-align: center;
        margin-top: 1.5rem;
        padding-top: 1.25rem;
        border-top: 1px solid #f3f4f6;
      }

      /* ===== Submit button ===== */
      .submit-btn {
        height: 48px !important;
        font-size: 15px !important;
        font-weight: 600 !important;
        border-radius: 12px !important;
        letter-spacing: 0.01em;
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
        color: white !important;
        transition: all 0.2s ease !important;
        box-shadow: 0 1px 3px rgba(79, 70, 229, 0.3), 0 4px 12px rgba(79, 70, 229, 0.15) !important;
      }

      .submit-btn:hover:not([disabled]) {
        box-shadow: 0 1px 3px rgba(79, 70, 229, 0.4), 0 8px 24px rgba(79, 70, 229, 0.25) !important;
        transform: translateY(-1px);
      }

      .submit-btn:active:not([disabled]) {
        transform: translateY(0);
      }

      .submit-btn[disabled] {
        background: linear-gradient(135deg, #a5b4fc 0%, #c4b5fd 100%) !important;
        color: rgba(255, 255, 255, 0.7) !important;
        box-shadow: none !important;
      }

      mat-spinner {
        display: inline-block;
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

        .grid-dots {
          display: none;
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
export class SignUpComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  signUpForm: FormGroup = this.fb.group(
    {
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.passwordMatchValidator }
  );

  isLoading = false;
  hidePassword = true;
  hideConfirmPassword = true;
  errorMessage = '';

  get passwordStrength(): number {
    const password = this.signUpForm.get('password')?.value || '';
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 15;
    if (/[a-z]/.test(password)) strength += 10;
    if (/[A-Z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 20;
    return Math.min(strength, 100);
  }

  get passwordStrengthColor(): 'primary' | 'accent' | 'warn' {
    const strength = this.passwordStrength;
    if (strength < 40) return 'warn';
    if (strength < 70) return 'accent';
    return 'primary';
  }

  get passwordStrengthLabel(): string {
    const strength = this.passwordStrength;
    if (strength < 40) return 'Weak password';
    if (strength < 70) return 'Fair password';
    if (strength < 90) return 'Good password';
    return 'Strong password';
  }

  get passwordStrengthTextClass(): string {
    const strength = this.passwordStrength;
    if (strength < 40) return 'text-red-600';
    if (strength < 70) return 'text-yellow-600';
    if (strength < 90) return 'text-blue-600';
    return 'text-green-600';
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (
      password &&
      confirmPassword &&
      password.value !== confirmPassword.value
    ) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    // Clear the mismatch error if passwords now match (but keep other errors)
    if (confirmPassword?.hasError('passwordMismatch')) {
      confirmPassword.setErrors(null);
    }

    return null;
  }

  onSubmit(): void {
    if (this.signUpForm.invalid) {
      this.signUpForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { name, email, password } = this.signUpForm.value;

    this.authService.signUp({ name, email, password }).subscribe({
      next: () => {
        this.router.navigate(['/onboarding']);
      },
      error: (error) => {
        this.isLoading = false;
        if (error.status === 409) {
          this.errorMessage = 'An account with this email already exists.';
        } else if (error.status === 400) {
          this.errorMessage =
            error.error?.error?.message || 'Please check your input and try again.';
        } else if (error.status === 0) {
          this.errorMessage =
            'Unable to connect to server. Please try again.';
        } else {
          this.errorMessage =
            error.error?.error?.message || 'An error occurred. Please try again.';
        }
      },
    });
  }
}
