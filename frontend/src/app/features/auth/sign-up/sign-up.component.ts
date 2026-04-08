import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { PasswordModule } from 'primeng/password';
import { ProgressBar } from 'primeng/progressbar';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { OtpVerificationComponent } from '../../../shared/components/otp-verification/otp-verification.component';

@Component({
  selector: 'app-sign-up',
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
    ProgressBar,
    OtpVerificationComponent,
  ],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.css',
})
export class SignUpComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  signUpForm: FormGroup = this.fb.group(
    {
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone_number: ['', [Validators.pattern(/^\+[1-9]\d{6,14}$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.passwordMatchValidator },
  );

  /** Current step: 'form' (main form), 'otp' (phone verification) */
  step = signal<'form' | 'otp'>('form');
  phoneForOtp = signal('');

  isLoading = false;
  hidePassword = true;
  hideConfirmPassword = true;
  errorMessage = '';

  constructor() {
    this.signUpForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.errorMessage) {
          this.errorMessage = '';
          this.cdr.markForCheck();
        }
      });
  }

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

  get passwordStrengthBarClass(): string {
    const strength = this.passwordStrength;
    if (strength < 40) return 'strength-weak';
    if (strength < 70) return 'strength-fair';
    if (strength < 90) return 'strength-good';
    return 'strength-strong';
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
    if (strength < 40) return 'text-[var(--destructive)]';
    if (strength < 70) return 'text-yellow-600 dark:text-yellow-400';
    if (strength < 90) return 'text-[var(--primary)]';
    return 'text-[var(--success)]';
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

    const phoneNumber = this.signUpForm.value.phone_number?.trim();

    // If phone provided, try to send OTP first
    if (phoneNumber) {
      this.isLoading = true;
      this.errorMessage = '';

      this.authService
        .sendPhoneOtp(phoneNumber)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => {
            this.isLoading = false;
            this.cdr.markForCheck();
          }),
        )
        .subscribe({
          next: () => {
            this.phoneForOtp.set(phoneNumber);
            this.step.set('otp');
          },
          error: (error) => {
            // WAHA down — proceed without OTP verification
            if (error.status === 503) {
              this.doSignUp(false);
            } else if (error.status === 429) {
              this.errorMessage =
                'Too many OTP requests. Please wait before trying again.';
            } else {
              this.errorMessage =
                error.error?.error?.message ||
                'Failed to send verification code.';
            }
          },
        });
    } else {
      // No phone — skip OTP
      this.doSignUp(false);
    }
  }

  onOtpVerified(): void {
    this.doSignUp(true);
  }

  onOtpBack(): void {
    this.step.set('form');
  }

  private doSignUp(phoneVerified: boolean): void {
    this.isLoading = true;
    this.errorMessage = '';

    const { name, email, password, phone_number } = this.signUpForm.value;
    const phoneNumber = phone_number?.trim() || undefined;

    this.authService
      .signUp({ name, email, password, phone_number: phoneNumber })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/onboarding']);
        },
        error: (error) => {
          this.step.set('form');
          if (error.status === 409) {
            this.errorMessage =
              error.error?.error?.message ||
              'An account with this email already exists.';
          } else if (error.status === 400) {
            this.errorMessage =
              error.error?.error?.message ||
              'Please check your input and try again.';
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
