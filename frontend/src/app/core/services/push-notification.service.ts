import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  readonly permission = signal<NotificationPermission>('default');
  readonly isSupported = typeof window !== 'undefined' && 'Notification' in window;

  constructor() {
    if (this.isSupported) {
      this.permission.set(Notification.permission);
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) return false;
    const result = await Notification.requestPermission();
    this.permission.set(result);
    return result === 'granted';
  }

  notify(title: string, body: string, tag: string): void {
    if (this.permission() !== 'granted' || document.hasFocus()) return;
    const n = new Notification(title, { body, tag, icon: '/favicon.ico' });
    n.onclick = () => { window.focus(); n.close(); };
  }
}
