import { Component, inject, signal } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextModule,
    ButtonModule,
    ProgressSpinner,
    PasswordModule,
  ],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-2xl shadow-lg p-8">
          <!-- Logo / Title -->
          <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-indigo-600 mb-4">
              <i class="pi pi-check-circle text-white" style="font-size: 1.75rem;"></i>
            </div>
            <h1 class="text-2xl font-bold text-gray-900">Sign in to TaskFlow</h1>
            <p class="mt-1 text-sm text-gray-500">Manage your projects with ease</p>
          </div>

          <!-- Error Message -->
          @if (errorMessage()) {
            <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {{ errorMessage() }}
            </div>
          }

          <!-- Login Form -->
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-5">
            <div>
              <label for="login-email" class="field-label">
                <i class="pi pi-envelope mr-1.5" style="font-size: 0.85rem;"></i>
                Email address
              </label>
              <input
                pInputText
                id="login-email"
                type="email"
                formControlName="email"
                placeholder="you@example.com"
                class="w-full"
              />
              @if (form.controls.email.hasError('required') && form.controls.email.touched) {
                <small class="p-error">Email is required</small>
              }
              @if (form.controls.email.hasError('email') && !form.controls.email.hasError('required')) {
                <small class="p-error">Enter a valid email</small>
              }
            </div>

            <div>
              <label for="login-password" class="field-label">
                <i class="pi pi-lock mr-1.5" style="font-size: 0.85rem;"></i>
                Password
              </label>
              <p-password
                id="login-password"
                formControlName="password"
                placeholder="Enter your password"
                [toggleMask]="true"
                [feedback]="false"
                styleClass="w-full"
                inputStyleClass="w-full"
              />
              @if (form.controls.password.hasError('required') && form.controls.password.touched) {
                <small class="p-error">Password is required</small>
              }
              @if (form.controls.password.hasError('minlength') && !form.controls.password.hasError('required')) {
                <small class="p-error">Password must be at least 8 characters</small>
              }
            </div>

            <button
              pButton
              type="submit"
              class="w-full submit-btn"
              [disabled]="loading()"
            >
              @if (loading()) {
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

          <!-- Forgot Password Link -->
          <div class="mt-4 text-center">
            <a routerLink="/auth/forgot-password" class="text-sm text-indigo-600 font-medium hover:text-indigo-500">
              Forgot your password?
            </a>
          </div>

          <!-- Footer Links -->
          <div class="mt-6 text-center text-sm text-gray-500 space-y-2">
            <div>
              Don't have an account?
              <a routerLink="/auth/register" class="text-indigo-600 font-medium hover:text-indigo-500">
                Sign up
              </a>
            </div>
            <div>
              Have an invitation?
              <a routerLink="/auth/accept-invite" class="text-indigo-600 font-medium hover:text-indigo-500">
                Accept invite
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .field-label {
      display: flex;
      align-items: center;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.375rem;
    }

    .submit-btn {
      height: 48px !important;
      border-radius: 8px !important;
      font-size: 1rem !important;
      font-weight: 600 !important;
      background: #4f46e5 !important;
      border: none !important;
    }

    .submit-btn:hover:not([disabled]) {
      background: #4338ca !important;
    }

    :host ::ng-deep .inline-spinner .p-progress-spinner-circle {
      stroke: white !important;
    }

    :host ::ng-deep .inline-spinner {
      display: inline-block;
      vertical-align: middle;
      margin-right: 8px;
    }
  `],
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  errorMessage = signal('');
  hidePassword = signal(true);

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    const { email, password } = this.form.getRawValue();

    this.authService.signIn(email!, password!).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.error?.message || 'Invalid email or password. Please try again.'
        );
      },
    });
  }
}
