import { Observable, retry, timer } from 'rxjs';

/**
 * RxJS operator that retries on transient (5xx / network) errors
 * with exponential backoff. Never retries 4xx client errors.
 */
export function retryTransient<T>(maxRetries = 3): (source: Observable<T>) => Observable<T> {
  return (source: Observable<T>) =>
    source.pipe(
      retry({
        count: maxRetries,
        delay: (error, retryCount) => {
          // Don't retry client errors (4xx)
          const status = error?.status ?? error?.error?.status ?? 0;
          if (status >= 400 && status < 500) {
            throw error;
          }
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 8000);
          return timer(delayMs);
        },
      }),
    );
}
