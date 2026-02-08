import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sign-in',
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
            Sign In to TaskFlow
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="signInForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="w-full mb-4">
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                placeholder="you@example.com"
              />
              @if (signInForm.get('email')?.hasError('required') && signInForm.get('email')?.touched) {
                <mat-error>Email is required</mat-error>
              }
              @if (signInForm.get('email')?.hasError('email') && signInForm.get('email')?.touched) {
                <mat-error>Please enter a valid email</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full mb-4">
              <mat-label>Password</mat-label>
              <input
                matInput
                [type]="hidePassword ? 'password' : 'text'"
                formControlName="password"
                placeholder="Enter your password"
              />
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="hidePassword = !hidePassword"
              >
                <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (signInForm.get('password')?.hasError('required') && signInForm.get('password')?.touched) {
                <mat-error>Password is required</mat-error>
              }
              @if (signInForm.get('password')?.hasError('minlength') && signInForm.get('password')?.touched) {
                <mat-error>Password must be at least 8 characters</mat-error>
              }
            </mat-form-field>

            <div class="flex justify-end mb-4 -mt-2">
              <a routerLink="/auth/forgot-password" class="text-sm text-blue-600 hover:underline">
                Forgot password?
              </a>
            </div>

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
              [disabled]="isLoading || signInForm.invalid"
            >
              @if (isLoading) {
                <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
                Signing in...
              } @else {
                Sign In
              }
            </button>
          </form>
        </mat-card-content>

        <mat-card-actions class="justify-center mt-4">
          <p class="text-sm text-gray-600">
            Don't have an account?
            <a routerLink="/auth/sign-up" class="text-blue-600 hover:underline">
              Sign up
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
export class SignInComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  signInForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  isLoading = false;
  hidePassword = true;
  errorMessage = '';

  onSubmit(): void {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.signInForm.value;

    this.authService.signIn(email, password).subscribe({
      next: () => {
        let returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        // SECURITY: Validate returnUrl to prevent open redirect attacks
        // Only allow relative URLs starting with a single slash (not protocol-relative //)
        if (!returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
          returnUrl = '/dashboard';
        }
        this.router.navigateByUrl(returnUrl);
      },
      error: (error) => {
        this.isLoading = false;
        if (error.status === 401) {
          this.errorMessage = 'Invalid email or password';
        } else if (error.status === 0) {
          this.errorMessage = 'Unable to connect to server. Please try again.';
        } else {
          this.errorMessage = error.error?.message || 'An error occurred. Please try again.';
        }
      },
    });
  }
}
