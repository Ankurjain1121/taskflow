import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

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
  if (req.url.includes('/auth/sign-in') || req.url.includes('/auth/refresh') || req.url.includes('/auth/logout')) {
    return next(authReq);
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        // Attempt to refresh the token (cookie-based)
        if (!authService.isRefreshInProgress()) {
          return authService.refresh().pipe(
            switchMap(() => {
              // Retry the original request - cookies are updated automatically
              const retryReq = req.clone({
                withCredentials: true,
              });
              return next(retryReq);
            }),
            catchError((refreshError) => {
              // Refresh failed, redirect to sign-in
              authService.signOut();
              router.navigate(['/auth/sign-in'], {
                queryParams: { returnUrl: router.url },
              });
              return throwError(() => refreshError);
            })
          );
        }
      }

      return throwError(() => error);
    })
  );
};
