import {
  Component,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { finalize } from 'rxjs';
import {
  AuthService,
  isTwoFactorRequired,
} from '../../../core/services/auth.service';
import { TwoFactorService } from '../../../core/services/two-factor.service';

@Component({
  selector: 'app-sign-in',
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
    FormsModule,
    CheckboxModule,
  ],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
})
export class SignInComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private twoFactorService = inject(TwoFactorService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  signInForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    rememberMe: [true],
  });

  isLoading = false;
  hidePassword = true;
  errorMessage = '';
  sessionExpiredMessage = '';

  // 2FA state
  requires2fa = false;
  tempToken = '';
  totpCode = '';
  recoveryCode = '';
  useRecoveryCode = false;

  constructor() {
    const reason = this.route.snapshot.queryParams['reason'];
    if (reason === 'session_expired') {
      this.sessionExpiredMessage =
        'Your session has expired. Please sign in again.';
    }

    this.signInForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.errorMessage) {
          this.errorMessage = '';
          this.cdr.markForCheck();
        }
      });
  }

  onSubmit(): void {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password, rememberMe } = this.signInForm.value;

    this.authService
      .signIn(email, password, rememberMe ?? true)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          if (isTwoFactorRequired(response)) {
            this.requires2fa = true;
            this.tempToken = response.temp_token;
            this.cdr.markForCheck();
            return;
          }
          this.navigateAfterLogin();
        },
        error: (error) => {
          if (error.status === 401) {
            this.errorMessage = 'Invalid email or password';
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

  onSubmit2fa(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const params: {
      temp_token: string;
      code?: string;
      recovery_code?: string;
    } = { temp_token: this.tempToken };

    if (this.useRecoveryCode) {
      params.recovery_code = this.recoveryCode.trim();
    } else {
      params.code = this.totpCode.trim();
    }

    this.twoFactorService
      .challenge(params)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          // The challenge returns the same shape as a normal auth response
          this.authService.handleTwoFactorSuccess(
            response as unknown as import('../../../core/services/auth.service').TokenResponse,
          );
          this.navigateAfterLogin();
        },
        error: (error) => {
          if (error.status === 401) {
            this.errorMessage = 'Invalid verification code';
          } else if (error.status === 429) {
            this.errorMessage =
              'Too many attempts. Please wait and try again.';
          } else {
            this.errorMessage =
              error.error?.error?.message ||
              'Verification failed. Please try again.';
          }
        },
      });
  }

  toggleRecoveryCode(): void {
    this.useRecoveryCode = !this.useRecoveryCode;
    this.errorMessage = '';
    this.totpCode = '';
    this.recoveryCode = '';
    this.cdr.markForCheck();
  }

  cancelTwoFactor(): void {
    this.requires2fa = false;
    this.tempToken = '';
    this.totpCode = '';
    this.recoveryCode = '';
    this.useRecoveryCode = false;
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  private navigateAfterLogin(): void {
    let returnUrl =
      this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    // SECURITY: Validate returnUrl to prevent open redirect attacks
    // Only allow relative URLs starting with a single slash (not protocol-relative //)
    if (!returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
      returnUrl = '/dashboard';
    }
    this.router.navigateByUrl(returnUrl);
  }
}
