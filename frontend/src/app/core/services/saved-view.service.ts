import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface SavedView {
  id: string;
  user_id: string;
  workspace_id: string;
  project_id: string | null;
  name: string;
  view_type: string;
  config: Record<string, unknown>;
  pinned: boolean;
  shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSavedViewRequest {
  name: string;
  view_type: string;
  project_id?: string;
  config: Record<string, unknown>;
  pinned?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SavedViewService {
  private readonly http = inject(HttpClient);

  readonly savedViews = signal<SavedView[]>([]);

  readonly pinnedViews = computed(() =>
    this.savedViews().filter((v) => v.pinned),
  );

  listForWorkspace(wsId: string): Observable<SavedView[]> {
    return this.http
      .get<SavedView[]>(`/api/workspace/${wsId}/saved-views`)
      .pipe(tap((views) => this.savedViews.set(views)));
  }

  create(
    wsId: string,
    req: CreateSavedViewRequest,
  ): Observable<SavedView> {
    return this.http
      .post<SavedView>(`/api/workspace/${wsId}/saved-views`, req)
      .pipe(
        tap((view) =>
          this.savedViews.update((views) => [...views, view]),
        ),
      );
  }

  update(
    id: string,
    req: Partial<CreateSavedViewRequest>,
  ): Observable<SavedView> {
    return this.http
      .put<SavedView>(`/api/saved-views/${id}`, req)
      .pipe(
        tap((updated) =>
          this.savedViews.update((views) =>
            views.map((v) => (v.id === id ? updated : v)),
          ),
        ),
      );
  }

  delete(id: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ success: boolean }>(`/api/saved-views/${id}`)
      .pipe(
        tap(() =>
          this.savedViews.update((views) =>
            views.filter((v) => v.id !== id),
          ),
        ),
      );
  }

  togglePin(id: string, pinned: boolean): Observable<SavedView> {
    return this.http
      .patch<SavedView>(`/api/saved-views/${id}/pin`, { pinned })
      .pipe(
        tap((updated) =>
          this.savedViews.update((views) =>
            views.map((v) => (v.id === id ? updated : v)),
          ),
        ),
      );
  }
}
