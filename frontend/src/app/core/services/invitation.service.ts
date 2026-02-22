import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface Invitation {
  id: string;
  email: string;
  workspace_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface CreateInvitationRequest {
  email: string;
  workspace_id: string;
  role?: 'admin' | 'manager' | 'member';
}

export interface InvitationValidateResponse {
  valid: boolean;
  email: string | null;
  workspace_id: string | null;
  role: string | null;
  expired: boolean;
  already_accepted: boolean;
  job_title: string | null;
}

export interface AcceptInvitationRequest {
  token: string;
  name: string;
  password: string;
  job_title?: string;
  department?: string;
  bio?: string;
  timezone?: string;
}

@Injectable({ providedIn: 'root' })
export class InvitationService {
  private api = inject(ApiService);

  listByWorkspace(workspaceId: string) {
    return this.api.get<Invitation[]>(
      `/invitations?workspace_id=${workspaceId}`,
    );
  }

  create(data: CreateInvitationRequest) {
    return this.api.post<Invitation>('/invitations', data);
  }

  cancel(id: string) {
    return this.api.delete(`/invitations/${id}`);
  }

  resend(id: string) {
    return this.api.post<Invitation>(`/invitations/${id}/resend`, {});
  }

  validate(token: string) {
    return this.api.get<InvitationValidateResponse>(
      `/invitations/validate/${token}`,
    );
  }

  accept(data: AcceptInvitationRequest) {
    return this.api.post<{ message: string }>('/invitations/accept', data);
  }
}
