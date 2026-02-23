import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FilterPreset {
  id: string;
  user_id: string;
  board_id: string;
  name: string;
  filters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateFilterPresetRequest {
  name: string;
  filters: Record<string, unknown>;
}

export interface UpdateFilterPresetRequest {
  name?: string;
  filters?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class FilterPresetsService {
  private http = inject(HttpClient);
  private baseUrl = '/api';

  list(boardId: string): Observable<FilterPreset[]> {
    return this.http.get<FilterPreset[]>(
      `${this.baseUrl}/boards/${boardId}/filter-presets`,
    );
  }

  create(
    boardId: string,
    body: CreateFilterPresetRequest,
  ): Observable<FilterPreset> {
    return this.http.post<FilterPreset>(
      `${this.baseUrl}/boards/${boardId}/filter-presets`,
      body,
    );
  }

  update(
    boardId: string,
    presetId: string,
    body: UpdateFilterPresetRequest,
  ): Observable<FilterPreset> {
    return this.http.put<FilterPreset>(
      `${this.baseUrl}/boards/${boardId}/filter-presets/${presetId}`,
      body,
    );
  }

  delete(boardId: string, presetId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/boards/${boardId}/filter-presets/${presetId}`,
    );
  }
}
