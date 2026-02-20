import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiKeyListItem {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  key_prefix: string;
  full_key: string;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiKeyService {
  constructor(private http: HttpClient) {}

  createKey(
    workspaceId: string,
    name: string,
  ): Observable<ApiKeyCreateResponse> {
    return this.http.post<ApiKeyCreateResponse>(
      `/api/workspaces/${workspaceId}/api-keys`,
      { name },
    );
  }

  listKeys(workspaceId: string): Observable<ApiKeyListItem[]> {
    return this.http.get<ApiKeyListItem[]>(
      `/api/workspaces/${workspaceId}/api-keys`,
    );
  }

  revokeKey(workspaceId: string, keyId: string): Observable<void> {
    return this.http.delete<void>(
      `/api/workspaces/${workspaceId}/api-keys/${keyId}`,
    );
  }
}
