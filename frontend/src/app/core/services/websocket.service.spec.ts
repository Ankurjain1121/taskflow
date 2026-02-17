import { TestBed } from '@angular/core/testing';
import { WebSocketService, WebSocketMessage } from './websocket.service';

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
});
