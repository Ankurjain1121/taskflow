import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  ArchiveService,
  ArchiveItem,
  PaginatedArchive,
} from './archive.service';

const MOCK_ARCHIVE_ITEM: ArchiveItem = {
  entity_type: 'task',
  entity_id: 'task-1',
  name: 'Archived Task',
  deleted_at: '2026-01-01T00:00:00Z',
  days_remaining: 25,
};

const MOCK_PAGINATED: PaginatedArchive = {
  items: [MOCK_ARCHIVE_ITEM],
  next_cursor: null,
};

describe('ArchiveService', () => {
  let service: ArchiveService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ArchiveService],
    });
    service = TestBed.inject(ArchiveService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('list()', () => {
    it('should GET /api/archive with no params by default', () => {
      service.list().subscribe((result) => {
        expect(result).toEqual(MOCK_PAGINATED);
      });

      const req = httpMock.expectOne('/api/archive');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_PAGINATED);
    });

    it('should pass entity_type param when provided', () => {
      service.list({ entity_type: 'task' }).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/archive' && r.params.get('entity_type') === 'task',
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_PAGINATED);
    });

    it('should pass cursor param when provided', () => {
      service.list({ cursor: 'abc123' }).subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === '/api/archive' && r.params.get('cursor') === 'abc123',
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_PAGINATED);
    });

    it('should pass page_size param when provided', () => {
      service.list({ page_size: 10 }).subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === '/api/archive' && r.params.get('page_size') === '10',
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_PAGINATED);
    });

    it('should pass all params when provided', () => {
      service
        .list({ entity_type: 'project', cursor: 'xyz', page_size: 5 })
        .subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/archive' &&
          r.params.get('entity_type') === 'project' &&
          r.params.get('cursor') === 'xyz' &&
          r.params.get('page_size') === '5',
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_PAGINATED);
    });
  });

  describe('restore()', () => {
    it('should POST /api/archive/restore with entity info', () => {
      const response = { success: true, message: 'Restored' };

      service.restore('task', 'task-1').subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/archive/restore');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        entity_type: 'task',
        entity_id: 'task-1',
      });
      req.flush(response);
    });
  });

  describe('permanentlyDelete()', () => {
    it('should DELETE /api/archive/:entityType/:entityId', () => {
      const response = { success: true, message: 'Deleted permanently' };

      service.permanentlyDelete('task', 'task-1').subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/archive/task/task-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(response);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on restore', () => {
      let error: any;
      service.restore('task', 'nonexistent').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/archive/restore');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(404);
    });
  });
});
