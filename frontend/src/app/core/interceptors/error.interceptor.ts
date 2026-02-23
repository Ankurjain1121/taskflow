import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';

export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Skip 401 - handled by auth interceptor
      if (error.status === 401) {
        return throwError(() => error);
      }

      // Skip auth endpoint errors - handled silently by auth service
      if (req.url.includes('/auth/')) {
        return throwError(() => error);
      }

      const detail = extractErrorMessage(error);

      switch (error.status) {
        case 400:
          messageService.add({
            severity: 'warn',
            summary: 'Validation Error',
            detail,
            life: 5000,
          });
          break;
        case 403:
          messageService.add({
            severity: 'error',
            summary: 'Access Denied',
            detail: "You don't have permission to perform this action.",
            life: 5000,
          });
          break;
        case 404:
          messageService.add({
            severity: 'warn',
            summary: 'Not Found',
            detail: 'The requested resource was not found.',
            life: 5000,
          });
          break;
        default:
          if (error.status >= 500) {
            messageService.add({
              severity: 'error',
              summary: 'Server Error',
              detail: 'Something went wrong. Please try again later.',
              life: 5000,
            });
          }
          break;
      }

      return throwError(() => error);
    }),
  );
};

function extractErrorMessage(error: HttpErrorResponse): string {
  if (typeof error.error === 'object' && error.error !== null) {
    const body = error.error as Record<string, unknown>;
    if (typeof body['message'] === 'string') {
      return body['message'];
    }
    if (typeof body['error'] === 'string') {
      return body['error'];
    }
  }

  if (typeof error.message === 'string' && error.message) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}
