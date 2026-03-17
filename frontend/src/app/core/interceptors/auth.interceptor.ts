import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
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
  next: HttpHandlerFn,
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Add withCredentials and CSRF token to all /api requests
  let authReq = req;
  if (req.url.startsWith('/api')) {
    const csrfToken = authService.csrfToken();
    const needsCsrf =
      csrfToken &&
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
    authReq = req.clone({
      withCredentials: true,
      ...(needsCsrf ? { setHeaders: { 'X-CSRF-Token': csrfToken } } : {}),
    });
  }

  // Skip retry logic for auth endpoints
  if (SKIP_RETRY_URLS.some((url) => req.url.includes(url))) {
    return next(authReq);
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        return authService.refresh().pipe(
          switchMap(() => {
            const freshCsrf = authService.csrfToken();
            const retryReq = req.clone({
              withCredentials: true,
              ...(freshCsrf && !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())
                ? { setHeaders: { 'X-CSRF-Token': freshCsrf } }
                : {}),
            });
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
