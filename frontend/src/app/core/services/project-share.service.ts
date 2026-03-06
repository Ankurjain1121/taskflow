import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProjectShare {
  id: string;
  project_id: string;
  share_token: string;
  name: string | null;
  expires_at: string | null;
  is_active: boolean;
  permissions: Record<string, boolean>;
  tenant_id: string;
  created_by_id: string;
  created_at: string;
}

export interface CreateShareRequest {
  name?: string;
  password?: string;
  expires_at?: string;
  permissions?: Record<string, boolean>;
}

export interface SharedProjectAccess {
  project_id: string;
  project_name: string;
  permissions: Record<string, boolean>;
  columns: {
    id: string;
    name: string;
    position: string;
    color: string | null;
  }[];
  tasks: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    due_date: string | null;
    column_id: string;
    column_name: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class ProjectShareService {
  constructor(private http: HttpClient) {}

  listShares(projectId: string): Observable<ProjectShare[]> {
    return this.http.get<ProjectShare[]>(`/api/projects/${projectId}/shares`);
  }

  createShare(
    projectId: string,
    req: CreateShareRequest,
  ): Observable<ProjectShare> {
    return this.http.post<ProjectShare>(`/api/projects/${projectId}/shares`, req);
  }

  deleteShare(shareId: string): Observable<void> {
    return this.http.delete<void>(`/api/shares/${shareId}`);
  }

  toggleShare(shareId: string, isActive: boolean): Observable<ProjectShare> {
    return this.http.put<ProjectShare>(`/api/shares/${shareId}`, {
      is_active: isActive,
    });
  }

  accessSharedBoard(
    token: string,
    password?: string,
  ): Observable<SharedProjectAccess> {
    const params: Record<string, string> = {};
    if (password) params['password'] = password;
    return this.http.get<SharedProjectAccess>(`/api/shared/${token}`, { params });
  }
}
