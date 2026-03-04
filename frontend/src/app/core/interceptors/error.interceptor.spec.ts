import { TestBed } from '@angular/core/testing';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { errorInterceptor } from './error.interceptor';
import { MessageService } from 'primeng/api';

describe('errorInterceptor', () => {
  let mockMessageService: {
    add: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockMessageService = {
      add: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: MessageService, useValue: mockMessageService }],
    });
  });

  function runInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
    return TestBed.runInInjectionContext(() => errorInterceptor(req, next));
  }

  describe('successful requests', () => {
    it('should pass through successful responses without showing messages', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      const response = new HttpResponse({ status: 200, body: { data: [] } });
      const next: HttpHandlerFn = () => of(response);

      let receivedResponse: HttpResponse<unknown> | undefined;

      runInterceptor(req, next).subscribe({
        next: (res) => {
          receivedResponse = res as HttpResponse<unknown>;
        },
      });

      expect(receivedResponse).toBe(response);
      expect(mockMessageService.add).not.toHaveBeenCalled();
    });
  });

  describe('401 errors', () => {
    it('should skip 401 errors (handled by auth interceptor)', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      const error401 = new HttpErrorResponse({ status: 401 });
      const next: HttpHandlerFn = () => throwError(() => error401);

      let caughtError: HttpErrorResponse | undefined;

      runInterceptor(req, next).subscribe({
        error: (err) => {
          caughtError = err;
        },
      });

      expect(caughtError).toBe(error401);
      expect(mockMessageService.add).not.toHaveBeenCalled();
    });
  });

  describe('400 errors', () => {
    it('should show a warning toast for 400 errors', () => {
      const req = new HttpRequest('POST', '/api/tasks');
      const error400 = new HttpErrorResponse({
        status: 400,
        error: { message: 'Title is required' },
      });
      const next: HttpHandlerFn = () => throwError(() => error400);

      runInterceptor(req, next).subscribe({ error: () => {} });

      expect(mockMessageService.add).toHaveBeenCalledWith({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Title is required',
        life: 5000,
      });
    });

    it('should extract error field from body when message is absent', () => {
      const req = new HttpRequest('POST', '/api/tasks');
      const error400 = new HttpErrorResponse({
        status: 400,
        error: { error: 'Bad request format' },
      });
      const next: HttpHandlerFn = () => throwError(() => error400);

      runInterceptor(req, next).subscribe({ error: () => {} });

      expect(mockMessageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'Bad request format',
        }),
      );
    });
  });

  describe('403 errors', () => {
    it('should show an access denied error toast for 403 errors', () => {
      const req = new HttpRequest('DELETE', '/api/tasks/1');
      const error403 = new HttpErrorResponse({ status: 403 });
      const next: HttpHandlerFn = () => throwError(() => error403);

      runInterceptor(req, next).subscribe({ error: () => {} });

      expect(mockMessageService.add).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Access Denied',
        detail: "You don't have permission to perform this action.",
        life: 5000,
      });
    });
  });

  describe('404 errors', () => {
    it('should show a not found warning toast for 404 errors', () => {
      const req = new HttpRequest('GET', '/api/tasks/nonexistent');
      const error404 = new HttpErrorResponse({ status: 404 });
      const next: HttpHandlerFn = () => throwError(() => error404);

      runInterceptor(req, next).subscribe({ error: () => {} });

      expect(mockMessageService.add).toHaveBeenCalledWith({
        severity: 'warn',
        summary: 'Not Found',
        detail: 'The requested resource was not found.',
        life: 5000,
      });
    });
  });

  describe('500+ errors', () => {
    it('should show a server error toast for 500 errors', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      const error500 = new HttpErrorResponse({ status: 500 });
      const next: HttpHandlerFn = () => throwError(() => error500);

      runInterceptor(req, next).subscribe({ error: () => {} });

      expect(mockMessageService.add).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Server Error',
        detail: 'Something went wrong. Please try again later.',
        life: 5000,
      });
    });

    it('should show a server error toast for 502 errors', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      const error502 = new HttpErrorResponse({ status: 502 });
      const next: HttpHandlerFn = () => throwError(() => error502);

      runInterceptor(req, next).subscribe({ error: () => {} });

      expect(mockMessageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'Server Error',
        }),
      );
    });

    it('should show a server error toast for 503 errors', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      const error503 = new HttpErrorResponse({ status: 503 });
      const next: HttpHandlerFn = () => throwError(() => error503);

      runInterceptor(req, next).subscribe({ error: () => {} });

      expect(mockMessageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'Server Error',
        }),
      );
    });
  });

  describe('other status codes', () => {
    it('should not show toast for unknown status codes below 500', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      const error409 = new HttpErrorResponse({ status: 409 });
      const next: HttpHandlerFn = () => throwError(() => error409);

      runInterceptor(req, next).subscribe({ error: () => {} });

      expect(mockMessageService.add).not.toHaveBeenCalled();
    });
  });

  describe('error message extraction', () => {
    it('should use message field from error body', () => {
      const req = new HttpRequest('POST', '/api/tasks');
      const error400 = new HttpErrorResponse({
        status: 400,
        error: { message: 'Custom message' },
      });
      const next: HttpHandlerFn = () => throwError(() => error400);

      runInterceptor(req, next).subscribe({ error: () => {} });

      expect(mockMessageService.add).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'Custom message' }),
      );
    });

    it('should use error field from body when message is absent', () => {
      const req = new HttpRequest('POST', '/api/tasks');
      const error400 = new HttpErrorResponse({
        status: 400,
        error: { error: 'Validation failed' },
      });
      const next: HttpHandlerFn = () => throwError(() => error400);

      runInterceptor(req, next).subscribe({ error: () => {} });

      expect(mockMessageService.add).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'Validation failed' }),
      );
    });

    it('should use HttpErrorResponse.message when body has no string fields', () => {
      const req = new HttpRequest('POST', '/api/tasks');
      const error400 = new HttpErrorResponse({
        status: 400,
        statusText: 'Bad Request',
        url: '/api/tasks',
      });
      const next: HttpHandlerFn = () => throwError(() => error400);

      runInterceptor(req, next).subscribe({ error: () => {} });

      // HttpErrorResponse.message includes "Http failure response for /api/tasks: 400 Bad Request"
      expect(mockMessageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.stringContaining('Http failure response'),
        }),
      );
    });
  });

  describe('error propagation', () => {
    it('should always re-throw the error after showing toast', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      const error500 = new HttpErrorResponse({ status: 500 });
      const next: HttpHandlerFn = () => throwError(() => error500);

      let caughtError: HttpErrorResponse | undefined;

      runInterceptor(req, next).subscribe({
        error: (err) => {
          caughtError = err;
        },
      });

      expect(caughtError).toBe(error500);
    });
  });
});
