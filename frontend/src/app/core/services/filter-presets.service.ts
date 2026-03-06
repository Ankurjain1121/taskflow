import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FilterPreset {
  id: string;
  user_id: string;
  project_id: string;
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

  list(projectId: string): Observable<FilterPreset[]> {
    return this.http.get<FilterPreset[]>(
      `${this.baseUrl}/projects/${projectId}/filter-presets`,
    );
  }

  create(
    projectId: string,
    body: CreateFilterPresetRequest,
  ): Observable<FilterPreset> {
    return this.http.post<FilterPreset>(
      `${this.baseUrl}/projects/${projectId}/filter-presets`,
      body,
    );
  }

  update(
    projectId: string,
    presetId: string,
    body: UpdateFilterPresetRequest,
  ): Observable<FilterPreset> {
    return this.http.put<FilterPreset>(
      `${this.baseUrl}/projects/${projectId}/filter-presets/${presetId}`,
      body,
    );
  }

  delete(projectId: string, presetId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/projects/${projectId}/filter-presets/${presetId}`,
    );
  }
}
