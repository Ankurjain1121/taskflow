import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

@Injectable({ providedIn: 'root' })
export class HapticService {
  private readonly isNative = Capacitor.isNativePlatform();

  async light(): Promise<void> {
    if (!this.isNative) return;
    await Haptics.impact({ style: ImpactStyle.Light });
  }

  async medium(): Promise<void> {
    if (!this.isNative) return;
    await Haptics.impact({ style: ImpactStyle.Medium });
  }

  async heavy(): Promise<void> {
    if (!this.isNative) return;
    await Haptics.impact({ style: ImpactStyle.Heavy });
  }

  async success(): Promise<void> {
    if (!this.isNative) return;
    await Haptics.notification({ type: NotificationType.Success });
  }

  async warning(): Promise<void> {
    if (!this.isNative) return;
    await Haptics.notification({ type: NotificationType.Warning });
  }

  async error(): Promise<void> {
    if (!this.isNative) return;
    await Haptics.notification({ type: NotificationType.Error });
  }

  async selection(): Promise<void> {
    if (!this.isNative) return;
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  }
}
