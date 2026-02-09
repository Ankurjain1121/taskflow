import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable, timer, retry, share } from 'rxjs';
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
    // SECURITY: Connect without token in URL to avoid token exposure in logs/history/referrer
    // Token is sent as the first message after connection establishes
    const wsUrl = `${protocol}//${host}/api/ws`;

    this.socket$ = webSocket<WebSocketMessage>({
      url: wsUrl,
      openObserver: {
        next: () => {
          console.log('WebSocket connected, sending auth...');
          // SECURITY: Send auth token as first message instead of in URL
          // This prevents token from appearing in server logs, browser history, and Referer headers
          this.socket$?.next({ type: 'auth', payload: { token } });
          this.connectionStatusSubject$.next(true);
        },
      },
      closeObserver: {
        next: () => {
          console.log('WebSocket disconnected');
          this.connectionStatusSubject$.next(false);
          this.socket$ = null;
        },
      },
    });

    this.socket$
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
