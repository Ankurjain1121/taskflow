import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  DependencyService,
  TaskDependency,
  BlockerInfo,
} from './dependency.service';

const MOCK_DEPENDENCY: TaskDependency = {
  id: 'dep-1',
  source_task_id: 'task-1',
  target_task_id: 'task-2',
  dependency_type: 'blocks',
  related_task_id: 'task-2',
  related_task_title: 'Blocked Task',
  related_task_priority: 'high',
  related_task_column_name: 'To Do',
  is_blocked: false,
  created_at: '2026-02-20T00:00:00Z',
};

describe('DependencyService', () => {
  let service: DependencyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DependencyService],
    });
    service = TestBed.inject(DependencyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('listDependencies()', () => {
    it('should GET /api/tasks/:taskId/dependencies', () => {
      const deps = [MOCK_DEPENDENCY];

      service.listDependencies('task-1').subscribe((result) => {
        expect(result).toEqual(deps);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/dependencies');
      expect(req.request.method).toBe('GET');
      req.flush(deps);
    });
  });

  describe('createDependency()', () => {
    it('should POST /api/tasks/:taskId/dependencies with target and type', () => {
      service
        .createDependency('task-1', 'task-2', 'blocks')
        .subscribe((result) => {
          expect(result).toEqual(MOCK_DEPENDENCY);
        });

      const req = httpMock.expectOne('/api/tasks/task-1/dependencies');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        target_task_id: 'task-2',
        dependency_type: 'blocks',
      });
      req.flush(MOCK_DEPENDENCY);
    });
  });

  describe('deleteDependency()', () => {
    it('should DELETE /api/dependencies/:depId', () => {
      service.deleteDependency('dep-1').subscribe();

      const req = httpMock.expectOne('/api/dependencies/dep-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('checkBlockers()', () => {
    it('should GET /api/tasks/:taskId/blockers', () => {
      const blockers: BlockerInfo[] = [
        { task_id: 'task-3', title: 'Blocker Task', is_resolved: false },
      ];

      service.checkBlockers('task-1').subscribe((result) => {
        expect(result).toEqual(blockers);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/blockers');
      expect(req.request.method).toBe('GET');
      req.flush(blockers);
    });
  });

  describe('getBoardDependencies()', () => {
    it('should GET /api/boards/:boardId/dependencies', () => {
      const deps = [MOCK_DEPENDENCY];

      service.getBoardDependencies('board-1').subscribe((result) => {
        expect(result).toEqual(deps);
      });

      const req = httpMock.expectOne('/api/boards/board-1/dependencies');
      expect(req.request.method).toBe('GET');
      req.flush(deps);
    });
  });
});
