import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable, Subscription, timer, retry, share } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from './auth.service';

export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
}

@Injectable({
  providedIn: 'root',
})
export class WebSocketService implements OnDestroy {
  private socket$: WebSocketSubject<WebSocketMessage> | null = null;
  private socketSubscription: Subscription | null = null;
  private messagesSubject$ = new Subject<WebSocketMessage>();
  private connectionStatusSubject$ = new Subject<boolean>();

  readonly messages$: Observable<WebSocketMessage> = this.messagesSubject$.asObservable();
  readonly connectionStatus$: Observable<boolean> = this.connectionStatusSubject$.asObservable();

  constructor(private authService: AuthService) {}

  connect(): void {
    if (this.socket$) {
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      console.error('Cannot connect to WebSocket: no access token');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Pass token as query param - the backend supports both query param and message auth.
    // Using query param avoids the rxjs webSocket timing issue where openObserver fires
    // before the internal destination is wired, causing message-based auth to silently fail.
    const wsUrl = `${protocol}//${host}/api/ws?token=${encodeURIComponent(token)}`;

    this.socket$ = webSocket<WebSocketMessage>({
      url: wsUrl,
      openObserver: {
        next: () => {
          console.log('WebSocket connected and authenticated');
          this.connectionStatusSubject$.next(true);
        },
      },
      closeObserver: {
        next: () => {
          console.log('WebSocket disconnected');
          this.connectionStatusSubject$.next(false);
        },
      },
    });

    this.socketSubscription = this.socket$
      .pipe(
        retry({
          delay: () => timer(3000),
        }),
        share()
      )
      .subscribe({
        next: (message) => this.messagesSubject$.next(message),
        error: (error) => console.error('WebSocket error:', error),
      });
  }

  disconnect(): void {
    if (this.socketSubscription) {
      this.socketSubscription.unsubscribe();
      this.socketSubscription = null;
    }
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }
  }

  send<T>(type: string, payload: T): void {
    if (this.socket$) {
      this.socket$.next({ type, payload });
    } else {
      console.error('Cannot send message: WebSocket not connected');
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.messagesSubject$.complete();
    this.connectionStatusSubject$.complete();
  }
}
