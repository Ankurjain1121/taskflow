import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FavoriteItem {
  id: string;
  entity_type: 'task' | 'board';
  entity_id: string;
  name: string;
  board_id: string | null;
  workspace_id: string | null;
  created_at: string;
}

export interface AddFavoriteRequest {
  entity_type: 'task' | 'board';
  entity_id: string;
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly apiUrl = '/api/favorites';

  constructor(private http: HttpClient) {}

  list(): Observable<FavoriteItem[]> {
    return this.http.get<FavoriteItem[]>(this.apiUrl);
  }

  add(request: AddFavoriteRequest): Observable<{ id: string; success: boolean }> {
    return this.http.post<{ id: string; success: boolean }>(this.apiUrl, request);
  }

  remove(entityType: string, entityId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/${entityType}/${entityId}`
    );
  }

  check(entityType: string, entityId: string): Observable<{ favorited: boolean }> {
    return this.http.get<{ favorited: boolean }>(
      `${this.apiUrl}/check/${entityType}/${entityId}`
    );
  }
}
