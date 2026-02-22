import {
  Component,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { PasswordModule } from 'primeng/password';
import {
  InvitationService,
  InvitationValidateResponse,
} from '../../../core/services/invitation.service';

type PageState =
  | 'loading'
  | 'valid'
  | 'expired'
  | 'already_accepted'
  | 'invalid'
  | 'success';

@Component({
  selector: 'app-accept-invite',
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
  ],
  template: `
    <div class="auth-wrapper">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>

      <div class="auth-container">
        <!-- Left branded panel -->
        <div class="brand-panel">
          <div class="brand-content">
            <div class="logo-mark">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  width="48"
                  height="48"
                  rx="12"
                  fill="white"
                  fill-opacity="0.15"
                />
                <path
                  d="M14 24.5L21 31.5L34 17.5"
                  stroke="white"
                  stroke-width="3.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <h1 class="brand-title">TaskFlow</h1>
            <p class="brand-tagline">
              You've been invited to collaborate.<br />Set up your account to
              get started.
            </p>
          </div>
        </div>

        <!-- Right form panel -->
        <div class="form-panel">
          <div class="form-wrapper fade-in">
            <!-- Loading State -->
            @if (pageState() === 'loading') {
              <div class="text-center py-12">
                <p-progressSpinner
                  [style]="{ width: '48px', height: '48px' }"
                  strokeWidth="4"
                />
                <p class="text-gray-500 mt-4">Validating invitation...</p>
              </div>
            }

            <!-- Expired -->
            @if (pageState() === 'expired') {
              <div class="text-center py-12">
                <div
                  class="mx-auto w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mb-4"
                >
                  <i class="pi pi-clock text-2xl text-yellow-600"></i>
                </div>
                <h2 class="text-xl font-bold text-gray-900 mb-2">
                  Invitation Expired
                </h2>
                <p class="text-gray-500 mb-6">
                  This invitation link has expired. Please ask the workspace
                  admin to send a new invitation.
                </p>
                <a
                  routerLink="/auth/sign-in"
                  class="text-primary hover:text-primary font-semibold"
                  >Go to Sign In</a
                >
              </div>
            }

            <!-- Already Accepted -->
            @if (pageState() === 'already_accepted') {
              <div class="text-center py-12">
                <div
                  class="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4"
                >
                  <i class="pi pi-check text-2xl text-blue-600"></i>
                </div>
                <h2 class="text-xl font-bold text-gray-900 mb-2">
                  Already Accepted
                </h2>
                <p class="text-gray-500 mb-6">
                  This invitation has already been accepted. You can sign in
                  with your existing account.
                </p>
                <a
                  routerLink="/auth/sign-in"
                  class="text-primary hover:text-primary font-semibold"
                  >Go to Sign In</a
                >
              </div>
            }

            <!-- Invalid -->
            @if (pageState() === 'invalid') {
              <div class="text-center py-12">
                <div
                  class="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4"
                >
                  <i class="pi pi-times text-2xl text-red-600"></i>
                </div>
                <h2 class="text-xl font-bold text-gray-900 mb-2">
                  Invalid Invitation
                </h2>
                <p class="text-gray-500 mb-6">
                  This invitation link is not valid. Please check your email for
                  the correct link or contact the workspace admin.
                </p>
                <a
                  routerLink="/auth/sign-in"
                  class="text-primary hover:text-primary font-semibold"
                  >Go to Sign In</a
                >
              </div>
            }

            <!-- Success -->
            @if (pageState() === 'success') {
              <div class="text-center py-12">
                <div
                  class="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4"
                >
                  <i class="pi pi-check text-2xl text-green-600"></i>
                </div>
                <h2 class="text-xl font-bold text-gray-900 mb-2">
                  Account Created!
                </h2>
                <p class="text-gray-500 mb-6">
                  Your account has been set up successfully. You can now sign in
                  to access your workspace.
                </p>
                <a
                  routerLink="/auth/sign-in"
                  class="submit-btn inline-block px-6 py-3 text-white font-semibold rounded-xl no-underline"
                  >Sign In</a
                >
              </div>
            }

            <!-- Valid - Show Form -->
            @if (pageState() === 'valid') {
              <div class="form-header">
                <h2 class="form-title">Accept Invitation</h2>
                <p class="form-subtitle">
                  Set up your account to join the workspace
                  @if (invitation()?.role) {
                    as <strong>{{ invitation()!.role }}</strong>
                  }
                </p>
              </div>

              <form [formGroup]="acceptForm" (ngSubmit)="onSubmit()">
                <div class="field-spacing">
                  <label for="email" class="field-label">Email</label>
                  <input
                    pInputText
                    id="email"
                    type="email"
                    [value]="invitation()?.email || ''"
                    [disabled]="true"
                    class="w-full"
                  />
                  <small class="text-gray-400"
                    >Email is set by the invitation</small
                  >
                </div>

                <div class="field-spacing">
                  <label for="name" class="field-label">Full Name</label>
                  <input
                    pInputText
                    id="name"
                    type="text"
                    formControlName="name"
                    placeholder="John Doe"
                    class="w-full"
                  />
                  @if (
                    acceptForm.get('name')?.hasError('required') &&
                    acceptForm.get('name')?.touched
                  ) {
                    <small class="p-error">Name is required</small>
                  }
                </div>

                <div class="field-spacing">
                  <label for="password" class="field-label">Password</label>
                  <p-password
                    id="password"
                    formControlName="password"
                    placeholder="At least 8 characters"
                    [toggleMask]="true"
                    [feedback]="false"
                    styleClass="w-full"
                    inputStyleClass="w-full"
                  />
                  @if (
                    acceptForm.get('password')?.hasError('required') &&
                    acceptForm.get('password')?.touched
                  ) {
                    <small class="p-error">Password is required</small>
                  }
                  @if (
                    acceptForm.get('password')?.hasError('minlength') &&
                    acceptForm.get('password')?.touched
                  ) {
                    <small class="p-error"
                      >Password must be at least 8 characters</small
                    >
                  }
                </div>

                <div class="field-spacing">
                  <label for="confirmPassword" class="field-label"
                    >Confirm Password</label
                  >
                  <p-password
                    id="confirmPassword"
                    formControlName="confirmPassword"
                    placeholder="Re-enter your password"
                    [toggleMask]="true"
                    [feedback]="false"
                    styleClass="w-full"
                    inputStyleClass="w-full"
                  />
                  @if (
                    acceptForm.get('confirmPassword')?.hasError('required') &&
                    acceptForm.get('confirmPassword')?.touched
                  ) {
                    <small class="p-error">Please confirm your password</small>
                  }
                  @if (
                    acceptForm
                      .get('confirmPassword')
                      ?.hasError('passwordMismatch') &&
                    acceptForm.get('confirmPassword')?.touched
                  ) {
                    <small class="p-error">Passwords do not match</small>
                  }
                </div>

                <div class="field-spacing">
                  <label for="jobTitle" class="field-label">Job Title</label>
                  <input
                    pInputText
                    id="jobTitle"
                    type="text"
                    formControlName="jobTitle"
                    placeholder="e.g. Product Manager"
                    class="w-full"
                  />
                </div>

                <div class="field-spacing">
                  <label for="department" class="field-label">Department</label>
                  <input
                    pInputText
                    id="department"
                    type="text"
                    formControlName="department"
                    placeholder="e.g. Engineering"
                    class="w-full"
                  />
                </div>

                <div class="field-spacing">
                  <label for="bio" class="field-label">Short Bio</label>
                  <textarea
                    pInputText
                    id="bio"
                    formControlName="bio"
                    placeholder="Tell us a bit about yourself (optional)"
                    rows="3"
                    class="w-full"
                    style="resize: vertical"
                  ></textarea>
                  @if (
                    acceptForm.get('bio')?.hasError('maxlength') &&
                    acceptForm.get('bio')?.touched
                  ) {
                    <small class="p-error"
                      >Bio must be 500 characters or less</small
                    >
                  }
                </div>

                <div class="field-spacing">
                  <label for="timezone" class="field-label">Timezone</label>
                  <select
                    id="timezone"
                    formControlName="timezone"
                    class="w-full p-2 rounded-md border"
                    style="border-color: var(--border); background: var(--background); color: var(--foreground)"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time (US)</option>
                    <option value="America/Chicago">Central Time (US)</option>
                    <option value="America/Denver">Mountain Time (US)</option>
                    <option value="America/Los_Angeles">
                      Pacific Time (US)
                    </option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris / Berlin</option>
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                    <option value="Australia/Sydney">Sydney</option>
                  </select>
                </div>

                @if (errorMessage()) {
                  <div
                    class="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2"
                  >
                    <i
                      class="pi pi-exclamation-circle text-red-500 shrink-0"
                      style="font-size: 20px; margin-top: 1px;"
                    ></i>
                    <span>{{ errorMessage() }}</span>
                  </div>
                }

                <button
                  pButton
                  type="submit"
                  class="submit-btn w-full"
                  [disabled]="isLoading() || acceptForm.invalid"
                >
                  @if (isLoading()) {
                    <p-progressSpinner
                      [style]="{ width: '20px', height: '20px' }"
                      strokeWidth="4"
                      styleClass="inline-spinner"
                    />
                    Creating account...
                  } @else {
                    Accept & Create Account
                  }
                </button>
              </form>

              <div class="form-footer">
                <p class="text-sm text-gray-500">
                  Already have an account?
                  <a
                    routerLink="/auth/sign-in"
                    class="text-primary hover:text-primary font-semibold transition-colors"
                  >
                    Sign in
                  </a>
                </p>
              </div>
            }
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

      @keyframes blobFloat {
        0%,
        100% {
          transform: translate(0, 0) scale(1);
        }
        33% {
          transform: translate(30px, -20px) scale(1.05);
        }
        66% {
          transform: translate(-15px, 15px) scale(0.97);
        }
      }

      .auth-wrapper {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--background);
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
        background: radial-gradient(
          circle,
          rgba(129, 140, 248, 0.3) 0%,
          transparent 70%
        );
        top: -10%;
        right: -5%;
      }

      .blob-2 {
        width: 400px;
        height: 400px;
        background: radial-gradient(
          circle,
          rgba(167, 139, 250, 0.25) 0%,
          transparent 70%
        );
        bottom: -10%;
        left: -5%;
        animation-delay: -7s;
      }

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

      .brand-panel {
        flex: 0 0 400px;
        background: linear-gradient(
          145deg,
          var(--primary) 0%,
          color-mix(in srgb, var(--primary) 80%, black) 50%,
          color-mix(in srgb, var(--primary) 65%, black) 100%
        );
        padding: 3rem 2.5rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        position: relative;
        overflow: hidden;
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
        margin: 0;
      }

      .form-panel {
        flex: 1;
        background: var(--card);
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
        color: var(--foreground);
        margin: 0 0 0.5rem 0;
        letter-spacing: -0.025em;
      }

      .form-subtitle {
        font-size: 0.925rem;
        color: var(--muted-foreground);
        margin: 0;
      }

      .field-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--foreground);
        margin-bottom: 0.375rem;
      }

      .field-spacing {
        margin-bottom: 0.75rem;
      }

      .form-footer {
        text-align: center;
        margin-top: 1.5rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--border);
      }

      .submit-btn {
        height: 48px !important;
        font-size: 15px !important;
        font-weight: 600 !important;
        border-radius: 12px !important;
        background: var(--primary) !important;
        color: var(--primary-foreground) !important;
        transition: all 0.2s ease !important;
        box-shadow:
          0 1px 3px rgba(79, 70, 229, 0.3),
          0 4px 12px rgba(79, 70, 229, 0.15) !important;
        border: none !important;
      }

      .submit-btn:hover:not([disabled]) {
        box-shadow:
          0 1px 3px rgba(79, 70, 229, 0.4),
          0 8px 24px rgba(79, 70, 229, 0.25) !important;
        transform: translateY(-1px);
      }

      .submit-btn[disabled] {
        background: var(--primary) !important;
        opacity: 0.5;
        color: var(--primary-foreground) !important;
        box-shadow: none !important;
      }

      :host ::ng-deep .inline-spinner .p-progress-spinner-circle {
        stroke: white !important;
      }

      :host ::ng-deep .inline-spinner {
        display: inline-block;
        vertical-align: middle;
        margin-right: 8px;
      }

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

        .form-panel {
          padding: 2rem 1.5rem;
        }
      }
    `,
  ],
})
export class AcceptInviteComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private invitationService = inject(InvitationService);

  pageState = signal<PageState>('loading');
  invitation = signal<InvitationValidateResponse | null>(null);
  errorMessage = signal<string>('');
  isLoading = signal(false);

  private token = '';

  acceptForm: FormGroup = this.fb.group(
    {
      name: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      jobTitle: [''],
      department: [''],
      bio: ['', [Validators.maxLength(500)]],
      timezone: [Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'],
    },
    { validators: this.passwordMatchValidator },
  );

  ngOnInit() {
    this.token =
      this.route.snapshot.queryParamMap.get('token') ||
      this.route.snapshot.paramMap.get('token') ||
      '';

    if (!this.token) {
      this.pageState.set('invalid');
      return;
    }

    this.validateInvitation();
  }

  private validateInvitation() {
    this.invitationService.validate(this.token).subscribe({
      next: (response) => {
        this.invitation.set(response);

        if (response.already_accepted) {
          this.pageState.set('already_accepted');
        } else if (response.expired) {
          this.pageState.set('expired');
        } else if (response.valid) {
          this.pageState.set('valid');
          if (response.job_title) {
            this.acceptForm.patchValue({ jobTitle: response.job_title });
          }
        } else {
          this.pageState.set('invalid');
        }
      },
      error: () => {
        this.pageState.set('invalid');
      },
    });
  }

  onSubmit() {
    if (this.acceptForm.invalid) {
      this.acceptForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const { name, password, jobTitle, department, bio, timezone } =
      this.acceptForm.value;

    this.invitationService
      .accept({
        token: this.token,
        name,
        password,
        job_title: jobTitle?.trim() || undefined,
        department: department?.trim() || undefined,
        bio: bio?.trim() || undefined,
        timezone: timezone || undefined,
      })
      .subscribe({
        next: () => {
          this.pageState.set('success');
          this.isLoading.set(false);
        },
        error: (error) => {
          this.isLoading.set(false);
          if (error.status === 400) {
            const msg =
              error.error?.error?.message ||
              error.error?.error ||
              'Invalid request. Please check your input.';
            this.errorMessage.set(msg);
          } else if (error.status === 409) {
            this.errorMessage.set(
              'An account with this email already exists. Try signing in instead.',
            );
          } else if (error.status === 0) {
            this.errorMessage.set(
              'Unable to connect to server. Please try again.',
            );
          } else {
            this.errorMessage.set(
              error.error?.error?.message ||
                'An error occurred. Please try again.',
            );
          }
        },
      });
  }

  private passwordMatchValidator(
    control: AbstractControl,
  ): ValidationErrors | null {
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

    if (confirmPassword?.hasError('passwordMismatch')) {
      confirmPassword.setErrors(null);
    }

    return null;
  }
}
