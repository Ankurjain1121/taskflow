import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  position: string;
  created_at: string;
  updated_at: string;
}

export interface ColumnStatusMapping {
  done?: boolean;
  [key: string]: unknown;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: string;
  color: string;
  status_mapping: ColumnStatusMapping | null;
  wip_limit: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBoardRequest {
  name: string;
  description?: string;
}

export interface UpdateBoardRequest {
  name?: string;
  description?: string;
}

export interface CreateColumnRequest {
  name: string;
  color?: string;
  status_mapping?: ColumnStatusMapping;
  wip_limit?: number;
}

export interface UpdateColumnRequest {
  name?: string;
  color?: string;
  status_mapping?: ColumnStatusMapping | null;
  wip_limit?: number | null;
}

export interface ReorderColumnRequest {
  position: string;
}

export interface BoardMember {
  user_id: string;
  board_id: string;
  role: 'viewer' | 'editor';
  display_name?: string;
  email?: string;
  avatar_url?: string | null;
}

export interface InviteMemberRequest {
  email: string;
  role: 'viewer' | 'editor';
}

export interface UpdateMemberRoleRequest {
  role: 'viewer' | 'editor';
}

@Injectable({
  providedIn: 'root',
})
export class BoardService {
  private readonly apiUrl = '/api/v1';

  constructor(private http: HttpClient) {}

  listBoards(workspaceId: string): Observable<Board[]> {
    return this.http.get<Board[]>(`${this.apiUrl}/workspaces/${workspaceId}/boards`);
  }

  getBoard(boardId: string): Observable<Board> {
    return this.http.get<Board>(`${this.apiUrl}/boards/${boardId}`);
  }

  createBoard(workspaceId: string, request: CreateBoardRequest): Observable<Board> {
    return this.http.post<Board>(`${this.apiUrl}/workspaces/${workspaceId}/boards`, request);
  }

  updateBoard(boardId: string, request: UpdateBoardRequest): Observable<Board> {
    return this.http.patch<Board>(`${this.apiUrl}/boards/${boardId}`, request);
  }

  deleteBoard(boardId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/boards/${boardId}`);
  }

  listColumns(boardId: string): Observable<Column[]> {
    return this.http.get<Column[]>(`${this.apiUrl}/boards/${boardId}/columns`);
  }

  createColumn(boardId: string, request: CreateColumnRequest): Observable<Column> {
    return this.http.post<Column>(`${this.apiUrl}/boards/${boardId}/columns`, request);
  }

  updateColumn(columnId: string, request: UpdateColumnRequest): Observable<Column> {
    return this.http.patch<Column>(`${this.apiUrl}/columns/${columnId}`, request);
  }

  reorderColumn(columnId: string, request: ReorderColumnRequest): Observable<Column> {
    return this.http.patch<Column>(`${this.apiUrl}/columns/${columnId}/reorder`, request);
  }

  deleteColumn(columnId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/columns/${columnId}`);
  }

  // Board Member methods
  getBoardMembers(boardId: string): Observable<BoardMember[]> {
    return this.http.get<BoardMember[]>(`${this.apiUrl}/boards/${boardId}/members`);
  }

  inviteBoardMember(boardId: string, request: InviteMemberRequest): Observable<BoardMember> {
    return this.http.post<BoardMember>(`${this.apiUrl}/boards/${boardId}/members`, request);
  }

  updateBoardMemberRole(boardId: string, userId: string, request: UpdateMemberRoleRequest): Observable<BoardMember> {
    return this.http.patch<BoardMember>(`${this.apiUrl}/boards/${boardId}/members/${userId}`, request);
  }

  removeBoardMember(boardId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/boards/${boardId}/members/${userId}`);
  }
}
