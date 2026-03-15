import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  TaskGroupService,
  TaskGroup,
  TaskGroupWithStats,
  CreateTaskGroupRequest,
  UpdateTaskGroupRequest,
} from './task-group.service';

const MOCK_GROUP: TaskGroup = {
  id: 'grp-1',
  board_id: 'board-1',
  name: 'Frontend',
  color: '#3b82f6',
  position: '1000',
  collapsed: false,
  tenant_id: 'tenant-1',
  created_by_id: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
};

const MOCK_GROUP_WITH_STATS: TaskGroupWithStats = {
  group: MOCK_GROUP,
  task_count: 5,
  completed_count: 2,
  estimated_hours: 10,
};

describe('TaskGroupService', () => {
  let service: TaskGroupService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TaskGroupService],
    });
    service = TestBed.inject(TaskGroupService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('listGroups()', () => {
    it('should GET /api/projects/:boardId/groups', () => {
      const groups = [MOCK_GROUP];

      service.listGroups('board-1').subscribe((result) => {
        expect(result).toEqual(groups);
      });

      const req = httpMock.expectOne('/api/projects/board-1/groups');
      expect(req.request.method).toBe('GET');
      req.flush(groups);
    });
  });

  describe('listGroupsWithStats()', () => {
    it('should GET /api/projects/:boardId/groups/stats', () => {
      const stats = [MOCK_GROUP_WITH_STATS];

      service.listGroupsWithStats('board-1').subscribe((result) => {
        expect(result).toEqual(stats);
      });

      const req = httpMock.expectOne('/api/projects/board-1/groups/stats');
      expect(req.request.method).toBe('GET');
      req.flush(stats);
    });
  });

  describe('getGroup()', () => {
    it('should GET /api/groups/:groupId', () => {
      service.getGroup('grp-1').subscribe((result) => {
        expect(result).toEqual(MOCK_GROUP);
      });

      const req = httpMock.expectOne('/api/groups/grp-1');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_GROUP);
    });
  });

  describe('createGroup()', () => {
    it('should POST /api/projects/:boardId/groups with body', () => {
      const createReq: CreateTaskGroupRequest = {
        board_id: 'board-1',
        name: 'Backend',
        color: '#22c55e',
        position: '2000',
      };

      service.createGroup('board-1', createReq).subscribe((result) => {
        expect(result).toEqual(MOCK_GROUP);
      });

      const req = httpMock.expectOne('/api/projects/board-1/groups');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_GROUP);
    });
  });

  describe('updateGroup()', () => {
    it('should PUT /api/groups/:groupId with body', () => {
      const updateReq: UpdateTaskGroupRequest = { name: 'Frontend Updated' };

      service.updateGroup('grp-1', updateReq).subscribe((result) => {
        expect(result).toEqual(MOCK_GROUP);
      });

      const req = httpMock.expectOne('/api/groups/grp-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_GROUP);
    });
  });

  describe('toggleCollapse()', () => {
    it('should PUT /api/groups/:groupId/collapse with collapsed flag', () => {
      service.toggleCollapse('grp-1', true).subscribe((result) => {
        expect(result).toEqual(MOCK_GROUP);
      });

      const req = httpMock.expectOne('/api/groups/grp-1/collapse');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ collapsed: true });
      req.flush(MOCK_GROUP);
    });
  });

  describe('deleteGroup()', () => {
    it('should DELETE /api/groups/:groupId', () => {
      service.deleteGroup('grp-1').subscribe((result) => {
        expect(result).toEqual({ success: true });
      });

      const req = httpMock.expectOne('/api/groups/grp-1');
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true });
    });
  });
});
