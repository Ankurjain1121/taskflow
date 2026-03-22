import { Signal, WritableSignal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  tap,
  finalize,
} from 'rxjs/operators';
import {
  SearchService,
  SearchResults,
} from '../../../core/services/search.service';
import { RECENT_SEARCHES_KEY, MAX_RECENT_SEARCHES } from './command-palette.types';

/**
 * Manages the search pipeline: debouncing, calling the search service,
 * and updating result signals.
 */
export function createSearchPipeline(deps: {
  searchSubject: Subject<string>;
  searchService: SearchService;
  results: WritableSignal<SearchResults | null>;
  hasSearched: WritableSignal<boolean>;
  loading: WritableSignal<boolean>;
  selectedIndex: WritableSignal<number>;
}): Subscription {
  const { searchSubject, searchService, results, hasSearched, loading, selectedIndex } = deps;

  return searchSubject
    .pipe(
      debounceTime(200),
      distinctUntilChanged(),
      tap((q) => {
        if (q.trim()) {
          loading.set(true);
        }
      }),
      switchMap((q) => {
        if (!q.trim()) {
          results.set(null);
          hasSearched.set(false);
          loading.set(false);
          return [];
        }
        return searchService.search(q).pipe(
          tap((searchResults) => {
            results.set(searchResults);
            hasSearched.set(true);
            loading.set(false);
            selectedIndex.set(0);
            saveRecentSearch(q);
          }),
          finalize(() => loading.set(false)),
        );
      }),
    )
    .subscribe();
}

/**
 * Persist a search query to localStorage for recent searches.
 */
export function saveRecentSearch(searchQuery: string): void {
  const trimmed = searchQuery.trim();
  if (!trimmed) return;
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    const current: string[] = stored ? JSON.parse(stored) : [];
    const filtered = current.filter((s) => s !== trimmed);
    const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}
