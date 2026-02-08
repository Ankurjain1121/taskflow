import { Injectable, signal, computed } from '@angular/core';
import { NotificationEventType } from '../../../core/services/notification.service';

export interface ToastNotification {
  id: string;
  event_type: NotificationEventType;
  title: string;
  body: string;
  link_url: string | null;
}

interface ToastEntry {
  toast: ToastNotification;
  timerId: ReturnType<typeof setTimeout>;
}

const MAX_VISIBLE_TOASTS = 3;
const DEFAULT_DISMISS_MS = 5000;

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private _entries = signal<ToastEntry[]>([]);

  /** Visible toasts for the component to consume (max 3, newest last). */
  readonly toasts = computed(() =>
    this._entries().map((e) => e.toast)
  );

  /**
   * Show a toast notification. If the maximum number of toasts is already
   * visible, the oldest toast is dismissed to make room.
   */
  show(notification: ToastNotification, duration = DEFAULT_DISMISS_MS): void {
    // Evict oldest if at capacity
    if (this._entries().length >= MAX_VISIBLE_TOASTS) {
      const oldest = this._entries()[0];
      this.dismiss(oldest.toast.id);
    }

    const timerId = setTimeout(() => {
      this.dismiss(notification.id);
    }, duration);

    const entry: ToastEntry = { toast: notification, timerId };

    this._entries.update((entries) => [...entries, entry]);
  }

  /** Dismiss a specific toast by id. */
  dismiss(id: string): void {
    this._entries.update((entries) => {
      const target = entries.find((e) => e.toast.id === id);
      if (target) {
        clearTimeout(target.timerId);
      }
      return entries.filter((e) => e.toast.id !== id);
    });
  }

  /** Dismiss all toasts. */
  dismissAll(): void {
    this._entries().forEach((e) => clearTimeout(e.timerId));
    this._entries.set([]);
  }
}
