import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  WorkspaceService,
  Workspace,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  MemberSearchResult,
  InvitationWithStatus,
  BulkInviteResponse,
} from './workspace.service';
import { WorkspaceMemberInfo } from '../../shared/types/workspace.types';

const MOCK_WORKSPACE: Workspace = {
  id: 'ws-1',
  name: 'Test Workspace',
  description: null,
  logo_url: null,
  created_by_id: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_MEMBER: WorkspaceMemberInfo = {
  user_id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  avatar_url: null,
  role: 'admin',
  joined_at: '2026-01-01T00:00:00Z',
};

const MOCK_INVITATION: InvitationWithStatus = {
  id: 'inv-1',
  email: 'invite@example.com',
  workspace_id: 'ws-1',
  role: 'member',
  token: 'token-abc',
  expires_at: '2026-02-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  status: 'pending',
};

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [WorkspaceService],
    });
    service = TestBed.inject(WorkspaceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('list()', () => {
    it('should GET /api/workspaces', () => {
      const workspaces = [MOCK_WORKSPACE];

      service.list().subscribe((result) => {
        expect(result).toEqual(workspaces);
      });

      const req = httpMock.expectOne('/api/workspaces');
      expect(req.request.method).toBe('GET');
      req.flush(workspaces);
    });
  });

  describe('get()', () => {
    it('should GET /api/workspaces/:workspaceId', () => {
      service.get('ws-1').subscribe((workspace) => {
        expect(workspace).toEqual(MOCK_WORKSPACE);
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_WORKSPACE);
    });
  });

  describe('create()', () => {
    it('should POST /api/workspaces with body', () => {
      const createReq: CreateWorkspaceRequest = {
        name: 'New Workspace',
        slug: 'new-workspace',
      };

      service.create(createReq).subscribe((workspace) => {
        expect(workspace).toEqual(MOCK_WORKSPACE);
      });

      const req = httpMock.expectOne('/api/workspaces');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_WORKSPACE);
    });
  });

  describe('update()', () => {
    it('should PATCH /api/workspaces/:workspaceId with body', () => {
      const updateReq: UpdateWorkspaceRequest = { name: 'Renamed Workspace' };

      service.update('ws-1', updateReq).subscribe((workspace) => {
        expect(workspace).toEqual(MOCK_WORKSPACE);
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_WORKSPACE);
    });
  });

  describe('delete()', () => {
    it('should DELETE /api/workspaces/:workspaceId', () => {
      service.delete('ws-1').subscribe();

      const req = httpMock.expectOne('/api/workspaces/ws-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getMembers()', () => {
    it('should GET /api/workspaces/:workspaceId/members', () => {
      const members = [MOCK_MEMBER];

      service.getMembers('ws-1').subscribe((result) => {
        expect(result).toEqual(members);
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/members');
      expect(req.request.method).toBe('GET');
      req.flush(members);
    });
  });

  describe('inviteMember()', () => {
    it('should POST /api/workspaces/:workspaceId/invites with email and role', () => {
      service.inviteMember('ws-1', 'new@example.com', 'member').subscribe();

      const req = httpMock.expectOne('/api/workspaces/ws-1/invites');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 'new@example.com',
        role: 'member',
      });
      req.flush(null);
    });
  });

  describe('removeMember()', () => {
    it('should DELETE /api/workspaces/:workspaceId/members/:userId', () => {
      service.removeMember('ws-1', 'user-1').subscribe();

      const req = httpMock.expectOne('/api/workspaces/ws-1/members/user-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('updateMemberRole()', () => {
    it('should PATCH /api/workspaces/:workspaceId/members/:userId with role', () => {
      service.updateMemberRole('ws-1', 'user-1', 'manager').subscribe();

      const req = httpMock.expectOne('/api/workspaces/ws-1/members/user-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ role: 'manager' });
      req.flush(null);
    });
  });

  describe('searchMembers()', () => {
    it('should GET /api/workspaces/:workspaceId/members/search with query params', () => {
      const mockResults: MemberSearchResult[] = [
        {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
          avatar_url: null,
        },
      ];

      service.searchMembers('ws-1', 'test', 5).subscribe((result) => {
        expect(result).toEqual(mockResults);
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/workspaces/ws-1/members/search',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('q')).toBe('test');
      expect(req.request.params.get('limit')).toBe('5');
      req.flush(mockResults);
    });

    it('should use default limit of 10 when not specified', () => {
      service.searchMembers('ws-1', 'test').subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === '/api/workspaces/ws-1/members/search',
      );
      expect(req.request.params.get('limit')).toBe('10');
      req.flush([]);
    });
  });

  describe('bulkInviteMembers()', () => {
    it('should POST /api/invitations/bulk with all fields', () => {
      const mockResponse: BulkInviteResponse = {
        created: [MOCK_INVITATION],
        errors: [],
      };

      service
        .bulkInviteMembers(
          'ws-1',
          ['a@example.com', 'b@example.com'],
          'member',
          'Welcome!',
          ['board-1'],
        )
        .subscribe((result) => {
          expect(result).toEqual(mockResponse);
        });

      const req = httpMock.expectOne('/api/invitations/bulk');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        emails: ['a@example.com', 'b@example.com'],
        workspace_id: 'ws-1',
        role: 'member',
        message: 'Welcome!',
        board_ids: ['board-1'],
      });
      req.flush(mockResponse);
    });

    it('should omit message and board_ids when not provided', () => {
      service.bulkInviteMembers('ws-1', ['a@example.com'], 'admin').subscribe();

      const req = httpMock.expectOne('/api/invitations/bulk');
      expect(req.request.body.message).toBeUndefined();
      expect(req.request.body.board_ids).toBeUndefined();
      req.flush({ created: [], errors: [] });
    });

    it('should omit board_ids when empty array', () => {
      service
        .bulkInviteMembers('ws-1', ['a@example.com'], 'admin', undefined, [])
        .subscribe();

      const req = httpMock.expectOne('/api/invitations/bulk');
      expect(req.request.body.board_ids).toBeUndefined();
      req.flush({ created: [], errors: [] });
    });
  });

  describe('listAllInvitations()', () => {
    it('should GET /api/invitations/all with workspace_id param', () => {
      const invitations = [MOCK_INVITATION];

      service.listAllInvitations('ws-1').subscribe((result) => {
        expect(result).toEqual(invitations);
      });

      const req = httpMock.expectOne((r) => r.url === '/api/invitations/all');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('workspace_id')).toBe('ws-1');
      req.flush(invitations);
    });
  });

  describe('cancelInvitation()', () => {
    it('should DELETE /api/invitations/:invitationId', () => {
      service.cancelInvitation('inv-1').subscribe();

      const req = httpMock.expectOne('/api/invitations/inv-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('resendInvitation()', () => {
    it('should POST /api/invitations/:invitationId/resend', () => {
      service.resendInvitation('inv-1').subscribe((result) => {
        expect(result).toEqual(MOCK_INVITATION);
      });

      const req = httpMock.expectOne('/api/invitations/inv-1/resend');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(MOCK_INVITATION);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on get', () => {
      let error: any;
      service.get('nonexistent').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/workspaces/nonexistent');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(404);
    });

    it('should propagate 403 on removeMember', () => {
      let error: any;
      service.removeMember('ws-1', 'user-1').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/members/user-1');
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(403);
    });
  });
});
