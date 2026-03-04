import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { CacheService } from './cache.service';

export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  prefix?: string | null;
  background_color?: string | null;
  is_sample: boolean;
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

export interface BoardMeta {
  total_task_count: number;
  current_limit: number;
  current_offset: number;
}

export interface BoardFullResponse {
  board: Board & { columns: Column[] };
  tasks: TaskWithBadges[];
  members: BoardMember[];
  meta: BoardMeta;
}

@Injectable({
  providedIn: 'root',
})
export class BoardService {
  private readonly apiUrl = '/api';
  private cache = inject(CacheService);

  constructor(private http: HttpClient) {}

  listBoards(workspaceId: string): Observable<Board[]> {
    return this.cache.get(
      `boards:${workspaceId}`,
      () =>
        this.http.get<Board[]>(
          `${this.apiUrl}/workspaces/${workspaceId}/boards`,
        ),
      120000, // 2 min TTL
    );
  }

  getBoard(boardId: string): Observable<Board> {
    return this.cache.get(
      `board:${boardId}`,
      () => this.http.get<Board>(`${this.apiUrl}/boards/${boardId}`),
      120000, // 2 min TTL
    );
  }

  createBoard(
    workspaceId: string,
    request: CreateBoardRequest,
  ): Observable<Board> {
    return this.http
      .post<Board>(`${this.apiUrl}/workspaces/${workspaceId}/boards`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`boards:${workspaceId}`);
        }),
      );
  }

  updateBoard(boardId: string, request: UpdateBoardRequest): Observable<Board> {
    return this.http
      .patch<Board>(`${this.apiUrl}/boards/${boardId}`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`board:${boardId}`);
          this.cache.invalidate(`board-full:${boardId}:.*`);
          this.cache.invalidate(`boards:.*`);
        }),
      );
  }

  deleteBoard(boardId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/boards/${boardId}`).pipe(
      tap(() => {
        this.cache.invalidateKey(`board:${boardId}`);
        this.cache.invalidate(`board-full:${boardId}:.*`);
        this.cache.invalidate(`boards:.*`);
      }),
    );
  }

  listColumns(boardId: string): Observable<Column[]> {
    return this.cache.get(
      `columns:${boardId}`,
      () => this.http.get<Column[]>(`${this.apiUrl}/boards/${boardId}/columns`),
      120000, // 2 min TTL
    );
  }

  createColumn(
    boardId: string,
    request: CreateColumnRequest,
  ): Observable<Column> {
    return this.http
      .post<Column>(`${this.apiUrl}/boards/${boardId}/columns`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`columns:${boardId}`);
          this.cache.invalidate(`board-full:${boardId}:.*`);
        }),
      );
  }

  updateColumn(
    columnId: string,
    request: UpdateColumnRequest,
  ): Observable<Column> {
    return this.http
      .patch<Column>(`${this.apiUrl}/columns/${columnId}`, request)
      .pipe(
        tap((column) => {
          this.cache.invalidateKey(`columns:${column.board_id}`);
          this.cache.invalidate(`board-full:${column.board_id}:.*`);
        }),
      );
  }

  reorderColumn(
    columnId: string,
    request: ReorderColumnRequest,
  ): Observable<Column> {
    return this.http
      .put<Column>(`${this.apiUrl}/columns/${columnId}/position`, request)
      .pipe(
        tap((column) => {
          this.cache.invalidateKey(`columns:${column.board_id}`);
          this.cache.invalidate(`board-full:${column.board_id}:.*`);
        }),
      );
  }

  renameColumn(columnId: string, name: string): Observable<Column> {
    return this.http
      .put<Column>(`${this.apiUrl}/columns/${columnId}/name`, { name })
      .pipe(
        tap((column) => {
          this.cache.invalidateKey(`columns:${column.board_id}`);
          this.cache.invalidate(`board-full:${column.board_id}:.*`);
        }),
      );
  }

  updateColumnWipLimit(
    columnId: string,
    wipLimit: number | null,
  ): Observable<Column> {
    return this.http
      .put<Column>(`${this.apiUrl}/columns/${columnId}/wip-limit`, {
        wip_limit: wipLimit,
      })
      .pipe(
        tap((column) => {
          this.cache.invalidateKey(`columns:${column.board_id}`);
          this.cache.invalidate(`board-full:${column.board_id}:.*`);
        }),
      );
  }

  updateColumnIcon(columnId: string, icon: string | null): Observable<Column> {
    return this.http
      .put<Column>(`${this.apiUrl}/columns/${columnId}/icon`, { icon })
      .pipe(
        tap((column) => {
          this.cache.invalidateKey(`columns:${column.board_id}`);
          this.cache.invalidate(`board-full:${column.board_id}:.*`);
        }),
      );
  }

  deleteColumn(columnId: string): Observable<void> {
    // Note: We need to get board_id before deleting, so fetch it from cache if available
    return this.http.delete<void>(`${this.apiUrl}/columns/${columnId}`).pipe(
      tap(() => {
        this.cache.invalidate(`columns:.*`);
        this.cache.invalidate(`board-full:.*`);
      }),
    );
  }

  // Board Member methods
  getBoardMembers(boardId: string): Observable<BoardMember[]> {
    return this.cache.get(
      `board-members:${boardId}`,
      () =>
        this.http.get<BoardMember[]>(
          `${this.apiUrl}/boards/${boardId}/members`,
        ),
      180000, // 3 min TTL
    );
  }

  inviteBoardMember(
    boardId: string,
    request: InviteMemberRequest,
  ): Observable<BoardMember> {
    return this.http
      .post<BoardMember>(`${this.apiUrl}/boards/${boardId}/members`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`board-members:${boardId}`);
        }),
      );
  }

  updateBoardMemberRole(
    boardId: string,
    userId: string,
    request: UpdateMemberRoleRequest,
  ): Observable<BoardMember> {
    return this.http
      .patch<BoardMember>(
        `${this.apiUrl}/boards/${boardId}/members/${userId}`,
        request,
      )
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`board-members:${boardId}`);
        }),
      );
  }

  removeBoardMember(boardId: string, userId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/boards/${boardId}/members/${userId}`)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`board-members:${boardId}`);
        }),
      );
  }

  getBoardFull(
    boardId: string,
    params?: { limit?: number; offset?: number },
  ): Observable<BoardFullResponse> {
    const queryParams: Record<string, string> = {};
    if (params?.limit != null) queryParams['limit'] = String(params.limit);
    if (params?.offset != null) queryParams['offset'] = String(params.offset);

    const cacheKey = `board-full:${boardId}:${queryParams['limit'] ?? '1000'}:${queryParams['offset'] ?? '0'}`;
    return this.cache.get(
      cacheKey,
      () =>
        this.http.get<BoardFullResponse>(
          `${this.apiUrl}/boards/${boardId}/full`,
          { params: queryParams },
        ),
      60000, // 1 min TTL for full board data
    );
  }

  duplicateBoard(
    boardId: string,
    request: DuplicateBoardRequest,
  ): Observable<Board> {
    return this.http
      .post<Board>(`${this.apiUrl}/boards/${boardId}/duplicate`, request)
      .pipe(
        tap(() => {
          this.cache.invalidate(`boards:.*`);
        }),
      );
  }
}
