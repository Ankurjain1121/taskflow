import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const SKIP_RETRY_URLS = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/refresh',
  '/auth/logout',
  '/auth/me',
];

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Add withCredentials to all /api requests so cookies are sent automatically
  let authReq = req;
  if (req.url.startsWith('/api')) {
    authReq = req.clone({
      withCredentials: true,
    });
  }

  // Skip retry logic for auth endpoints
  if (SKIP_RETRY_URLS.some((url) => req.url.includes(url))) {
    return next(authReq);
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        if (authService.isRefreshInProgress()) {
          // Another request already triggered a refresh — wait for it, then retry
          return authService.waitForRefresh().pipe(
            switchMap((success) => {
              if (success) {
                const retryReq = req.clone({ withCredentials: true });
                return next(retryReq);
              }
              return throwError(() => error);
            }),
          );
        }

        // First 401 — start the refresh
        return authService.refresh().pipe(
          switchMap(() => {
            const retryReq = req.clone({ withCredentials: true });
            return next(retryReq);
          }),
          catchError((refreshError) => {
            authService.signOut('expired');
            router.navigate(['/auth/sign-in'], {
              queryParams: { returnUrl: router.url },
            });
            return throwError(() => refreshError);
          }),
        );
      }

      return throwError(() => error);
    }),
  );
};
