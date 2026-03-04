import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TeamService, MemberWorkload, OverloadedMember } from './team.service';

const MOCK_WORKLOAD: MemberWorkload = {
  user_id: 'user-1',
  user_name: 'Test User',
  user_avatar: null,
  active_tasks: 5,
  overdue_tasks: 1,
  done_tasks: 3,
  total_tasks: 9,
  tasks_by_status: { done: 3, in_progress: 5, todo: 1 },
  is_overloaded: false,
};

const MOCK_OVERLOADED: OverloadedMember = {
  user_id: 'user-2',
  user_name: 'Busy User',
  user_avatar: null,
  active_tasks: 15,
};

describe('TeamService', () => {
  let service: TeamService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TeamService],
    });
    service = TestBed.inject(TeamService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getTeamWorkload()', () => {
    it('should GET /api/workspaces/:workspaceId/team-workload', () => {
      service.getTeamWorkload('ws-1').subscribe((result) => {
        expect(result).toEqual([MOCK_WORKLOAD]);
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/team-workload');
      expect(req.request.method).toBe('GET');
      req.flush([MOCK_WORKLOAD]);
    });

    it('should compute done_tasks from tasks_by_status', () => {
      const rawMember: MemberWorkload = {
        user_id: 'user-1',
        user_name: 'Test',
        user_avatar: null,
        active_tasks: 2,
        overdue_tasks: 0,
        done_tasks: 0,
        total_tasks: 7,
        tasks_by_status: { done: 5, in_progress: 2 },
        is_overloaded: false,
      };

      service.getTeamWorkload('ws-1').subscribe((result) => {
        expect(result[0].done_tasks).toBe(5);
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/team-workload');
      req.flush([rawMember]);
    });

    it('should default done_tasks to 0 when tasks_by_status is undefined', () => {
      const rawMember: MemberWorkload = {
        user_id: 'user-1',
        user_name: 'Test',
        user_avatar: null,
        active_tasks: 2,
        overdue_tasks: 0,
        done_tasks: 0,
        total_tasks: 2,
        is_overloaded: false,
      };

      service.getTeamWorkload('ws-1').subscribe((result) => {
        expect(result[0].done_tasks).toBe(0);
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/team-workload');
      req.flush([rawMember]);
    });
  });

  describe('getOverloadedMembers()', () => {
    it('should GET /api/workspaces/:workspaceId/overloaded-members with default threshold', () => {
      service.getOverloadedMembers('ws-1').subscribe((result) => {
        expect(result).toEqual([MOCK_OVERLOADED]);
      });

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/workspaces/ws-1/overloaded-members' &&
          r.params.get('threshold') === '10',
      );
      expect(req.request.method).toBe('GET');
      req.flush([MOCK_OVERLOADED]);
    });

    it('should pass custom threshold parameter', () => {
      service.getOverloadedMembers('ws-1', 5).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/workspaces/ws-1/overloaded-members' &&
          r.params.get('threshold') === '5',
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on getTeamWorkload', () => {
      let error: any;
      service.getTeamWorkload('ws-bad').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/workspaces/ws-bad/team-workload');
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(403);
    });
  });
});
