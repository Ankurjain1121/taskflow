import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface InvitationContext {
  workspace_id: string;
  workspace_name: string;
  board_ids: string[];
}

export interface CreateWorkspaceResponse {
  workspace_id: string;
}

export interface InviteMembersResponse {
  invited: string[];
  pending: string[];
}

export interface GenerateSampleBoardResponse {
  board_id: string;
}

@Injectable({
  providedIn: 'root',
})
export class OnboardingService {
  private readonly apiUrl = '/api/v1';

  constructor(private http: HttpClient) {}

  /**
   * Get invitation context from a token (for invited users)
   */
  getInvitationContext(token: string): Observable<InvitationContext> {
    return this.http.get<InvitationContext>(
      `${this.apiUrl}/invitations/${token}/context`
    );
  }

  /**
   * Create a new workspace during onboarding
   */
  createWorkspace(
    name: string,
    description?: string
  ): Observable<CreateWorkspaceResponse> {
    return this.http.post<CreateWorkspaceResponse>(
      `${this.apiUrl}/workspaces`,
      { name, description }
    );
  }

  /**
   * Invite members to a workspace
   */
  inviteMembers(
    workspaceId: string,
    emails: string[]
  ): Observable<InviteMembersResponse> {
    return this.http.post<InviteMembersResponse>(
      `${this.apiUrl}/workspaces/${workspaceId}/invitations`,
      { emails }
    );
  }

  /**
   * Generate a sample board with demo tasks
   */
  generateSampleBoard(
    workspaceId: string
  ): Observable<GenerateSampleBoardResponse> {
    return this.http.post<GenerateSampleBoardResponse>(
      `${this.apiUrl}/workspaces/${workspaceId}/sample-board`,
      {}
    );
  }

  /**
   * Mark onboarding as complete for the current user
   */
  completeOnboarding(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/auth/complete-onboarding`, {});
  }
}
