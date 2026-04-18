import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BiometricService } from '../../../core/services/biometric.service';
import { HapticService } from '../../../core/services/haptic.service';

@Component({
  selector: 'app-lock-screen',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-[99999] flex flex-col items-center justify-center"
      style="background-color: var(--background)"
    >
      <!-- Logo / brand mark -->
      <div class="mb-8 flex flex-col items-center gap-3">
        <div
          class="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
          style="background-color: var(--primary)"
        >
          TB
        </div>
        <span
          class="text-lg font-semibold"
          style="color: var(--foreground)"
        >
          TaskBolt
        </span>
      </div>

      <!-- Unlock button -->
      <button
        (click)="onUnlock()"
        [disabled]="unlocking()"
        class="flex flex-col items-center gap-3 px-8 py-4 rounded-2xl transition-all duration-200 active:scale-95"
        style="background-color: var(--secondary); color: var(--foreground)"
      >
        <i
          class="pi text-3xl"
          [class.pi-lock]="!unlocking()"
          [class.pi-spin]="unlocking()"
          [class.pi-spinner]="unlocking()"
          style="color: var(--primary)"
        ></i>
        <span class="text-sm font-medium" style="color: var(--muted-foreground)">
          {{ unlocking() ? 'Verifying...' : 'Tap to unlock' }}
        </span>
      </button>

      <!-- Error message -->
      @if (errorMessage()) {
        <p
          class="mt-4 text-sm"
          style="color: var(--destructive)"
        >
          {{ errorMessage() }}
        </p>
      }
    </div>
  `,
})
export class LockScreenComponent {
  private biometricService = inject(BiometricService);
  private hapticService = inject(HapticService);

  readonly unlocking = signal(false);
  readonly errorMessage = signal<string | null>(null);

  async onUnlock(): Promise<void> {
    this.unlocking.set(true);
    this.errorMessage.set(null);

    await this.hapticService.light();

    const success = await this.biometricService.unlock();

    if (success) {
      await this.hapticService.success();
    } else {
      this.errorMessage.set('Authentication failed. Tap to try again.');
      await this.hapticService.error();
    }

    this.unlocking.set(false);
  }
}
