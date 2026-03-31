import {
  Component,
  input,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
  DestroyRef,
  OnInit,
  OnDestroy,
  ElementRef,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-otp-verification',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule],
  template: `
    <div class="otp-container">
      <div class="text-center mb-6">
        <div
          class="w-14 h-14 rounded-full bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4"
        >
          <i class="pi pi-mobile text-2xl text-[var(--primary)]"></i>
        </div>
        <h3 class="text-lg font-semibold text-[var(--card-foreground)] mb-1">
          Verify your phone
        </h3>
        <p class="text-sm text-[var(--muted-foreground)]">
          We sent a 6-digit code to
          <strong>{{ phoneNumber() }}</strong> via WhatsApp
        </p>
      </div>

      <!-- OTP Input -->
      <div class="flex justify-center gap-2 mb-6">
        @for (digit of digits(); track $index; let i = $index) {
          <input
            #digitInput
            type="text"
            inputmode="numeric"
            maxlength="1"
            [value]="digit"
            (input)="onDigitInput($event, i)"
            (keydown)="onKeyDown($event, i)"
            (paste)="onPaste($event)"
            class="w-12 h-14 text-center text-xl font-semibold rounded-xl
                   border-2 border-[var(--border)] bg-[var(--input)]
                   text-[var(--card-foreground)] outline-none
                   focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20
                   transition-all"
            [class.border-[var(--status-red-border)]]="errorMessage()"
            autocomplete="one-time-code"
          />
        }
      </div>

      <!-- Timer & Resend -->
      <div class="text-center mb-6">
        @if (countdown() > 0) {
          <p class="text-sm text-[var(--muted-foreground)]">
            Code expires in
            <span class="font-medium text-[var(--card-foreground)]">
              {{ formatTime(countdown()) }}
            </span>
          </p>
        } @else {
          <p class="text-sm text-[var(--status-red-text)]">Code has expired</p>
        }
      </div>

      <!-- Error -->
      @if (errorMessage()) {
        <div
          class="mb-4 p-3 bg-[var(--status-red-bg)] border border-[var(--status-red-border)]
                 text-[var(--status-red-text)] rounded-xl text-sm flex items-start gap-2"
        >
          <i
            class="pi pi-exclamation-circle shrink-0"
            style="font-size: 18px; margin-top: 1px"
          ></i>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <!-- Verify Button -->
      <button
        pButton
        type="button"
        class="w-full mb-3"
        [disabled]="isVerifying() || otpCode().length !== 6"
        (click)="verifyCode()"
      >
        @if (isVerifying()) {
          Verifying...
        } @else {
          Verify Phone Number
        }
      </button>

      <!-- Resend -->
      <div class="text-center">
        <button
          type="button"
          class="text-sm font-medium cursor-pointer bg-transparent border-none transition-colors"
          [class.text-primary]="canResend()"
          [class.text-[var(--muted-foreground)]]="!canResend()"
          [disabled]="!canResend() || isResending()"
          (click)="resendOtp()"
        >
          @if (isResending()) {
            Sending...
          } @else if (!canResend()) {
            Resend in {{ resendCooldown() }}s
          } @else {
            Resend code
          }
        </button>
      </div>

      <!-- Back -->
      <div class="text-center mt-4">
        <button
          type="button"
          class="text-sm text-[var(--muted-foreground)] hover:text-[var(--card-foreground)]
                 cursor-pointer bg-transparent border-none transition-colors"
          (click)="back.emit()"
        >
          Go back
        </button>
      </div>
    </div>
  `,
})
export class OtpVerificationComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  phoneNumber = input.required<string>();
  verified = output<void>();
  back = output<void>();

  digits = signal<string[]>(['', '', '', '', '', '']);
  otpCode = signal('');
  countdown = signal(300); // 5 minutes
  resendCooldown = signal(30);
  isVerifying = signal(false);
  isResending = signal(false);
  errorMessage = signal('');

  digitInputs = viewChildren<ElementRef>('digitInput');

  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  canResend = signal(false);

  ngOnInit(): void {
    this.startCountdown();
    this.startResendCooldown();
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.resendTimer) clearInterval(this.resendTimer);
  }

  onDigitInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');

    const newDigits = [...this.digits()];
    newDigits[index] = value ? value[0] : '';
    this.digits.set(newDigits);
    this.otpCode.set(newDigits.join(''));
    this.errorMessage.set('');

    // Auto-advance to next input
    if (value && index < 5) {
      const inputs = this.digitInputs();
      if (inputs[index + 1]) {
        inputs[index + 1].nativeElement.focus();
      }
    }
  }

  onKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      const inputs = this.digitInputs();
      if (inputs[index - 1]) {
        inputs[index - 1].nativeElement.focus();
      }
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '') || '';
    if (pasted.length === 6) {
      const newDigits = pasted.split('');
      this.digits.set(newDigits);
      this.otpCode.set(pasted);
      // Focus last input
      const inputs = this.digitInputs();
      if (inputs[5]) {
        inputs[5].nativeElement.focus();
      }
    }
  }

  verifyCode(): void {
    const code = this.otpCode();
    if (code.length !== 6) return;

    this.isVerifying.set(true);
    this.errorMessage.set('');

    this.authService
      .verifyPhoneOtp(this.phoneNumber(), code)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isVerifying.set(false)),
      )
      .subscribe({
        next: () => this.verified.emit(),
        error: (err) => {
          if (err.status === 401) {
            this.errorMessage.set('Invalid code. Please try again.');
          } else if (err.status === 410) {
            this.errorMessage.set('Code has expired. Please request a new one.');
          } else if (err.status === 429) {
            this.errorMessage.set(
              'Too many attempts. Please request a new code.',
            );
          } else {
            this.errorMessage.set('Verification failed. Please try again.');
          }
        },
      });
  }

  resendOtp(): void {
    if (!this.canResend()) return;

    this.isResending.set(true);
    this.errorMessage.set('');

    this.authService
      .sendPhoneOtp(this.phoneNumber())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isResending.set(false)),
      )
      .subscribe({
        next: () => {
          // Reset digits
          this.digits.set(['', '', '', '', '', '']);
          this.otpCode.set('');
          // Reset countdown
          this.countdown.set(300);
          this.startCountdown();
          // Reset resend cooldown
          this.canResend.set(false);
          this.resendCooldown.set(30);
          this.startResendCooldown();
        },
        error: (err) => {
          if (err.status === 429) {
            this.errorMessage.set(
              'Too many requests. Please wait before trying again.',
            );
          } else {
            this.errorMessage.set(
              'Failed to resend code. Please try again later.',
            );
          }
        },
      });
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private startCountdown(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      const current = this.countdown();
      if (current <= 1) {
        this.countdown.set(0);
        if (this.countdownTimer) clearInterval(this.countdownTimer);
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  private startResendCooldown(): void {
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.resendTimer = setInterval(() => {
      const current = this.resendCooldown();
      if (current <= 1) {
        this.resendCooldown.set(0);
        this.canResend.set(true);
        if (this.resendTimer) clearInterval(this.resendTimer);
      } else {
        this.resendCooldown.set(current - 1);
      }
    }, 1000);
  }
}
