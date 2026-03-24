import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable, Subscription, timer, retry, share } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

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

  readonly messages$: Observable<WebSocketMessage> =
    this.messagesSubject$.asObservable();
  readonly connectionStatus$: Observable<boolean> =
    this.connectionStatusSubject$.asObservable();

  connect(): void {
    if (this.socket$) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // No token in URL - the browser sends HttpOnly cookies automatically with WS upgrade
    const wsUrl = `${protocol}//${host}/api/ws`;

    this.socket$ = webSocket<WebSocketMessage>({
      url: wsUrl,
      openObserver: {
        next: () => {
          this.connectionStatusSubject$.next(true);
        },
      },
      closeObserver: {
        next: () => {
          this.connectionStatusSubject$.next(false);
        },
      },
    });

    this.socketSubscription = this.socket$
      .pipe(
        retry({
          count: 10,
          delay: (_error, retryCount) => timer(Math.min(1000 * Math.pow(2, retryCount - 1), 60000)),
          resetOnSuccess: true,
        }),
        share(),
      )
      .subscribe({
        next: (message) => this.messagesSubject$.next(message),
        error: () => {
          /* WebSocket reconnects automatically via retry */
        },
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
      /* WebSocket not connected - message dropped */
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.messagesSubject$.complete();
    this.connectionStatusSubject$.complete();
  }
}
