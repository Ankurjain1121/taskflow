import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ArchiveItem {
  entity_type: 'task' | 'project';
  entity_id: string;
  name: string;
  deleted_at: string;
  days_remaining: number;
}

export interface PaginatedArchive {
  items: ArchiveItem[];
  next_cursor: string | null;
}

export interface ArchiveListParams {
  entity_type?: string;
  cursor?: string;
  page_size?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ArchiveService {
  private readonly apiUrl = '/api/archive';

  constructor(private http: HttpClient) {}

  list(params: ArchiveListParams = {}): Observable<PaginatedArchive> {
    let httpParams = new HttpParams();
    if (params.entity_type) {
      httpParams = httpParams.set('entity_type', params.entity_type);
    }
    if (params.cursor) {
      httpParams = httpParams.set('cursor', params.cursor);
    }
    if (params.page_size) {
      httpParams = httpParams.set('page_size', params.page_size.toString());
    }
    return this.http.get<PaginatedArchive>(this.apiUrl, { params: httpParams });
  }

  restore(
    entityType: string,
    entityId: string,
  ): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/restore`,
      { entity_type: entityType, entity_id: entityId },
    );
  }

  permanentlyDelete(
    entityType: string,
    entityId: string,
  ): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/${entityType}/${entityId}`,
    );
  }
}
