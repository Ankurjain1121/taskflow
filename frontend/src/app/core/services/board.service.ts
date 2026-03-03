import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  prefix?: string | null;
  background_color?: string | null;
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
  icon?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBoardRequest {
  name: string;
  description?: string;
  template?: string;
}

export interface UpdateBoardRequest {
  name?: string;
  description?: string;
  background_color?: string | null;
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
  new_index: number;
}

export interface BoardMember {
  user_id: string;
  board_id: string;
  role: 'viewer' | 'editor' | 'owner';
  name?: string;
  email?: string;
  avatar_url?: string | null;
}

export interface InviteMemberRequest {
  email: string;
  role: 'viewer' | 'editor' | 'owner';
}

export interface UpdateMemberRoleRequest {
  role: 'viewer' | 'editor' | 'owner';
}

export interface DuplicateBoardRequest {
  name: string;
  include_tasks?: boolean;
}

export interface TaskWithBadges {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  column_id: string;
  position: string;
  group_id: string | null;
  milestone_id: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  subtask_completed: number;
  subtask_total: number;
  has_running_timer: boolean;
  comment_count: number;
  column_entered_at: string;
  assignees: { id: string; display_name: string; avatar_url: string | null }[];
  labels: { id: string; name: string; color: string }[];
}

export interface BoardFullResponse {
  board: Board & { columns: Column[] };
  tasks: TaskWithBadges[];
  members: BoardMember[];
}

@Injectable({
  providedIn: 'root',
})
export class BoardService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  listBoards(workspaceId: string): Observable<Board[]> {
    return this.http.get<Board[]>(
      `${this.apiUrl}/workspaces/${workspaceId}/boards`,
    );
  }

  getBoard(boardId: string): Observable<Board> {
    return this.http.get<Board>(`${this.apiUrl}/boards/${boardId}`);
  }

  createBoard(
    workspaceId: string,
    request: CreateBoardRequest,
  ): Observable<Board> {
    return this.http.post<Board>(
      `${this.apiUrl}/workspaces/${workspaceId}/boards`,
      request,
    );
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

  createColumn(
    boardId: string,
    request: CreateColumnRequest,
  ): Observable<Column> {
    return this.http.post<Column>(
      `${this.apiUrl}/boards/${boardId}/columns`,
      request,
    );
  }

  updateColumn(
    columnId: string,
    request: UpdateColumnRequest,
  ): Observable<Column> {
    return this.http.patch<Column>(
      `${this.apiUrl}/columns/${columnId}`,
      request,
    );
  }

  reorderColumn(
    columnId: string,
    request: ReorderColumnRequest,
  ): Observable<Column> {
    return this.http.put<Column>(
      `${this.apiUrl}/columns/${columnId}/position`,
      request,
    );
  }

  renameColumn(columnId: string, name: string): Observable<Column> {
    return this.http.put<Column>(
      `${this.apiUrl}/columns/${columnId}/name`,
      { name },
    );
  }

  updateColumnWipLimit(
    columnId: string,
    wipLimit: number | null,
  ): Observable<Column> {
    return this.http.put<Column>(
      `${this.apiUrl}/columns/${columnId}/wip-limit`,
      { wip_limit: wipLimit },
    );
  }

  updateColumnIcon(
    columnId: string,
    icon: string | null,
  ): Observable<Column> {
    return this.http.put<Column>(
      `${this.apiUrl}/columns/${columnId}/icon`,
      { icon },
    );
  }

  deleteColumn(columnId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/columns/${columnId}`);
  }

  // Board Member methods
  getBoardMembers(boardId: string): Observable<BoardMember[]> {
    return this.http.get<BoardMember[]>(
      `${this.apiUrl}/boards/${boardId}/members`,
    );
  }

  inviteBoardMember(
    boardId: string,
    request: InviteMemberRequest,
  ): Observable<BoardMember> {
    return this.http.post<BoardMember>(
      `${this.apiUrl}/boards/${boardId}/members`,
      request,
    );
  }

  updateBoardMemberRole(
    boardId: string,
    userId: string,
    request: UpdateMemberRoleRequest,
  ): Observable<BoardMember> {
    return this.http.patch<BoardMember>(
      `${this.apiUrl}/boards/${boardId}/members/${userId}`,
      request,
    );
  }

  removeBoardMember(boardId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/boards/${boardId}/members/${userId}`,
    );
  }

  getBoardFull(boardId: string): Observable<BoardFullResponse> {
    return this.http.get<BoardFullResponse>(
      `${this.apiUrl}/boards/${boardId}/full`,
    );
  }

  duplicateBoard(
    boardId: string,
    request: DuplicateBoardRequest,
  ): Observable<Board> {
    return this.http.post<Board>(
      `${this.apiUrl}/boards/${boardId}/duplicate`,
      request,
    );
  }
}
