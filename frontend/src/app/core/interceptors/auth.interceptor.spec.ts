import { TestBed } from '@angular/core/testing';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let mockAuthService: {
    isRefreshInProgress: ReturnType<typeof vi.fn>;
    waitForRefresh: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
    url: string;
  };

  beforeEach(() => {
    mockAuthService = {
      isRefreshInProgress: vi.fn().mockReturnValue(false),
      waitForRefresh: vi.fn(),
      refresh: vi.fn(),
      signOut: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
      url: '/dashboard',
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  function runInterceptor(
    req: HttpRequest<unknown>,
    next: HttpHandlerFn,
  ) {
    return TestBed.runInInjectionContext(() => authInterceptor(req, next));
  }

  describe('withCredentials on /api requests', () => {
    it('should set withCredentials for /api requests', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      let clonedReq: HttpRequest<unknown> | undefined;

      const next: HttpHandlerFn = (r) => {
        clonedReq = r;
        return of(new HttpResponse({ status: 200 }));
      };

      runInterceptor(req, next).subscribe();

      expect(clonedReq).toBeDefined();
      expect(clonedReq!.withCredentials).toBe(true);
    });

    it('should NOT set withCredentials for non-api requests', () => {
      const req = new HttpRequest('GET', 'https://external.com/data');
      let clonedReq: HttpRequest<unknown> | undefined;

      const next: HttpHandlerFn = (r) => {
        clonedReq = r;
        return of(new HttpResponse({ status: 200 }));
      };

      runInterceptor(req, next).subscribe();

      expect(clonedReq).toBeDefined();
      expect(clonedReq!.withCredentials).toBe(false);
    });
  });

  describe('skip retry for auth endpoints', () => {
    const authUrls = [
      '/api/auth/sign-in',
      '/api/auth/sign-up',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/auth/me',
    ];

    for (const url of authUrls) {
      it(`should pass through ${url} without retry logic`, () => {
        const req = new HttpRequest('POST', url);
        const error401 = new HttpErrorResponse({ status: 401, url });

        const next: HttpHandlerFn = () => throwError(() => error401);
        let caughtError: HttpErrorResponse | undefined;

        runInterceptor(req, next).subscribe({
          error: (err) => {
            caughtError = err;
          },
        });

        expect(caughtError).toBe(error401);
        // refresh should NOT be called for auth endpoints
        expect(mockAuthService.refresh).not.toHaveBeenCalled();
        expect(mockAuthService.signOut).not.toHaveBeenCalled();
      });
    }
  });

  describe('successful requests', () => {
    it('should pass through successful responses', () => {
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
    });
  });

  describe('non-401 errors', () => {
    it('should pass through 403 errors without attempting refresh', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      const error403 = new HttpErrorResponse({ status: 403 });
      const next: HttpHandlerFn = () => throwError(() => error403);

      let caughtError: HttpErrorResponse | undefined;

      runInterceptor(req, next).subscribe({
        error: (err) => {
          caughtError = err;
        },
      });

      expect(caughtError).toBe(error403);
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });

    it('should pass through 500 errors without attempting refresh', () => {
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
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });
  });

  describe('401 handling — first request triggers refresh', () => {
    it('should attempt refresh on 401 and retry the original request', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      const error401 = new HttpErrorResponse({ status: 401, url: '/api/tasks' });
      const successResponse = new HttpResponse({ status: 200, body: { data: [] } });

      let callCount = 0;
      const next: HttpHandlerFn = (r) => {
        callCount++;
        if (callCount === 1) {
          return throwError(() => error401);
        }
        // After refresh, the retry should have withCredentials
        expect(r.withCredentials).toBe(true);
        return of(successResponse);
      };

      mockAuthService.refresh.mockReturnValue(of({ access_token: 'new' }));

      let receivedResponse: HttpResponse<unknown> | undefined;

      runInterceptor(req, next).subscribe({
        next: (res) => {
          receivedResponse = res as HttpResponse<unknown>;
        },
      });

      expect(mockAuthService.refresh).toHaveBeenCalledOnce();
      expect(receivedResponse).toBe(successResponse);
    });

    it('should sign out and redirect when refresh fails', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      const error401 = new HttpErrorResponse({ status: 401, url: '/api/tasks' });
      const refreshError = new Error('Refresh failed');

      const next: HttpHandlerFn = () => throwError(() => error401);
      mockAuthService.refresh.mockReturnValue(throwError(() => refreshError));

      let caughtError: Error | undefined;

      runInterceptor(req, next).subscribe({
        error: (err) => {
          caughtError = err;
        },
      });

      expect(mockAuthService.signOut).toHaveBeenCalledWith('expired');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth/sign-in'], {
        queryParams: { returnUrl: '/dashboard' },
      });
      expect(caughtError).toBe(refreshError);
    });
  });

  describe('401 handling — refresh already in progress', () => {
    it('should wait for existing refresh and retry on success', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      const error401 = new HttpErrorResponse({ status: 401, url: '/api/tasks' });
      const successResponse = new HttpResponse({ status: 200, body: { data: [] } });

      mockAuthService.isRefreshInProgress.mockReturnValue(true);
      mockAuthService.waitForRefresh.mockReturnValue(of(true));

      let callCount = 0;
      const next: HttpHandlerFn = (r) => {
        callCount++;
        if (callCount === 1) {
          return throwError(() => error401);
        }
        return of(successResponse);
      };

      let receivedResponse: HttpResponse<unknown> | undefined;

      runInterceptor(req, next).subscribe({
        next: (res) => {
          receivedResponse = res as HttpResponse<unknown>;
        },
      });

      expect(mockAuthService.refresh).not.toHaveBeenCalled();
      expect(mockAuthService.waitForRefresh).toHaveBeenCalledOnce();
      expect(receivedResponse).toBe(successResponse);
    });

    it('should propagate error when waiting refresh returns failure', () => {
      const req = new HttpRequest('GET', '/api/tasks');
      const error401 = new HttpErrorResponse({ status: 401, url: '/api/tasks' });

      mockAuthService.isRefreshInProgress.mockReturnValue(true);
      mockAuthService.waitForRefresh.mockReturnValue(of(false));

      const next: HttpHandlerFn = () => throwError(() => error401);

      let caughtError: HttpErrorResponse | undefined;

      runInterceptor(req, next).subscribe({
        error: (err) => {
          caughtError = err;
        },
      });

      expect(caughtError).toBe(error401);
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });
  });

  describe('401 on /auth/ URLs (non-skip-list)', () => {
    it('should NOT attempt refresh for 401 on /auth/ sub-paths', () => {
      // The guard checks req.url.includes('/auth/'), so any /auth/ path
      // that is NOT in SKIP_RETRY_URLS will still be skipped by the
      // inner check `!req.url.includes('/auth/')`
      const req = new HttpRequest('POST', '/api/auth/change-password');
      const error401 = new HttpErrorResponse({
        status: 401,
        url: '/api/auth/change-password',
      });
      const next: HttpHandlerFn = () => throwError(() => error401);

      let caughtError: HttpErrorResponse | undefined;

      runInterceptor(req, next).subscribe({
        error: (err) => {
          caughtError = err;
        },
      });

      expect(caughtError).toBe(error401);
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });
  });
});
