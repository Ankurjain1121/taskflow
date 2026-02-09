import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// Audit Log Types
export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    email: string;
  };
}

export interface AuditLogResponse {
  items: AuditLogEntry[];
  next_cursor: string | null;
  total_count?: number;
}

export interface AuditLogParams {
  cursor?: string;
  page_size?: number;
  user_id?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

// Admin User Types
export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'manager' | 'member';
  workspace_count: number;
  created_at: string;
  last_active_at: string | null;
  email_verified: boolean;
}

// Trash Types
export interface TrashItem {
  id: string;
  entity_type: 'task' | 'board' | 'workspace';
  entity_id: string;
  name: string;
  deleted_by: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  deleted_at: string;
  expires_at: string;
  metadata: Record<string, unknown> | null;
}

export interface TrashResponse {
  items: TrashItem[];
  next_cursor: string | null;
  total_count?: number;
}

export interface TrashParams {
  entity_type?: string;
  cursor?: string;
  page_size?: number;
}

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private readonly apiUrl = '/api/admin';

  constructor(private http: HttpClient) {}

  // Audit Log Methods
  getAuditLog(params: AuditLogParams = {}): Observable<AuditLogResponse> {
    let httpParams = new HttpParams();

    if (params.cursor) {
      httpParams = httpParams.set('cursor', params.cursor);
    }
    if (params.page_size) {
      httpParams = httpParams.set('page_size', params.page_size.toString());
    }
    if (params.user_id) {
      httpParams = httpParams.set('user_id', params.user_id);
    }
    if (params.action) {
      httpParams = httpParams.set('action', params.action);
    }
    if (params.entity_type) {
      httpParams = httpParams.set('entity_type', params.entity_type);
    }
    if (params.date_from) {
      httpParams = httpParams.set('date_from', params.date_from);
    }
    if (params.date_to) {
      httpParams = httpParams.set('date_to', params.date_to);
    }
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }

    return this.http.get<AuditLogResponse>(`${this.apiUrl}/audit-log`, {
      params: httpParams,
    });
  }

  getAuditActions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/audit-log/actions`);
  }

  // User Management Methods
  getUsers(params: { search?: string; role?: string } = {}): Observable<AdminUser[]> {
    let httpParams = new HttpParams();

    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.role) {
      httpParams = httpParams.set('role', params.role);
    }

    return this.http.get<AdminUser[]>(`${this.apiUrl}/users`, {
      params: httpParams,
    });
  }

  updateUserRole(userId: string, role: 'admin' | 'manager' | 'member'): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/users/${userId}/role`, { role });
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/${userId}`);
  }

  // Trash Management Methods
  getTrashItems(params: TrashParams = {}): Observable<TrashResponse> {
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

    return this.http.get<TrashResponse>(`${this.apiUrl}/trash`, {
      params: httpParams,
    });
  }

  restoreItem(entityType: string, entityId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/trash/${entityType}/${entityId}/restore`, {});
  }

  permanentlyDelete(entityType: string, entityId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/trash/${entityType}/${entityId}`);
  }

  emptyTrash(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/trash`);
  }
}
