import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  PositionService,
  Position,
  CreatePositionRequest,
  UpdatePositionRequest,
} from './position.service';

const MOCK_POSITION: Position = {
  id: 'pos-1',
  name: 'Frontend Developer',
  description: 'Builds UI features',
  project_id: 'board-1',
  fallback_position_id: null,
  fallback_position_name: null,
  tenant_id: 'tenant-1',
  created_by_id: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  holders: [
    {
      user_id: 'user-2',
      name: 'Bob',
      email: 'bob@example.com',
      avatar_url: null,
      assigned_at: '2026-01-02T00:00:00Z',
    },
  ],
  recurring_task_count: 3,
};

describe('PositionService', () => {
  let service: PositionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PositionService],
    });
    service = TestBed.inject(PositionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('listPositions()', () => {
    it('should GET /api/projects/:projectId/positions', () => {
      service.listPositions('board-1').subscribe((positions) => {
        expect(positions).toEqual([MOCK_POSITION]);
      });

      const req = httpMock.expectOne('/api/projects/board-1/positions');
      expect(req.request.method).toBe('GET');
      req.flush([MOCK_POSITION]);
    });
  });

  describe('createPosition()', () => {
    it('should POST /api/projects/:projectId/positions with body', () => {
      const createReq: CreatePositionRequest = {
        name: 'Backend Dev',
        description: 'Builds APIs',
      };

      service.createPosition('board-1', createReq).subscribe((pos) => {
        expect(pos).toEqual(MOCK_POSITION);
      });

      const req = httpMock.expectOne('/api/projects/board-1/positions');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_POSITION);
    });
  });

  describe('getPosition()', () => {
    it('should GET /api/positions/:id', () => {
      service.getPosition('pos-1').subscribe((pos) => {
        expect(pos).toEqual(MOCK_POSITION);
      });

      const req = httpMock.expectOne('/api/positions/pos-1');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_POSITION);
    });
  });

  describe('updatePosition()', () => {
    it('should PUT /api/positions/:id with body', () => {
      const updateReq: UpdatePositionRequest = { name: 'Sr. Frontend Dev' };

      service.updatePosition('pos-1', updateReq).subscribe((pos) => {
        expect(pos).toEqual(MOCK_POSITION);
      });

      const req = httpMock.expectOne('/api/positions/pos-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_POSITION);
    });
  });

  describe('deletePosition()', () => {
    it('should DELETE /api/positions/:id', () => {
      service.deletePosition('pos-1').subscribe();

      const req = httpMock.expectOne('/api/positions/pos-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('addHolder()', () => {
    it('should POST /api/positions/:positionId/holders with user_id', () => {
      service.addHolder('pos-1', 'user-3').subscribe();

      const req = httpMock.expectOne('/api/positions/pos-1/holders');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ user_id: 'user-3' });
      req.flush(null);
    });
  });

  describe('removeHolder()', () => {
    it('should DELETE /api/positions/:positionId/holders/:userId', () => {
      service.removeHolder('pos-1', 'user-3').subscribe();

      const req = httpMock.expectOne('/api/positions/pos-1/holders/user-3');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getPositionRecurringTasks()', () => {
    it('should GET /api/positions/:positionId/recurring-tasks', () => {
      const mockTasks = [{ id: 'rt-1', title: 'Weekly Standup' }];

      service.getPositionRecurringTasks('pos-1').subscribe((tasks) => {
        expect(tasks).toEqual(mockTasks);
      });

      const req = httpMock.expectOne('/api/positions/pos-1/recurring-tasks');
      expect(req.request.method).toBe('GET');
      req.flush(mockTasks);
    });
  });

  describe('error handling', () => {
    it('should propagate 404 error', () => {
      let error: any;
      service.getPosition('nonexistent').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/positions/nonexistent');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(404);
    });

    it('should propagate 403 error on addHolder', () => {
      let error: any;
      service.addHolder('pos-1', 'user-3').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/positions/pos-1/holders');
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(403);
    });
  });
});
