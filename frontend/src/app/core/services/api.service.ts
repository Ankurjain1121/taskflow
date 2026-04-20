import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, ReplaySubject } from 'rxjs';
import { finalize, share } from 'rxjs/operators';

/**
 * Generic HTTP wrapper with request deduplication.
 *
 * Features:
 * - Deduplicate concurrent GET requests (same path)
 * - Use shareReplay to share single HTTP call across multiple subscribers
 * - Automatic cleanup of pending request tracking
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = '/api';
  private pendingGetRequests = new Map<string, Observable<unknown>>();

  /**
   * GET request with automatic deduplication.
   * Concurrent requests for the same path will share the same HTTP call.
   *
   * @param path API endpoint path (without /api prefix)
   * @returns Shared Observable
   */
  get<T>(path: string): Observable<T> {
    const fullPath = `${this.baseUrl}${path}`;

    // Return cached pending request if available
    if (this.pendingGetRequests.has(fullPath)) {
      return this.pendingGetRequests.get(fullPath) as Observable<T>;
    }

    // Dedupe concurrent subscribers; reset pipeline when refCount hits 0 (matches refCount:true)
    const request$ = this.http.get<T>(fullPath).pipe(
      share({
        connector: () => new ReplaySubject<T>(1),
        resetOnError: true,
        resetOnComplete: false,
        resetOnRefCountZero: true,
      }),
      finalize(() => this.pendingGetRequests.delete(fullPath)),
    );

    this.pendingGetRequests.set(fullPath, request$);
    return request$;
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body);
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`);
  }
}
