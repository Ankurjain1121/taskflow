import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  ProjectService,
  Project,
  Column,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateColumnRequest,
  UpdateColumnRequest,
  ReorderColumnRequest,
  ProjectMember,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  ProjectFullResponse,
} from './project.service';

const MOCK_PROJECT: Project = {
  id: 'board-1',
  workspace_id: 'ws-1',
  name: 'Test Project',
  description: 'A test project',
  position: '1000',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_COLUMN: Column = {
  id: 'col-1',
  project_id: 'board-1',
  name: 'To Do',
  position: '1000',
  color: '#3b82f6',
  status_mapping: null,
  wip_limit: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_MEMBER: ProjectMember = {
  user_id: 'user-1',
  project_id: 'board-1',
  role: 'editor',
  name: 'Test User',
  email: 'test@example.com',
  avatar_url: null,
};

describe('ProjectService', () => {
  let service: ProjectService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProjectService],
    });
    service = TestBed.inject(ProjectService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('listProjects()', () => {
    it('should GET /api/workspaces/:workspaceId/projects', () => {
      const projects = [MOCK_PROJECT];

      service.listProjects('ws-1').subscribe((result) => {
        expect(result).toEqual(projects);
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/projects');
      expect(req.request.method).toBe('GET');
      req.flush(projects);
    });
  });

  describe('getProject()', () => {
    it('should GET /api/projects/:projectId', () => {
      service.getProject('board-1').subscribe((board) => {
        expect(board).toEqual(MOCK_PROJECT);
      });

      const req = httpMock.expectOne('/api/projects/board-1');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_PROJECT);
    });
  });

  describe('createProject()', () => {
    it('should POST /api/workspaces/:workspaceId/projects with body', () => {
      const createReq: CreateProjectRequest = {
        name: 'New Project',
        description: 'Project description',
        template: 'kanban',
      };

      service.createProject('ws-1', createReq).subscribe((board) => {
        expect(board).toEqual(MOCK_PROJECT);
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/projects');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_PROJECT);
    });
  });

  describe('updateProject()', () => {
    it('should PATCH /api/projects/:projectId with body', () => {
      const updateReq: UpdateProjectRequest = { name: 'Renamed Project' };

      service.updateProject('board-1', updateReq).subscribe((board) => {
        expect(board).toEqual(MOCK_PROJECT);
      });

      const req = httpMock.expectOne('/api/projects/board-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_PROJECT);
    });
  });

  describe('deleteProject()', () => {
    it('should DELETE /api/projects/:projectId', () => {
      service.deleteProject('board-1').subscribe();

      const req = httpMock.expectOne('/api/projects/board-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('listColumns()', () => {
    it('should GET /api/projects/:projectId/columns', () => {
      const columns = [MOCK_COLUMN];

      service.listColumns('board-1').subscribe((result) => {
        expect(result).toEqual(columns);
      });

      const req = httpMock.expectOne('/api/projects/board-1/columns');
      expect(req.request.method).toBe('GET');
      req.flush(columns);
    });
  });

  describe('createColumn()', () => {
    it('should POST /api/projects/:projectId/columns with body', () => {
      const createReq: CreateColumnRequest = {
        name: 'In Progress',
        color: '#f59e0b',
        wip_limit: 5,
      };

      service.createColumn('board-1', createReq).subscribe((column) => {
        expect(column).toEqual(MOCK_COLUMN);
      });

      const req = httpMock.expectOne('/api/projects/board-1/columns');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_COLUMN);
    });
  });

  describe('updateColumn()', () => {
    it('should PATCH /api/columns/:columnId with body', () => {
      const updateReq: UpdateColumnRequest = {
        name: 'Done',
        color: '#22c55e',
        status_mapping: { done: true },
      };

      service.updateColumn('col-1', updateReq).subscribe((column) => {
        expect(column).toEqual(MOCK_COLUMN);
      });

      const req = httpMock.expectOne('/api/columns/col-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_COLUMN);
    });
  });

  describe('reorderColumn()', () => {
    it('should PUT /api/columns/:columnId/position with new_index', () => {
      const reorderReq: ReorderColumnRequest = { new_index: 2 };

      service.reorderColumn('col-1', reorderReq).subscribe((column) => {
        expect(column).toEqual(MOCK_COLUMN);
      });

      const req = httpMock.expectOne('/api/columns/col-1/position');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(reorderReq);
      req.flush(MOCK_COLUMN);
    });
  });

  describe('deleteColumn()', () => {
    it('should DELETE /api/columns/:columnId', () => {
      service.deleteColumn('col-1').subscribe();

      const req = httpMock.expectOne('/api/columns/col-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getProjectMembers()', () => {
    it('should GET /api/projects/:projectId/members', () => {
      const members = [MOCK_MEMBER];

      service.getProjectMembers('board-1').subscribe((result) => {
        expect(result).toEqual(members);
      });

      const req = httpMock.expectOne('/api/projects/board-1/members');
      expect(req.request.method).toBe('GET');
      req.flush(members);
    });
  });

  describe('inviteProjectMember()', () => {
    it('should POST /api/projects/:projectId/members with email and role', () => {
      const inviteReq: InviteMemberRequest = {
        email: 'new@example.com',
        role: 'viewer',
      };

      service.inviteProjectMember('board-1', inviteReq).subscribe((member) => {
        expect(member).toEqual(MOCK_MEMBER);
      });

      const req = httpMock.expectOne('/api/projects/board-1/members');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(inviteReq);
      req.flush(MOCK_MEMBER);
    });
  });

  describe('updateProjectMemberRole()', () => {
    it('should PATCH /api/projects/:projectId/members/:userId with role', () => {
      const roleReq: UpdateMemberRoleRequest = { role: 'editor' };

      service
        .updateProjectMemberRole('board-1', 'user-1', roleReq)
        .subscribe((member) => {
          expect(member).toEqual(MOCK_MEMBER);
        });

      const req = httpMock.expectOne('/api/projects/board-1/members/user-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(roleReq);
      req.flush(MOCK_MEMBER);
    });
  });

  describe('removeProjectMember()', () => {
    it('should DELETE /api/projects/:projectId/members/:userId', () => {
      service.removeProjectMember('board-1', 'user-1').subscribe();

      const req = httpMock.expectOne('/api/projects/board-1/members/user-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getProjectFull()', () => {
    it('should GET /api/projects/:projectId/full', () => {
      const fullResponse: ProjectFullResponse = {
        project: { ...MOCK_PROJECT, columns: [MOCK_COLUMN] },
        tasks: [],
        members: [MOCK_MEMBER],
      };

      service.getProjectFull('board-1').subscribe((result) => {
        expect(result).toEqual(fullResponse);
      });

      const req = httpMock.expectOne('/api/projects/board-1/full');
      expect(req.request.method).toBe('GET');
      req.flush(fullResponse);
    });
  });

  describe('renameColumn()', () => {
    it('should PUT /api/columns/:columnId/name with name', () => {
      service.renameColumn('col-1', 'In Progress').subscribe((column) => {
        expect(column).toEqual(MOCK_COLUMN);
      });

      const req = httpMock.expectOne('/api/columns/col-1/name');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ name: 'In Progress' });
      req.flush(MOCK_COLUMN);
    });
  });

  describe('updateColumnWipLimit()', () => {
    it('should PUT /api/columns/:columnId/wip-limit with wip_limit', () => {
      service.updateColumnWipLimit('col-1', 5).subscribe((column) => {
        expect(column).toEqual(MOCK_COLUMN);
      });

      const req = httpMock.expectOne('/api/columns/col-1/wip-limit');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ wip_limit: 5 });
      req.flush(MOCK_COLUMN);
    });

    it('should allow null wip_limit to clear limit', () => {
      service.updateColumnWipLimit('col-1', null).subscribe();

      const req = httpMock.expectOne('/api/columns/col-1/wip-limit');
      expect(req.request.body).toEqual({ wip_limit: null });
      req.flush(MOCK_COLUMN);
    });
  });

  describe('updateColumnIcon()', () => {
    it('should PUT /api/columns/:columnId/icon with icon', () => {
      service.updateColumnIcon('col-1', 'pi pi-check').subscribe();

      const req = httpMock.expectOne('/api/columns/col-1/icon');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ icon: 'pi pi-check' });
      req.flush(MOCK_COLUMN);
    });

    it('should allow null icon to clear icon', () => {
      service.updateColumnIcon('col-1', null).subscribe();

      const req = httpMock.expectOne('/api/columns/col-1/icon');
      expect(req.request.body).toEqual({ icon: null });
      req.flush(MOCK_COLUMN);
    });
  });

  describe('duplicateProject()', () => {
    it('should POST /api/projects/:projectId/duplicate with body', () => {
      const dupReq = { name: 'Copy of Project', include_tasks: true };

      service.duplicateProject('board-1', dupReq).subscribe((board) => {
        expect(board).toEqual(MOCK_PROJECT);
      });

      const req = httpMock.expectOne('/api/projects/board-1/duplicate');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dupReq);
      req.flush(MOCK_PROJECT);
    });
  });

  describe('getProjectFull() with params', () => {
    it('should pass limit and offset query params', () => {
      service
        .getProjectFull('board-1', { limit: 50, offset: 100 })
        .subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/projects/board-1/full' &&
          r.params.get('limit') === '50' &&
          r.params.get('offset') === '100',
      );
      expect(req.request.method).toBe('GET');
      req.flush({
        project: { ...MOCK_PROJECT, columns: [] },
        tasks: [],
        members: [],
        meta: { total_task_count: 200, current_limit: 50, current_offset: 100 },
      });
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on getProject', () => {
      let error: any;
      service.getProject('nonexistent').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/projects/nonexistent');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(404);
    });

    it('should propagate HTTP errors on createProject', () => {
      let error: any;
      service.createProject('ws-1', { name: '' }).subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/projects');
      req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(400);
    });

    it('should propagate 403 on deleteProject', () => {
      let error: any;
      service.deleteProject('board-1').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/projects/board-1');
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(403);
    });
  });
});
