import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BoardShare {
  id: string;
  board_id: string;
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

export interface SharedBoardAccess {
  board_id: string;
  board_name: string;
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
    status_id: string | null;
    status_name: string | null;
  }[];
}

@Injectable({ providedIn: 'root' })
export class BoardShareService {
  constructor(private http: HttpClient) {}

  listShares(boardId: string): Observable<BoardShare[]> {
    return this.http.get<BoardShare[]>(`/api/projects/${boardId}/shares`);
  }

  createShare(
    boardId: string,
    req: CreateShareRequest,
  ): Observable<BoardShare> {
    return this.http.post<BoardShare>(`/api/projects/${boardId}/shares`, req);
  }

  deleteShare(shareId: string): Observable<void> {
    return this.http.delete<void>(`/api/shares/${shareId}`);
  }

  toggleShare(shareId: string, isActive: boolean): Observable<BoardShare> {
    return this.http.put<BoardShare>(`/api/shares/${shareId}`, {
      is_active: isActive,
    });
  }

  accessSharedBoard(
    token: string,
    password?: string,
  ): Observable<SharedBoardAccess> {
    const params: Record<string, string> = {};
    if (password) params['password'] = password;
    return this.http.get<SharedBoardAccess>(`/api/shared/${token}`, { params });
  }
}
