import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { WebSocketService, WebSocketMessage } from './websocket.service';
import * as rxjsWebSocket from 'rxjs/webSocket';
import { Subject } from 'rxjs';

describe('WebSocketService', () => {
  let service: WebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WebSocketService],
    });

    service = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose messages$ observable', () => {
    expect(service.messages$).toBeDefined();
    expect(typeof service.messages$.subscribe).toBe('function');
  });

  it('should expose connectionStatus$ observable', () => {
    expect(service.connectionStatus$).toBeDefined();
    expect(typeof service.connectionStatus$.subscribe).toBe('function');
  });

  it('should have connect method', () => {
    expect(typeof service.connect).toBe('function');
  });

  it('should have disconnect method', () => {
    expect(typeof service.disconnect).toBe('function');
  });

  it('should have send method', () => {
    expect(typeof service.send).toBe('function');
  });

  it('should not throw when disconnect is called without connect', () => {
    expect(() => service.disconnect()).not.toThrow();
  });

  it('should clean up on ngOnDestroy', () => {
    expect(() => service.ngOnDestroy()).not.toThrow();
  });

  describe('send() without connection', () => {
    it('should silently drop message when not connected', () => {
      // No connect() called, so socket$ is null
      expect(() => service.send('test', { data: 'hello' })).not.toThrow();
    });
  });

  describe('connect()', () => {
    let mockSocketSubject: Subject<WebSocketMessage>;

    beforeEach(() => {
      mockSocketSubject = new Subject<WebSocketMessage>();
      // Add webSocket-like methods
      (mockSocketSubject as any).next = vi.fn();
      const origComplete = mockSocketSubject.complete.bind(mockSocketSubject);
      (mockSocketSubject as any).complete = vi.fn().mockImplementation(() => {
        origComplete();
      });

      vi.spyOn(rxjsWebSocket, 'webSocket').mockReturnValue(
        mockSocketSubject as any,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create a websocket connection', () => {
      service.connect();

      expect(rxjsWebSocket.webSocket).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/api/ws'),
        }),
      );
    });

    it('should not create a second connection if already connected', () => {
      service.connect();
      service.connect();

      expect(rxjsWebSocket.webSocket).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to the socket after connect', () => {
      service.connect();

      // Socket should have been subscribed to (the pipe chain is active)
      expect(mockSocketSubject.observed).toBe(true);
    });

    it('should send messages via socket when connected', () => {
      service.connect();

      service.send('subscribe', { channel: 'board:123' });

      expect((mockSocketSubject as any).next).toHaveBeenCalledWith({
        type: 'subscribe',
        payload: { channel: 'board:123' },
      });
    });
  });

  describe('disconnect()', () => {
    let mockSocketSubject: Subject<WebSocketMessage>;

    beforeEach(() => {
      mockSocketSubject = new Subject<WebSocketMessage>();
      (mockSocketSubject as any).next = vi.fn();
      (mockSocketSubject as any).complete = vi.fn();

      vi.spyOn(rxjsWebSocket, 'webSocket').mockReturnValue(
        mockSocketSubject as any,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should complete the socket and clear references', () => {
      service.connect();
      service.disconnect();

      expect((mockSocketSubject as any).complete).toHaveBeenCalled();
    });

    it('should allow reconnect after disconnect', () => {
      service.connect();
      service.disconnect();
      service.connect();

      expect(rxjsWebSocket.webSocket).toHaveBeenCalledTimes(2);
    });

    it('should silently drop sends after disconnect', () => {
      service.connect();
      service.disconnect();

      expect(() => service.send('test', {})).not.toThrow();
    });
  });

  describe('ngOnDestroy()', () => {
    it('should disconnect and complete subjects', () => {
      let messagesCompleted = false;
      let statusCompleted = false;

      service.messages$.subscribe({
        complete: () => {
          messagesCompleted = true;
        },
      });
      service.connectionStatus$.subscribe({
        complete: () => {
          statusCompleted = true;
        },
      });

      service.ngOnDestroy();

      expect(messagesCompleted).toBe(true);
      expect(statusCompleted).toBe(true);
    });

    it('should handle being called multiple times', () => {
      service.ngOnDestroy();
      expect(() => service.ngOnDestroy()).not.toThrow();
    });
  });
});
