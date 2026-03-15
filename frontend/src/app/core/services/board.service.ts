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
  is_sample?: boolean;
  position?: string;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use Board directly — "Project" is the new backend name for Board */
export type Project = Board;

export interface ProjectStatus {
  id: string;
  project_id: string;
  name: string;
  color: string;
  type: 'not_started' | 'active' | 'done' | 'cancelled';
  position: string;
  is_default: boolean;
  created_at: string;
  allowed_transitions?: string[] | null;
}

export interface ColumnStatusMapping {
  done?: boolean;
  [key: string]: unknown;
}

export interface Column {
  id: string;
  /** @deprecated Use project_id */
  board_id?: string;
  project_id?: string;
  name: string;
  position: string;
  color: string;
  status_mapping: ColumnStatusMapping | null;
  wip_limit: number | null;
  icon?: string | null;
  created_at: string;
  updated_at?: string;
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
  /** @deprecated Use project_id */
  board_id?: string;
  project_id?: string;
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

export interface CreateStatusRequest {
  name: string;
  color?: string;
  type?: 'not_started' | 'active' | 'done' | 'cancelled';
}

export interface UpdateStatusRequest {
  name?: string;
  color?: string;
  type?: 'not_started' | 'active' | 'done' | 'cancelled';
  position?: string;
}

export interface TaskWithBadges {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  /** @deprecated removed — use status_id */
  column_id?: string;
  status_id: string | null;
  status_name: string | null;
  status_color: string | null;
  status_type: string | null;
  position: string;
  /** @deprecated use task_list_id */
  group_id?: string | null;
  task_list_id: string | null;
  milestone_id: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  subtask_completed: number;
  subtask_total: number;
  has_running_timer: boolean;
  comment_count: number;
  /** @deprecated removed */
  column_entered_at?: string;
  assignees: { id: string; display_name: string; avatar_url: string | null }[];
  labels: { id: string; name: string; color: string }[];
}

export interface BoardMeta {
  total_task_count: number;
  current_limit: number;
  current_offset: number;
}

export interface BoardFullResponse {
  board: Board & { columns?: Column[]; statuses?: ProjectStatus[] };
  tasks: TaskWithBadges[];
  members: BoardMember[];
  meta: BoardMeta;
  statuses?: ProjectStatus[];
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
      `projects:${workspaceId}`,
      () =>
        this.http.get<Board[]>(
          `${this.apiUrl}/workspaces/${workspaceId}/boards`,
        ),
      120000, // 2 min TTL
    );
  }

  getBoard(boardId: string): Observable<Board> {
    return this.cache.get(
      `project:${boardId}`,
      () => this.http.get<Board>(`${this.apiUrl}/projects/${boardId}`),
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
          this.cache.invalidate(`projects:${workspaceId}`);
        }),
      );
  }

  updateBoard(boardId: string, request: UpdateBoardRequest): Observable<Board> {
    return this.http
      .patch<Board>(`${this.apiUrl}/projects/${boardId}`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`project:${boardId}`);
          this.cache.invalidate(`project-full:${boardId}:.*`);
          this.cache.invalidate(`projects:.*`);
        }),
      );
  }

  deleteBoard(boardId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/projects/${boardId}`).pipe(
      tap(() => {
        this.cache.invalidateKey(`project:${boardId}`);
        this.cache.invalidate(`project-full:${boardId}:.*`);
        this.cache.invalidate(`projects:.*`);
      }),
    );
  }

  listColumns(boardId: string): Observable<Column[]> {
    return this.cache.get(
      `columns:${boardId}`,
      () => this.http.get<Column[]>(`${this.apiUrl}/projects/${boardId}/columns`),
      120000, // 2 min TTL
    );
  }

  createColumn(
    boardId: string,
    request: CreateColumnRequest,
  ): Observable<Column> {
    return this.http
      .post<Column>(`${this.apiUrl}/projects/${boardId}/columns`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`columns:${boardId}`);
          this.cache.invalidate(`project-full:${boardId}:.*`);
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
          this.cache.invalidate(`columns:.*`);
          this.cache.invalidate(`project-full:.*`);
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
          this.cache.invalidate(`columns:.*`);
          this.cache.invalidate(`project-full:.*`);
        }),
      );
  }

  renameColumn(columnId: string, name: string): Observable<Column> {
    return this.http
      .put<Column>(`${this.apiUrl}/columns/${columnId}/name`, { name })
      .pipe(
        tap((column) => {
          this.cache.invalidate(`columns:.*`);
          this.cache.invalidate(`project-full:.*`);
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
          this.cache.invalidate(`columns:.*`);
          this.cache.invalidate(`project-full:.*`);
        }),
      );
  }

  updateColumnIcon(columnId: string, icon: string | null): Observable<Column> {
    return this.http
      .put<Column>(`${this.apiUrl}/columns/${columnId}/icon`, { icon })
      .pipe(
        tap((column) => {
          this.cache.invalidate(`columns:.*`);
          this.cache.invalidate(`project-full:.*`);
        }),
      );
  }

  deleteColumn(columnId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/columns/${columnId}`).pipe(
      tap(() => {
        this.cache.invalidate(`columns:.*`);
        this.cache.invalidate(`project-full:.*`);
      }),
    );
  }

  // Project Status methods (backed by /api/projects/{id}/columns + /api/columns/{id})
  listStatuses(projectId: string): Observable<ProjectStatus[]> {
    return this.cache.get(
      `statuses:${projectId}`,
      () =>
        this.http.get<ProjectStatus[]>(
          `${this.apiUrl}/projects/${projectId}/columns`,
        ),
      120000,
    );
  }

  createStatus(
    projectId: string,
    req: CreateStatusRequest,
  ): Observable<ProjectStatus> {
    return this.http
      .post<ProjectStatus>(
        `${this.apiUrl}/projects/${projectId}/columns`,
        req,
      )
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`statuses:${projectId}`);
          this.cache.invalidate(`project-full:${projectId}:.*`);
        }),
      );
  }

  updateStatus(id: string, req: UpdateStatusRequest): Observable<ProjectStatus> {
    // Backend splits update into sub-routes; use name for now
    return this.http
      .put<ProjectStatus>(`${this.apiUrl}/columns/${id}/name`, { name: req.name ?? '' })
      .pipe(
        tap(() => {
          this.cache.invalidate(`statuses:.*`);
          this.cache.invalidate(`project-full:.*`);
        }),
      );
  }

  deleteStatus(id: string, _replaceWithId?: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/columns/${id}`)
      .pipe(
        tap(() => {
          this.cache.invalidate(`statuses:.*`);
          this.cache.invalidate(`project-full:.*`);
        }),
      );
  }

  // Board Member methods
  getBoardMembers(boardId: string): Observable<BoardMember[]> {
    return this.cache.get(
      `project-members:${boardId}`,
      () =>
        this.http.get<BoardMember[]>(
          `${this.apiUrl}/projects/${boardId}/members`,
        ),
      180000, // 3 min TTL
    );
  }

  inviteBoardMember(
    boardId: string,
    request: InviteMemberRequest,
  ): Observable<BoardMember> {
    return this.http
      .post<BoardMember>(`${this.apiUrl}/projects/${boardId}/members`, request)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`project-members:${boardId}`);
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
        `${this.apiUrl}/projects/${boardId}/members/${userId}`,
        request,
      )
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`project-members:${boardId}`);
        }),
      );
  }

  removeBoardMember(boardId: string, userId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/projects/${boardId}/members/${userId}`)
      .pipe(
        tap(() => {
          this.cache.invalidateKey(`project-members:${boardId}`);
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

    const cacheKey = `project-full:${boardId}:${queryParams['limit'] ?? '1000'}:${queryParams['offset'] ?? '0'}`;
    return this.cache.get(
      cacheKey,
      () =>
        this.http.get<BoardFullResponse>(
          `${this.apiUrl}/projects/${boardId}/full`,
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
      .post<Board>(`${this.apiUrl}/projects/${boardId}/duplicate`, request)
      .pipe(
        tap(() => {
          this.cache.invalidate(`projects:.*`);
        }),
      );
  }

  getTransitions(
    statusId: string,
  ): Observable<{ status_id: string; allowed_transitions: string[] | null }> {
    return this.http.get<{
      status_id: string;
      allowed_transitions: string[] | null;
    }>(`${this.apiUrl}/columns/${statusId}/transitions`);
  }

  updateTransitions(
    statusId: string,
    allowed: string[] | null,
  ): Observable<ProjectStatus & { allowed_transitions: string[] | null }> {
    return this.http
      .put<ProjectStatus & { allowed_transitions: string[] | null }>(
        `${this.apiUrl}/columns/${statusId}/transitions`,
        { allowed },
      )
      .pipe(
        tap(() => {
          this.cache.invalidate(`statuses:.*`);
          this.cache.invalidate(`columns:.*`);
          this.cache.invalidate(`project-full:.*`);
        }),
      );
  }
}
