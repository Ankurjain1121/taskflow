import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  DashboardService,
  DashboardStats,
  DashboardActivityEntry,
  TasksByStatus,
  TasksByPriority,
  OverdueTask,
  CompletionTrendPoint,
  UpcomingDeadline,
  MyTask,
} from './dashboard.service';

const MOCK_STATS: DashboardStats = {
  total_tasks: 42,
  overdue: 3,
  completed_this_week: 12,
  due_today: 5,
};

const MOCK_ACTIVITY: DashboardActivityEntry[] = [
  {
    id: 'act-1',
    action: 'created',
    entity_type: 'task',
    entity_id: 'task-1',
    metadata: { title: 'New Task' },
    created_at: '2026-02-18T10:00:00Z',
    actor_name: 'Alice',
    actor_avatar_url: null,
  },
];

const MOCK_TASKS_BY_STATUS: TasksByStatus[] = [
  { status: 'todo', count: 10, color: '#ccc' },
  { status: 'in_progress', count: 5, color: '#00f' },
  { status: 'done', count: 20, color: '#0f0' },
];

const MOCK_TASKS_BY_PRIORITY: TasksByPriority[] = [
  { priority: 'high', count: 8 },
  { priority: 'medium', count: 15 },
  { priority: 'low', count: 19 },
];

const MOCK_OVERDUE: OverdueTask[] = [
  {
    id: 'task-1',
    title: 'Overdue task',
    due_date: '2026-02-10',
    priority: 'high',
    board_id: 'board-1',
    board_name: 'Main Board',
    days_overdue: 8,
  },
];

const MOCK_TREND: CompletionTrendPoint[] = [
  { date: '2026-02-17', completed: 4 },
  { date: '2026-02-18', completed: 6 },
];

const MOCK_DEADLINES: UpcomingDeadline[] = [
  {
    id: 'task-2',
    title: 'Due soon',
    due_date: '2026-02-20',
    priority: 'medium',
    board_id: 'board-1',
    board_name: 'Main Board',
    days_until_due: 2,
  },
];

const MOCK_MY_TASKS: MyTask[] = [
  {
    id: 'task-3',
    title: 'My task',
    priority: 'high',
    due_date: '2026-02-25',
    board_id: 'board-1',
    board_name: 'Main Board',
    column_name: 'In Progress',
    is_done: false,
  },
];

