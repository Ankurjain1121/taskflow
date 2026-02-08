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
    <div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <mat-card class="w-full max-w-md">
        <mat-card-header class="justify-center mb-6">
          <mat-card-title class="text-2xl font-bold text-center">
            Create your TaskFlow account
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="signUpForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="w-full mb-4">
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

            <mat-form-field appearance="outline" class="w-full mb-4">
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

            <mat-form-field appearance="outline" class="w-full mb-4">
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
              <div class="mb-4 -mt-2">
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

            <mat-form-field appearance="outline" class="w-full mb-4">
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
              <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {{ errorMessage }}
              </div>
            }

            <button
              mat-flat-button
              color="primary"
              type="submit"
              class="w-full h-12"
              [disabled]="isLoading || signUpForm.invalid"
            >
              @if (isLoading) {
                <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
                Creating account...
              } @else {
                Sign Up
              }
            </button>
          </form>
        </mat-card-content>

        <mat-card-actions class="justify-center mt-4">
          <p class="text-sm text-gray-600">
            Already have an account?
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
