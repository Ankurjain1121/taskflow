import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  slug?: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  slug?: string;
}

export interface WorkspaceMember {
  user_id: string;
  workspace_id: string;
  role: 'owner' | 'admin' | 'manager' | 'member';
  joined_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class WorkspaceService {
  private readonly apiUrl = '/api/workspaces';

  constructor(private http: HttpClient) {}

  list(): Observable<Workspace[]> {
    return this.http.get<Workspace[]>(this.apiUrl);
  }

  get(workspaceId: string): Observable<Workspace> {
    return this.http.get<Workspace>(`${this.apiUrl}/${workspaceId}`);
  }

  create(request: CreateWorkspaceRequest): Observable<Workspace> {
    return this.http.post<Workspace>(this.apiUrl, request);
  }

  update(workspaceId: string, request: UpdateWorkspaceRequest): Observable<Workspace> {
    return this.http.patch<Workspace>(`${this.apiUrl}/${workspaceId}`, request);
  }

  delete(workspaceId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${workspaceId}`);
  }

  getMembers(workspaceId: string): Observable<WorkspaceMember[]> {
    return this.http.get<WorkspaceMember[]>(`${this.apiUrl}/${workspaceId}/members`);
  }

  inviteMember(workspaceId: string, email: string, role: 'admin' | 'manager' | 'member'): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${workspaceId}/invites`, { email, role });
  }

  removeMember(workspaceId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${workspaceId}/members/${userId}`);
  }

  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: 'admin' | 'manager' | 'member'
  ): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${workspaceId}/members/${userId}`, { role });
  }

  searchMembers(
    workspaceId: string,
    query: string,
    limit: number = 10
  ): Observable<MemberSearchResult[]> {
    return this.http.get<MemberSearchResult[]>(
      `${this.apiUrl}/${workspaceId}/members/search`,
      { params: { q: query, limit: limit.toString() } }
    );
  }

  bulkInviteMembers(
    workspaceId: string,
    emails: string[],
    role: 'admin' | 'manager' | 'member',
    message?: string,
    boardIds?: string[]
  ): Observable<BulkInviteResponse> {
    return this.http.post<BulkInviteResponse>('/api/invitations/bulk', {
      emails,
      workspace_id: workspaceId,
      role,
      message: message || undefined,
      board_ids: boardIds && boardIds.length > 0 ? boardIds : undefined,
    });
  }

  listAllInvitations(workspaceId: string): Observable<InvitationWithStatus[]> {
    return this.http.get<InvitationWithStatus[]>('/api/invitations/all', {
      params: { workspace_id: workspaceId },
    });
  }

  cancelInvitation(invitationId: string): Observable<void> {
    return this.http.delete<void>(`/api/invitations/${invitationId}`);
  }

  resendInvitation(invitationId: string): Observable<InvitationWithStatus> {
    return this.http.post<InvitationWithStatus>(
      `/api/invitations/${invitationId}/resend`,
      {}
    );
  }
}

export interface MemberSearchResult {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface InvitationWithStatus {
  id: string;
  email: string;
  workspace_id: string;
  role: string;
  token: string;
  expires_at: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'expired';
  message?: string;
  board_ids?: string[];
}

export interface BulkInviteResponse {
  created: InvitationWithStatus[];
  errors: { email: string; reason: string }[];
}