describe('DashboardService', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DashboardService],
    });
    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getStats()', () => {
    it('should GET /api/dashboard/stats without params', () => {
      service.getStats().subscribe((stats) => {
        expect(stats).toEqual(MOCK_STATS);
      });

      const req = httpMock.expectOne('/api/dashboard/stats');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toEqual([]);
      req.flush(MOCK_STATS);
    });

    it('should include workspace_id param when provided', () => {
      service.getStats('ws-1').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/stats' &&
          r.params.get('workspace_id') === 'ws-1',
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_STATS);
    });
  });

  describe('getRecentActivity()', () => {
    it('should GET /api/dashboard/recent-activity with default limit=10', () => {
      service.getRecentActivity().subscribe((activity) => {
        expect(activity).toEqual(MOCK_ACTIVITY);
      });

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/recent-activity' &&
          r.params.get('limit') === '10',
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_ACTIVITY);
    });

    it('should pass custom limit', () => {
      service.getRecentActivity(5).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/recent-activity' &&
          r.params.get('limit') === '5',
      );
      req.flush(MOCK_ACTIVITY);
    });

    it('should include workspace_id and limit params together', () => {
      service.getRecentActivity(20, 'ws-2').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/recent-activity' &&
          r.params.get('limit') === '20' &&
          r.params.get('workspace_id') === 'ws-2',
      );
      req.flush(MOCK_ACTIVITY);
    });
  });

  describe('getTasksByStatus()', () => {
    it('should GET /api/dashboard/tasks-by-status', () => {
      service.getTasksByStatus().subscribe((data) => {
        expect(data).toEqual(MOCK_TASKS_BY_STATUS);
      });

      const req = httpMock.expectOne('/api/dashboard/tasks-by-status');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_TASKS_BY_STATUS);
    });

    it('should include workspace_id param when provided', () => {
      service.getTasksByStatus('ws-1').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/tasks-by-status' &&
          r.params.get('workspace_id') === 'ws-1',
      );
      req.flush(MOCK_TASKS_BY_STATUS);
    });
  });

  describe('getTasksByPriority()', () => {
    it('should GET /api/dashboard/tasks-by-priority', () => {
      service.getTasksByPriority().subscribe((data) => {
        expect(data).toEqual(MOCK_TASKS_BY_PRIORITY);
      });

      const req = httpMock.expectOne('/api/dashboard/tasks-by-priority');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_TASKS_BY_PRIORITY);
    });

    it('should include workspace_id param when provided', () => {
      service.getTasksByPriority('ws-1').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/tasks-by-priority' &&
          r.params.get('workspace_id') === 'ws-1',
      );
      req.flush(MOCK_TASKS_BY_PRIORITY);
    });
  });

  describe('getOverdueTasks()', () => {
    it('should GET /api/dashboard/overdue-tasks with default limit=10', () => {
      service.getOverdueTasks().subscribe((data) => {
        expect(data).toEqual(MOCK_OVERDUE);
      });

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/overdue-tasks' &&
          r.params.get('limit') === '10',
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_OVERDUE);
    });

    it('should pass custom limit', () => {
      service.getOverdueTasks(3).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/overdue-tasks' &&
          r.params.get('limit') === '3',
      );
      req.flush(MOCK_OVERDUE);
    });

    it('should include workspace_id and limit params together', () => {
      service.getOverdueTasks(5, 'ws-3').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/overdue-tasks' &&
          r.params.get('limit') === '5' &&
          r.params.get('workspace_id') === 'ws-3',
      );
      req.flush(MOCK_OVERDUE);
    });
  });

  describe('getCompletionTrend()', () => {
    it('should GET /api/dashboard/completion-trend with default days=30', () => {
      service.getCompletionTrend().subscribe((data) => {
        expect(data).toEqual(MOCK_TREND);
      });

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/completion-trend' &&
          r.params.get('days') === '30',
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_TREND);
    });

    it('should pass custom days', () => {
      service.getCompletionTrend(7).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/completion-trend' &&
          r.params.get('days') === '7',
      );
      req.flush(MOCK_TREND);
    });

    it('should include workspace_id and days params together', () => {
      service.getCompletionTrend(14, 'ws-4').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/completion-trend' &&
          r.params.get('days') === '14' &&
          r.params.get('workspace_id') === 'ws-4',
      );
      req.flush(MOCK_TREND);
    });
  });

  describe('getUpcomingDeadlines()', () => {
    it('should GET /api/dashboard/upcoming-deadlines with default days=14', () => {
      service.getUpcomingDeadlines().subscribe((data) => {
        expect(data).toEqual(MOCK_DEADLINES);
      });

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/upcoming-deadlines' &&
          r.params.get('days') === '14',
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_DEADLINES);
    });

    it('should pass custom days', () => {
      service.getUpcomingDeadlines(7).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/upcoming-deadlines' &&
          r.params.get('days') === '7',
      );
      req.flush(MOCK_DEADLINES);
    });

    it('should include workspace_id and days params together', () => {
      service.getUpcomingDeadlines(21, 'ws-5').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/upcoming-deadlines' &&
          r.params.get('days') === '21' &&
          r.params.get('workspace_id') === 'ws-5',
      );
      req.flush(MOCK_DEADLINES);
    });
  });

  describe('getMyTasks()', () => {
    it('should GET /api/dashboard/my-tasks', () => {
      service.getMyTasks().subscribe((data) => {
        expect(data).toEqual(MOCK_MY_TASKS);
      });

      const req = httpMock.expectOne('/api/dashboard/my-tasks');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_MY_TASKS);
    });

    it('should include workspace_id param when provided', () => {
      service.getMyTasks('ws-1').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/my-tasks' &&
          r.params.get('workspace_id') === 'ws-1',
      );
      req.flush(MOCK_MY_TASKS);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors', () => {
      let error: any;
      service.getStats().subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/dashboard/stats');
      req.flush('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      expect(error).toBeTruthy();
      expect(error.status).toBe(500);
    });
  });

  describe('invalidateCache()', () => {
    it('should clear all cached entries', () => {
      // Populate cache
      service.getStats().subscribe();
      const req1 = httpMock.expectOne('/api/dashboard/stats');
      req1.flush(MOCK_STATS);

      // Verify cached (no new request)
      service.getStats().subscribe();
      httpMock.expectNone('/api/dashboard/stats');

      // Invalidate
      service.invalidateCache();

      // Should make a new request
      service.getStats().subscribe();
      const req2 = httpMock.expectOne('/api/dashboard/stats');
      req2.flush(MOCK_STATS);
    });
  });

  describe('cache TTL (2 minutes)', () => {
    it('should serve cached data within 120 seconds', () => {
      // First call populates cache
      service.getStats().subscribe();
      const req1 = httpMock.expectOne('/api/dashboard/stats');
      req1.flush(MOCK_STATS);

      // Advance time by 119 seconds (still within TTL)
      const cacheMap = (service as any).cache as Map<string, any>;
      const entry = cacheMap.get('stats:');
      expect(entry).toBeTruthy();
      // Manually set timestamp to 119 seconds ago
      entry.timestamp = Date.now() - 119_000;

      // Should still use cache
      service.getStats().subscribe();
      httpMock.expectNone('/api/dashboard/stats');
    });

    it('should refetch after 120 seconds', () => {
      // First call populates cache
      service.getStats().subscribe();
      const req1 = httpMock.expectOne('/api/dashboard/stats');
      req1.flush(MOCK_STATS);

      // Expire the cache entry (set timestamp to 121 seconds ago)
      const cacheMap = (service as any).cache as Map<string, any>;
      const entry = cacheMap.get('stats:');
      entry.timestamp = Date.now() - 121_000;

      // Should make a new request
      service.getStats().subscribe();
      const req2 = httpMock.expectOne('/api/dashboard/stats');
      req2.flush(MOCK_STATS);
    });
  });

  describe('workspace-scoped caching', () => {
    it('should cache stats separately per workspace', () => {
      // Fetch for ws-1
      service.getStats('ws-1').subscribe();
      const req1 = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/stats' &&
          r.params.get('workspace_id') === 'ws-1',
      );
      req1.flush(MOCK_STATS);

      // Fetch for ws-2 should make a new request
      service.getStats('ws-2').subscribe();
      const req2 = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/stats' &&
          r.params.get('workspace_id') === 'ws-2',
      );
      req2.flush({ ...MOCK_STATS, total_tasks: 100 });

      // Fetch for ws-1 again should use cache
      service.getStats('ws-1').subscribe();
      httpMock.expectNone('/api/dashboard/stats');
    });

    it('should cache tasks-by-status separately per workspace', () => {
      service.getTasksByStatus('ws-a').subscribe();
      const req1 = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/tasks-by-status' &&
          r.params.get('workspace_id') === 'ws-a',
      );
      req1.flush(MOCK_TASKS_BY_STATUS);

      service.getTasksByStatus('ws-b').subscribe();
      const req2 = httpMock.expectOne(
        (r) =>
          r.url === '/api/dashboard/tasks-by-status' &&
          r.params.get('workspace_id') === 'ws-b',
      );
      req2.flush(MOCK_TASKS_BY_STATUS);
    });
  });
});
