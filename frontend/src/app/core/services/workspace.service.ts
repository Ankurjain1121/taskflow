import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WorkspaceMemberInfo } from '../../shared/types/workspace.types';

export interface Workspace {
  id: string;
  name: string;
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
      project_ids: boardIds && boardIds.length > 0 ? boardIds : undefined,
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

  // ---- Labels ----

  listLabels(workspaceId: string): Observable<WorkspaceLabel[]> {
    return this.http.get<WorkspaceLabel[]>(
      `${this.apiUrl}/${workspaceId}/labels`,
    );
  }

  createLabel(
    workspaceId: string,
    name: string,
    color: string,
  ): Observable<WorkspaceLabel> {
    return this.http.post<WorkspaceLabel>(
      `${this.apiUrl}/${workspaceId}/labels`,
      { name, color },
    );
  }

  updateLabel(
    workspaceId: string,
    labelId: string,
    name: string,
    color: string,
  ): Observable<WorkspaceLabel> {
    return this.http.put<WorkspaceLabel>(
      `${this.apiUrl}/${workspaceId}/labels/${labelId}`,
      { name, color },
    );
  }

  deleteLabel(workspaceId: string, labelId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${workspaceId}/labels/${labelId}`,
    );
  }

  // ---- Audit log ----

  listAuditLog(
    workspaceId: string,
    params: AuditLogParams = {},
  ): Observable<PaginatedAuditLog> {
    const queryParams: Record<string, string> = {};
    if (params.cursor) queryParams['cursor'] = params.cursor;
    if (params.page_size)
      queryParams['page_size'] = params.page_size.toString();
    if (params.user_id) queryParams['user_id'] = params.user_id;
    if (params.action) queryParams['action'] = params.action;
    if (params.entity_type) queryParams['entity_type'] = params.entity_type;
    if (params.date_from) queryParams['date_from'] = params.date_from;
    if (params.date_to) queryParams['date_to'] = params.date_to;

    return this.http.get<PaginatedAuditLog>(
      `${this.apiUrl}/${workspaceId}/audit-log`,
      { params: queryParams },
    );
  }

  listAuditActions(workspaceId: string): Observable<{ actions: string[] }> {
    return this.http.get<{ actions: string[] }>(
      `${this.apiUrl}/${workspaceId}/audit-log/actions`,
    );
  }

  // ---- Trash ----

  listTrash(
    workspaceId: string,
    params: TrashListParams = {},
  ): Observable<PaginatedTrashItems> {
    const queryParams: Record<string, string> = {};
    if (params.entity_type) queryParams['entity_type'] = params.entity_type;
    if (params.cursor) queryParams['cursor'] = params.cursor;
    if (params.page_size)
      queryParams['page_size'] = params.page_size.toString();

    return this.http.get<PaginatedTrashItems>(
      `${this.apiUrl}/${workspaceId}/trash`,
      { params: queryParams },
    );
  }

  restoreTrashItem(
    workspaceId: string,
    entityType: string,
    entityId: string,
  ): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/${workspaceId}/trash/restore`,
      { entity_type: entityType, entity_id: entityId },
    );
  }

  deleteTrashItem(
    workspaceId: string,
    entityType: string,
    entityId: string,
  ): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/${workspaceId}/trash/${entityType}/${entityId}`,
    );
  }

  // ---- Export ----

  exportWorkspace(
    workspaceId: string,
    format: 'csv' | 'json',
  ): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${workspaceId}/export`, {
      params: { format },
      responseType: 'blob',
    });
  }

  // ---- Job Roles ----

  listJobRoles(workspaceId: string): Observable<WorkspaceJobRole[]> {
    return this.http.get<WorkspaceJobRole[]>(
      `${this.apiUrl}/${workspaceId}/roles`,
    );
  }

  createJobRole(
    workspaceId: string,
    name: string,
    color?: string,
    description?: string,
  ): Observable<WorkspaceJobRole> {
    return this.http.post<WorkspaceJobRole>(
      `${this.apiUrl}/${workspaceId}/roles`,
      {
        name,
        color: color || undefined,
        description: description || undefined,
      },
    );
  }

  updateJobRole(
    workspaceId: string,
    roleId: string,
    data: { name?: string; color?: string; description?: string },
  ): Observable<WorkspaceJobRole> {
    return this.http.put<WorkspaceJobRole>(
      `${this.apiUrl}/${workspaceId}/roles/${roleId}`,
      data,
    );
  }

  deleteJobRole(workspaceId: string, roleId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${workspaceId}/roles/${roleId}`,
    );
  }

  listAllMemberRoles(workspaceId: string): Observable<MemberRoleBatch[]> {
    return this.http.get<MemberRoleBatch[]>(
      `${this.apiUrl}/${workspaceId}/roles/members`,
    );
  }

  assignJobRole(
    workspaceId: string,
    userId: string,
    jobRoleId: string,
  ): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/${workspaceId}/members/${userId}/roles`,
      { job_role_id: jobRoleId },
    );
  }

  removeJobRole(
    workspaceId: string,
    userId: string,
    roleId: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${workspaceId}/members/${userId}/roles/${roleId}`,
    );
  }

  getMemberJobRoles(
    workspaceId: string,
    userId: string,
  ): Observable<MemberJobRoleInfo[]> {
    return this.http.get<MemberJobRoleInfo[]>(
      `${this.apiUrl}/${workspaceId}/members/${userId}/roles`,
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
  project_ids?: string[];
}

export interface BulkInviteResponse {
  created: InvitationWithStatus[];
  errors: { email: string; reason: string }[];
}

export interface WorkspaceLabel {
  id: string;
  name: string;
  color: string;
  workspace_id: string;
  project_id: string | null;
  created_at: string;
}

export interface AuditLogParams {
  cursor?: string;
  page_size?: number;
  user_id?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface PaginatedAuditLog {
  items: AuditLogEntry[];
  next_cursor: string | null;
  total_count: number | null;
}

export interface TrashListParams {
  entity_type?: string;
  cursor?: string;
  page_size?: number;
}

export interface TrashItem {
  entity_type: string;
  entity_id: string;
  name: string;
  deleted_at: string;
  deleted_by_name: string | null;
}

export interface PaginatedTrashItems {
  items: TrashItem[];
  next_cursor: string | null;
}

export interface WorkspaceJobRole {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberRoleBatch {
  user_id: string;
  role_id: string;
  role_name: string;
  role_color: string | null;
}

export interface MemberJobRoleInfo {
  role_id: string;
  role_name: string;
  role_color: string | null;
  assigned_at: string;
}
