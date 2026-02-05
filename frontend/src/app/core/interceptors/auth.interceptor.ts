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

  // Skip auth header for auth endpoints
  if (req.url.includes('/auth/sign-in') || req.url.includes('/auth/refresh')) {
    return next(req);
  }

  const token = authService.getAccessToken();
  let authReq = req;

  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        // Attempt to refresh the token
        if (!authService.isRefreshInProgress()) {
          return authService.refresh().pipe(
            switchMap((response) => {
              // Retry the original request with new token
              const retryReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${response.access_token}`,
                },
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
