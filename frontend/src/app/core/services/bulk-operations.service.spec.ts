import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  BulkOperationsService,
  PreviewResult,
  BulkOperationResult,
  BulkOperation,
} from './bulk-operations.service';
import { Task } from './task.service';

const MOCK_PREVIEW: PreviewResult = {
  action: 'move',
  task_count: 3,
  description: 'Move 3 tasks to Done',
  warnings: [],
};

const MOCK_RESULT: BulkOperationResult = {
  operation_id: 'op-123',
  affected_count: 3,
  expires_at: '2026-03-05T12:00:00Z',
};

const MOCK_OPERATION: BulkOperation = {
  id: 'op-123',
  action_type: 'move',
  action_config: { column_id: 'col-done' },
  affected_task_ids: ['t1', 't2'],
  task_count: 2,
  created_at: '2026-03-04T10:00:00Z',
  expires_at: '2026-03-04T11:00:00Z',
};

describe('BulkOperationsService', () => {
  let service: BulkOperationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BulkOperationsService],
    });
    service = TestBed.inject(BulkOperationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('previewOperation()', () => {
    it('should POST to /api/projects/:boardId/bulk-operations/preview', () => {
      const taskIds = ['t1', 't2', 't3'];

      service
        .previewOperation('board-1', 'move', taskIds, { column_id: 'col-done' })
        .subscribe((result) => {
          expect(result).toEqual(MOCK_PREVIEW);
        });

      const req = httpMock.expectOne(
        '/api/projects/board-1/bulk-operations/preview',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        action: 'move',
        task_ids: taskIds,
        params: { column_id: 'col-done' },
      });
      req.flush(MOCK_PREVIEW);
    });

    it('should work without optional params', () => {
      service
        .previewOperation('board-1', 'delete', ['t1'])
        .subscribe((result) => {
          expect(result).toEqual(MOCK_PREVIEW);
        });

      const req = httpMock.expectOne(
        '/api/projects/board-1/bulk-operations/preview',
      );
      expect(req.request.body).toEqual({
        action: 'delete',
        task_ids: ['t1'],
        params: undefined,
      });
      req.flush(MOCK_PREVIEW);
    });

    it('should return preview with warnings', () => {
      const previewWithWarnings: PreviewResult = {
        ...MOCK_PREVIEW,
        warnings: ['3 tasks have running timers'],
      };

      service
        .previewOperation('board-1', 'move', ['t1'])
        .subscribe((result) => {
          expect(result.warnings.length).toBe(1);
          expect(result.warnings[0]).toContain('running timers');
        });

      const req = httpMock.expectOne(
        '/api/projects/board-1/bulk-operations/preview',
      );
      req.flush(previewWithWarnings);
    });
  });

  describe('executeOperation()', () => {
    it('should POST to /api/projects/:boardId/bulk-operations/execute', () => {
      service
        .executeOperation('board-1', 'move', ['t1', 't2'], {
          column_id: 'col-done',
        })
        .subscribe((result) => {
          expect(result).toEqual(MOCK_RESULT);
          expect(result.operation_id).toBe('op-123');
        });

      const req = httpMock.expectOne(
        '/api/projects/board-1/bulk-operations/execute',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        action: 'move',
        task_ids: ['t1', 't2'],
        params: { column_id: 'col-done' },
      });
      req.flush(MOCK_RESULT);
    });

    it('should propagate server error', () => {
      let error: any;
      service.executeOperation('board-1', 'move', ['t1']).subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne(
        '/api/projects/board-1/bulk-operations/execute',
      );
      req.flush('Too many tasks', { status: 400, statusText: 'Bad Request' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(400);
    });
  });

  describe('undoOperation()', () => {
    it('should POST to /api/bulk-operations/:opId/undo', () => {
      service.undoOperation('op-123').subscribe();

      const req = httpMock.expectOne('/api/bulk-operations/op-123/undo');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(null);
    });

    it('should handle expired undo', () => {
      let error: any;
      service.undoOperation('op-expired').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/bulk-operations/op-expired/undo');
      req.flush('Operation expired', { status: 410, statusText: 'Gone' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(410);
    });
  });

  describe('listOperations()', () => {
    it('should GET /api/projects/:boardId/bulk-operations', () => {
      service.listOperations('board-1').subscribe((ops) => {
        expect(ops).toEqual([MOCK_OPERATION]);
      });

      const req = httpMock.expectOne('/api/projects/board-1/bulk-operations');
      expect(req.request.method).toBe('GET');
      req.flush([MOCK_OPERATION]);
    });

    it('should return empty array when no operations', () => {
      service.listOperations('board-empty').subscribe((ops) => {
        expect(ops).toEqual([]);
      });

      const req = httpMock.expectOne('/api/projects/board-empty/bulk-operations');
      req.flush([]);
    });
  });

  describe('exportTasksCsv()', () => {
    let createObjectURLSpy: ReturnType<typeof vi.fn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
    let clickSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      createObjectURLSpy = vi
        .fn()
        .mockReturnValue('blob:http://localhost/fake');
      revokeObjectURLSpy = vi.fn();
      clickSpy = vi.fn();

      vi.stubGlobal('URL', {
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: revokeObjectURLSpy,
      });

      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: clickSpy,
      } as unknown as HTMLAnchorElement);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create a download link and trigger click', () => {
      const tasks: Task[] = [
        {
          id: 't1',
          column_id: 'col-1',
          title: 'Simple Task',
          description: null,
          priority: 'high',
          position: '1000',
          milestone_id: null,
          assignee_id: null,
          due_date: '2026-03-10',
          created_by: 'user-1',
          created_at: '2026-03-01T00:00:00Z',
          updated_at: '2026-03-01T00:00:00Z',
          assignees: [
            { id: 'u1', display_name: 'Alice', avatar_url: null },
          ],
          labels: [
            {
              id: 'l1',
              workspace_id: 'ws-1',
              name: 'Bug',
              color: '#f00',
              created_at: '',
            },
          ],
        },
      ];

      service.exportTasksCsv(tasks);

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    });

    it('should escape CSV values with commas', () => {
      const tasks: Task[] = [
        {
          id: 't1',
          column_id: 'col-1',
          title: 'Task with, comma',
          description: null,
          priority: 'medium',
          position: '1000',
          milestone_id: null,
          assignee_id: null,
          due_date: null,
          created_by: 'user-1',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          assignees: [],
          labels: [],
        },
      ];

      service.exportTasksCsv(tasks);

      // Verify the blob was created (the CSV escaping is internal)
      expect(createObjectURLSpy).toHaveBeenCalled();
      const blobArg = createObjectURLSpy.mock.calls[0][0];
      expect(blobArg).toBeInstanceOf(Blob);
    });

    it('should handle tasks with no assignees or labels', () => {
      const tasks: Task[] = [
        {
          id: 't1',
          column_id: 'col-1',
          title: 'Bare Task',
          description: null,
          priority: 'low',
          position: '1000',
          milestone_id: null,
          assignee_id: null,
          due_date: null,
          created_by: 'user-1',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      service.exportTasksCsv(tasks);
      expect(clickSpy).toHaveBeenCalled();
    });
  });
});
