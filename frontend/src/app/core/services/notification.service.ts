import { Injectable, signal, computed, OnDestroy, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  interval,
  Subscription,
  tap,
  switchMap,
  filter,
  startWith,
} from 'rxjs';
import { WebSocketService, WebSocketMessage } from './websocket.service';
import { AuthService } from './auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { NotificationSoundService } from './notification-sound.service';
import { PushNotificationService } from './push-notification.service';

import type { NotificationEventType } from './notification.types';
export type { NotificationEventType } from './notification.types';

export interface Notification {
  id: string;
  recipient_id: string;
  event_type: NotificationEventType;
  title: string;
  body: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface UnreadCountResponse {
  count: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private readonly apiUrl = '/api/notifications';
  private readonly POLLING_INTERVAL = 30000; // 30 seconds

  private _unreadCount = signal<number>(0);
  private _notifications = signal<Notification[]>([]);
  private _nextCursor = signal<string | null>(null);
  private _isLoading = signal<boolean>(false);
  private _hasMore = signal<boolean>(true);

  private pollingSubscription: Subscription | null = null;
  private wsSubscription: Subscription | null = null;

  readonly unreadCount = this._unreadCount.asReadonly();
  readonly notifications = this._notifications.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();

  readonly displayBadge = computed(() => {
    const count = this._unreadCount();
    if (count === 0) return '';
    if (count > 99) return '99+';
    return count.toString();
  });

  private toastService = inject(ToastService);
  private soundService = inject(NotificationSoundService);
  private pushService = inject(PushNotificationService);
  private document = inject(DOCUMENT);

  constructor(
    private http: HttpClient,
    private wsService: WebSocketService,
    private authService: AuthService,
  ) {}

  /**
   * Initialize real-time updates via WebSocket and polling fallback
   */
  startRealTimeUpdates(): void {
    this.stopRealTimeUpdates();

    // Initial fetch
    this.fetchUnreadCount().subscribe();

    // Subscribe to WebSocket for real-time updates
    this.wsSubscription = this.wsService.messages$
      .pipe(
        filter(
          (message: WebSocketMessage) => message.type === 'notification:new',
        ),
      )
      .subscribe((message) => {
        const notification = message.payload as Notification;
        this._notifications.update((notifications) => [
          notification,
          ...notifications,
        ]);
        this._unreadCount.update((count) => count + 1);

        // Show toast and play sound only when the page is visible
        if (!this.document.hidden) {
          this.toastService.show({
            id: notification.id,
            event_type: notification.event_type,
            title: notification.title,
            body: notification.body,
            link_url: notification.link_url,
          });
          this.soundService.playNotificationSound();
        }
        this.pushService.notify(
          notification.title,
          notification.body,
          notification.id,
        );
      });

    // Connect WebSocket if not already connected
    this.wsService.connect();

    // Polling fallback every 30 seconds
    this.pollingSubscription = interval(this.POLLING_INTERVAL)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchUnreadCount()),
      )
      .subscribe();
  }

  /**
   * Stop real-time updates
   */
  stopRealTimeUpdates(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
      this.wsSubscription = null;
    }
  }

  /**
   * List notifications with cursor-based pagination
   */
  listNotifications(cursor?: string): Observable<NotificationListResponse> {
    let params = new HttpParams().set('limit', '20');
    if (cursor) {
      params = params.set('cursor', cursor);
    }

    return this.http
      .get<NotificationListResponse>(this.apiUrl, { params })
      .pipe(
        tap((response) => {
          if (cursor) {
            // Append to existing notifications
            this._notifications.update((notifications) => [
              ...notifications,
              ...response.items,
            ]);
          } else {
            // Replace notifications
            this._notifications.set(response.items);
          }
          this._nextCursor.set(response.nextCursor);
          this._hasMore.set(response.nextCursor !== null);
          this._unreadCount.set(response.unreadCount);
        }),
      );
  }

  /**
   * Load more notifications for infinite scroll
   */
  loadMore(): Observable<NotificationListResponse> | null {
    const cursor = this._nextCursor();
    if (!cursor || this._isLoading()) {
      return null;
    }

    this._isLoading.set(true);
    return this.listNotifications(cursor).pipe(
      tap(() => this._isLoading.set(false)),
    );
  }

  /**
   * Get current unread count from server
   */
  getUnreadCount(): Observable<UnreadCountResponse> {
    return this.http.get<UnreadCountResponse>(`${this.apiUrl}/unread-count`);
  }

  /**
   * Fetch and update unread count
   */
  private fetchUnreadCount(): Observable<UnreadCountResponse> {
    return this.getUnreadCount().pipe(
      tap((response) => this._unreadCount.set(response.count)),
    );
  }

  /**
   * Mark a single notification as read
   */
  markRead(id: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/read`, {}).pipe(
      tap(() => {
        this._notifications.update((notifications) =>
          notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        );
        this._unreadCount.update((count) => Math.max(0, count - 1));
      }),
    );
  }

  /**
   * Mark all notifications as read
   */
  markAllRead(): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/read-all`, {}).pipe(
      tap(() => {
        this._notifications.update((notifications) =>
          notifications.map((n) => ({ ...n, is_read: true })),
        );
        this._unreadCount.set(0);
      }),
    );
  }

  /**
   * Dismiss (archive) a notification - removes it from the list optimistically
   */
  dismissNotification(id: string): Observable<void> {
    const notification = this._notifications().find((n) => n.id === id);
    this._notifications.update((notifications) =>
      notifications.filter((n) => n.id !== id),
    );
    if (notification && !notification.is_read) {
      this._unreadCount.update((count) => Math.max(0, count - 1));
    }
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Reset notifications state
   */
  reset(): void {
    this._notifications.set([]);
    this._nextCursor.set(null);
    this._hasMore.set(true);
    this._unreadCount.set(0);
  }

  ngOnDestroy(): void {
    this.stopRealTimeUpdates();
  }
}
