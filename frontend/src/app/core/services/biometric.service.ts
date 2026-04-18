import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

const BIOMETRIC_ENABLED_KEY = 'taskbolt_biometric_lock_enabled';

@Injectable({ providedIn: 'root' })
export class BiometricService {
  private readonly isNative = Capacitor.isNativePlatform();

  /** Whether the user has opted into biometric lock. */
  readonly enabled = signal(this.loadEnabled());

  /** Whether the app is currently locked and awaiting biometric verification. */
  readonly locked = signal(false);

  /** Check if the device supports biometric authentication. */
  async isAvailable(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      const { NativeBiometric } = await import('capacitor-native-biometric');
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch {
      return false;
    }
  }

  /** Lock the app — shows the lock screen overlay. */
  lock(): void {
    if (this.enabled()) {
      this.locked.set(true);
    }
  }

  /**
   * Prompt the user for biometric verification.
   * Returns true if unlocked successfully, false otherwise.
   */
  async unlock(): Promise<boolean> {
    if (!this.isNative) {
      this.locked.set(false);
      return true;
    }
    try {
      const { NativeBiometric } = await import('capacitor-native-biometric');
      await NativeBiometric.verifyIdentity({
        reason: 'Unlock TaskBolt',
        title: 'Authenticate',
        subtitle: 'Use biometrics to unlock the app',
        description: 'Place your finger on the sensor or use face unlock',
      });
      this.locked.set(false);
      return true;
    } catch {
      // User cancelled or biometric failed — remain locked
      return false;
    }
  }

  /** Toggle the biometric lock preference. */
  setEnabled(value: boolean): void {
    this.enabled.set(value);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, String(value));
    }
    // If disabling, also unlock immediately
    if (!value) {
      this.locked.set(false);
    }
  }

  private loadEnabled(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
  }
}
