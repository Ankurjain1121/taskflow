import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    ButtonModule,
    PasswordModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <div
      class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"
    >
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p class="mt-2 text-center text-sm text-gray-600">
            Already have an account?
            <a
              routerLink="/auth/login"
              class="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign in
            </a>
          </p>
        </div>

        <form class="mt-8 space-y-6" (ngSubmit)="onSubmit()" #form="ngForm">
          <div class="space-y-4">
            <div>
              <label for="reg-name" class="field-label">
                <i class="pi pi-user mr-1.5" style="font-size: 0.85rem;"></i>
                Name
              </label>
              <input
                pInputText
                id="reg-name"
                type="text"
                name="name"
                [(ngModel)]="formData.name"
                required
                #nameInput="ngModel"
                class="w-full"
              />
              @if (
                nameInput.invalid && (nameInput.dirty || nameInput.touched)
              ) {
                <small class="p-error">Name is required</small>
              }
            </div>

            <div>
              <label for="reg-email" class="field-label">
                <i
                  class="pi pi-envelope mr-1.5"
                  style="font-size: 0.85rem;"
                ></i>
                Email
              </label>
              <input
                pInputText
                id="reg-email"
                type="email"
                name="email"
                [(ngModel)]="formData.email"
                required
                email
                #emailInput="ngModel"
                class="w-full"
              />
              @if (
                emailInput.invalid && (emailInput.dirty || emailInput.touched)
              ) {
                @if (emailInput.errors?.['required']) {
                  <small class="p-error">Email is required</small>
                }
                @if (emailInput.errors?.['email']) {
                  <small class="p-error">Invalid email format</small>
                }
              }
            </div>

            <div>
              <label for="reg-password" class="field-label">
                <i class="pi pi-lock mr-1.5" style="font-size: 0.85rem;"></i>
                Password
              </label>
              <p-password
                id="reg-password"
                name="password"
                [(ngModel)]="formData.password"
                [toggleMask]="true"
                [feedback]="false"
                required
                minlength="8"
                #passwordInput="ngModel"
                styleClass="w-full"
                inputStyleClass="w-full"
              />
              @if (
                passwordInput.invalid &&
                (passwordInput.dirty || passwordInput.touched)
              ) {
                @if (passwordInput.errors?.['required']) {
                  <small class="p-error">Password is required</small>
                }
                @if (passwordInput.errors?.['minlength']) {
                  <small class="p-error"
                    >Password must be at least 8 characters</small
                  >
                }
              }
            </div>

            <div>
              <label for="reg-confirm-password" class="field-label">
                <i class="pi pi-lock mr-1.5" style="font-size: 0.85rem;"></i>
                Confirm Password
              </label>
              <p-password
                id="reg-confirm-password"
                name="confirmPassword"
                [(ngModel)]="formData.confirmPassword"
                [toggleMask]="true"
                [feedback]="false"
                required
                #confirmPasswordInput="ngModel"
                styleClass="w-full"
                inputStyleClass="w-full"
              />
              @if (
                confirmPasswordInput.touched &&
                formData.password !== formData.confirmPassword
              ) {
                <small class="p-error">Passwords do not match</small>
              }
            </div>
          </div>

          <div>
            <button
              pButton
              type="submit"
              label="Create account"
              class="w-full submit-btn"
              [disabled]="
                loading() ||
                form.invalid ||
                formData.password !== formData.confirmPassword
              "
              [loading]="loading()"
            ></button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
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
    `,
  ],
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  formData = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  };

  loading = signal(false);
  hidePassword = signal(true);
  hideConfirmPassword = signal(true);

  onSubmit(): void {
    if (this.formData.password !== this.formData.confirmPassword) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Passwords do not match',
        life: 3000,
      });
      return;
    }

    this.loading.set(true);

    this.authService
      .signUp({
        name: this.formData.name,
        email: this.formData.email,
        password: this.formData.password,
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Account created successfully!',
            life: 3000,
          });
          this.router.navigate(['/dashboard']);
        },
        error: (error: { error?: { message?: string } }) => {
          this.loading.set(false);
          const message =
            error.error?.message || 'Registration failed. Please try again.';
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: message,
            life: 5000,
          });
        },
      });
  }
}
