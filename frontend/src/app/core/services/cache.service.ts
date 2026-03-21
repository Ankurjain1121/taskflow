import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

export interface CacheEntry<T> {
  observable: Observable<T>;
  timestamp: number;
}

/**
 * Intelligent caching service for reducing redundant API calls.
 *
 * Features:
 * - TTL-based cache expiration
 * - Request deduplication (concurrent requests share single HTTP call)
 * - Pattern-based cache invalidation
 * - Configurable TTL per cache entry
 */
@Injectable({
  providedIn: 'root',
})
export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTtl = 60000; // 60 seconds

  /**
   * Get a cached observable, or create and cache a new one.
   * Concurrent requests for the same key will share the same HTTP call.
   *
   * @param key Cache key identifier
   * @param factory Function that creates the HTTP Observable
   * @param ttl Time-to-live in milliseconds (default: 60000ms)
   * @returns Cached or fresh Observable
   */
  get<T>(
    key: string,
    factory: () => Observable<T>,
    ttl?: number,
  ): Observable<T> {
    const existing = this.cache.get(key) as CacheEntry<T> | undefined;
    const effectiveTtl = ttl ?? this.defaultTtl;

    if (existing && Date.now() - existing.timestamp < effectiveTtl) {
      return existing.observable;
    }

    // Use shareReplay to deduplicate concurrent requests
    const obs = factory().pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.cache.set(key, { observable: obs, timestamp: Date.now() });
    return obs;
  }

  /**
   * Invalidate cache entries matching a regex pattern.
   * Example: invalidate('board:.*') removes all board cache entries.
   *
   * @param pattern Regex pattern to match cache keys
   */
  invalidate(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const keysToDelete = Array.from(this.cache.keys()).filter((key) =>
      regex.test(key),
    );
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Invalidate a specific cache key.
   *
   * @param key Exact cache key to remove
   */
  invalidateKey(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging.
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
