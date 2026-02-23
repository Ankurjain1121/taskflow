import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WorkspaceMemberInfo } from '../../shared/types/workspace.types';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  visibility?: 'open' | 'closed';
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  slug?: string;
  description?: string;
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

  update(
    workspaceId: string,
    request: UpdateWorkspaceRequest,
  ): Observable<Workspace> {
    return this.http.put<Workspace>(`${this.apiUrl}/${workspaceId}`, request);
  }

  delete(workspaceId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${workspaceId}`);
  }

  getMembers(workspaceId: string): Observable<WorkspaceMemberInfo[]> {
    return this.http.get<WorkspaceMemberInfo[]>(
      `${this.apiUrl}/${workspaceId}/members`,
    );
  }

  inviteMember(
    workspaceId: string,
    email: string,
    role: 'admin' | 'manager' | 'member',
  ): Observable<void> {
    return this.http.post<void>('/api/invitations', {
      email,
      workspace_id: workspaceId,
      role,
    });
  }

  removeMember(workspaceId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${workspaceId}/members/${userId}`,
    );
  }

  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: 'admin' | 'manager' | 'member',
  ): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/${workspaceId}/members/${userId}`,
      { role },
    );
  }

  searchMembers(
    workspaceId: string,
    query: string,
    limit: number = 10,
  ): Observable<MemberSearchResult[]> {
    return this.http.get<MemberSearchResult[]>(
      `${this.apiUrl}/${workspaceId}/members/search`,
      { params: { q: query, limit: limit.toString() } },
    );
  }

  bulkInviteMembers(
    workspaceId: string,
    emails: string[],
    role: 'admin' | 'manager' | 'member',
    message?: string,
    boardIds?: string[],
    jobTitle?: string,
  ): Observable<BulkInviteResponse> {
    return this.http.post<BulkInviteResponse>('/api/invitations/bulk', {
      emails,
      workspace_id: workspaceId,
      role,
      message: message || undefined,
      board_ids: boardIds && boardIds.length > 0 ? boardIds : undefined,
      job_title: jobTitle || undefined,
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

  discoverWorkspaces(): Observable<DiscoverableWorkspace[]> {
    return this.http.get<DiscoverableWorkspace[]>(`${this.apiUrl}/discover`);
  }

  joinWorkspace(workspaceId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${workspaceId}/join`, {});
  }

  updateVisibility(
    workspaceId: string,
    visibility: 'open' | 'closed',
  ): Observable<Workspace> {
    return this.http.patch<Workspace>(
      `${this.apiUrl}/${workspaceId}/visibility`,
      { visibility },
    );
  }

  resendInvitation(invitationId: string): Observable<InvitationWithStatus> {
    return this.http.post<InvitationWithStatus>(
      `/api/invitations/${invitationId}/resend`,
      {},
    );
  }

  // Tenant-level endpoints

  listTenantMembers(): Observable<TenantMember[]> {
    return this.http.get<TenantMember[]>('/api/tenant/members');
  }

  getUserWorkspaces(userId: string): Observable<UserWorkspaceMembership[]> {
    return this.http.get<UserWorkspaceMembership[]>(
      `/api/tenant/members/${userId}/workspaces`,
    );
  }

  bulkAddMembers(
    workspaceId: string,
    userIds: string[],
  ): Observable<{ added: number }> {
    return this.http.post<{ added: number }>(
      `${this.apiUrl}/${workspaceId}/members/bulk`,
      { user_ids: userIds },
    );
  }
}

export interface TenantMember {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  role: string;
  workspace_count: number;
  created_at: string;
}

export interface UserWorkspaceMembership {
  workspace_id: string;
  workspace_name: string;
  role: string;
  joined_at: string;
}

export interface DiscoverableWorkspace {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
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
