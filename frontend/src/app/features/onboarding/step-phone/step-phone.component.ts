import {
  Component,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { OtpVerificationComponent } from '../../../shared/components/otp-verification/otp-verification.component';

@Component({
  selector: 'app-step-phone',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    OtpVerificationComponent,
  ],
  template: `
    @if (step() === 'otp') {
      <app-otp-verification
        [phoneNumber]="phoneNumber()"
        (verified)="onVerified()"
        (back)="step.set('input')"
      />
    } @else {
      <div class="text-center mb-6">
        <h2 class="text-xl font-semibold text-[var(--card-foreground)] mb-2">
          Add your phone number
        </h2>
        <p class="text-sm text-[var(--muted-foreground)]">
          We'll verify it via WhatsApp to keep your account secure
        </p>
      </div>

      <div class="mb-4">
        <label for="onboard-phone" class="block text-sm font-medium text-[var(--card-foreground)] mb-1.5">
          Phone Number
        </label>
        <input
          pInputText
          id="onboard-phone"
          type="tel"
          [(ngModel)]="phoneInput"
          placeholder="+91 8750269626"
          class="w-full"
        />
        @if (errorMessage()) {
          <small class="p-error mt-1 block">{{ errorMessage() }}</small>
        }
      </div>

      <button
        pButton
        type="button"
        class="w-full mb-3"
        [disabled]="isSending() || !phoneInput.trim()"
        (click)="sendOtp()"
      >
        @if (isSending()) {
          Sending code...
        } @else {
          Send verification code
        }
      </button>

      <div class="text-center">
        <button
          type="button"
          class="text-sm text-[var(--muted-foreground)] hover:text-[var(--card-foreground)]
                 cursor-pointer bg-transparent border-none transition-colors"
          (click)="completed.emit()"
        >
          Skip for now
        </button>
      </div>
    }
  `,
})
export class StepPhoneComponent {
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  completed = output<void>();

  step = signal<'input' | 'otp'>('input');
  phoneNumber = signal('');
  phoneInput = '';
  isSending = signal(false);
  errorMessage = signal('');

  sendOtp(): void {
    const phone = this.phoneInput.trim();
    if (!phone) return;

    // Basic E.164 validation
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      this.errorMessage.set(
        'Please enter a valid phone number (e.g. +918750269626)',
      );
      return;
    }

    this.isSending.set(true);
    this.errorMessage.set('');

    this.authService
      .sendPhoneOtp(phone)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSending.set(false)),
      )
      .subscribe({
        next: () => {
          this.phoneNumber.set(phone);
          this.step.set('otp');
        },
        error: (err) => {
          if (err.status === 503) {
            this.errorMessage.set(
              'Verification temporarily unavailable. You can skip for now.',
            );
          } else if (err.status === 429) {
            this.errorMessage.set(
              'Too many requests. Please wait before trying again.',
            );
          } else {
            this.errorMessage.set(
              err.error?.error?.message ||
                'Failed to send verification code.',
            );
          }
        },
      });
  }

  onVerified(): void {
    // Update profile with verified phone
    this.authService
      .updateProfile({ phone_number: this.phoneNumber() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.completed.emit(),
        error: () => this.completed.emit(), // proceed even if profile update fails
      });
  }
}
