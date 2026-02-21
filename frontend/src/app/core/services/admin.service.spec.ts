import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  AdminService,
  AuditLogEntry,
  AuditLogResponse,
  AdminUser,
  TrashItem,
  TrashResponse,
} from './admin.service';

const MOCK_AUDIT_ENTRY: AuditLogEntry = {
  id: 'audit-1',
  user_id: 'user-1',
  action: 'create',
  entity_type: 'task',
  entity_id: 'task-1',
  ip_address: '127.0.0.1',
  user_agent: 'Mozilla/5.0',
  details: null,
  created_at: '2026-01-01T00:00:00Z',
  actor: {
    id: 'user-1',
    display_name: 'Test User',
    avatar_url: null,
    email: 'test@example.com',
  },
};

const MOCK_AUDIT_RESPONSE: AuditLogResponse = {
  items: [MOCK_AUDIT_ENTRY],
  next_cursor: null,
};

const MOCK_ADMIN_USER: AdminUser = {
  id: 'user-1',
  email: 'admin@example.com',
  display_name: 'Admin User',
  avatar_url: null,
  role: 'admin',
  workspace_count: 3,
  created_at: '2026-01-01T00:00:00Z',
  last_active_at: '2026-01-15T00:00:00Z',
  email_verified: true,
};

const MOCK_TRASH_ITEM: TrashItem = {
  id: 'trash-1',
  entity_type: 'task',
  entity_id: 'task-1',
  name: 'Deleted Task',
  deleted_by: {
    id: 'user-1',
    display_name: 'Test User',
    avatar_url: null,
  },
  deleted_at: '2026-01-10T00:00:00Z',
  expires_at: '2026-02-10T00:00:00Z',
  metadata: null,
};

const MOCK_TRASH_RESPONSE: TrashResponse = {
  items: [MOCK_TRASH_ITEM],
  next_cursor: null,
};

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AdminService],
    });
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAuditLog()', () => {
    it('should GET /api/admin/audit-log with no params by default', () => {
      service.getAuditLog().subscribe((result) => {
        expect(result).toEqual(MOCK_AUDIT_RESPONSE);
      });

      const req = httpMock.expectOne('/api/admin/audit-log');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_AUDIT_RESPONSE);
    });

    it('should pass all filter params when provided', () => {
      service
        .getAuditLog({
          cursor: 'c1',
          page_size: 10,
          user_id: 'user-1',
          action: 'create',
          entity_type: 'task',
          date_from: '2026-01-01',
          date_to: '2026-01-31',
          search: 'test',
        })
        .subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/admin/audit-log' &&
          r.params.get('cursor') === 'c1' &&
          r.params.get('page_size') === '10' &&
          r.params.get('user_id') === 'user-1' &&
          r.params.get('action') === 'create' &&
          r.params.get('entity_type') === 'task' &&
          r.params.get('date_from') === '2026-01-01' &&
          r.params.get('date_to') === '2026-01-31' &&
          r.params.get('search') === 'test'
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_AUDIT_RESPONSE);
    });
  });

  describe('getAuditActions()', () => {
    it('should GET /api/admin/audit-log/actions', () => {
      const actions = ['create', 'update', 'delete'];

      service.getAuditActions().subscribe((result) => {
        expect(result).toEqual(actions);
      });

      const req = httpMock.expectOne('/api/admin/audit-log/actions');
      expect(req.request.method).toBe('GET');
      req.flush(actions);
    });
  });

  describe('getUsers()', () => {
    it('should GET /api/admin/users with no params by default', () => {
      service.getUsers().subscribe((result) => {
        expect(result).toEqual([MOCK_ADMIN_USER]);
      });

      const req = httpMock.expectOne('/api/admin/users');
      expect(req.request.method).toBe('GET');
      req.flush([MOCK_ADMIN_USER]);
    });

    it('should pass search and role params when provided', () => {
      service.getUsers({ search: 'admin', role: 'admin' }).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/admin/users' &&
          r.params.get('search') === 'admin' &&
          r.params.get('role') === 'admin'
      );
      expect(req.request.method).toBe('GET');
      req.flush([MOCK_ADMIN_USER]);
    });
  });

  describe('updateUserRole()', () => {
    it('should PATCH /api/admin/users/:userId/role', () => {
      service.updateUserRole('user-1', 'manager').subscribe();

      const req = httpMock.expectOne('/api/admin/users/user-1/role');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ role: 'manager' });
      req.flush(null);
    });
  });

  describe('deleteUser()', () => {
    it('should DELETE /api/admin/users/:userId', () => {
      service.deleteUser('user-1').subscribe();

      const req = httpMock.expectOne('/api/admin/users/user-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getTrashItems()', () => {
    it('should GET /api/admin/trash with no params by default', () => {
      service.getTrashItems().subscribe((result) => {
        expect(result).toEqual(MOCK_TRASH_RESPONSE);
      });

      const req = httpMock.expectOne('/api/admin/trash');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_TRASH_RESPONSE);
    });

    it('should pass filter params when provided', () => {
      service
        .getTrashItems({ entity_type: 'task', cursor: 'c1', page_size: 5 })
        .subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/admin/trash' &&
          r.params.get('entity_type') === 'task' &&
          r.params.get('cursor') === 'c1' &&
          r.params.get('page_size') === '5'
      );
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_TRASH_RESPONSE);
    });
  });

  describe('restoreItem()', () => {
    it('should POST /api/admin/trash/:entityType/:entityId/restore', () => {
      service.restoreItem('task', 'task-1').subscribe();

      const req = httpMock.expectOne('/api/admin/trash/task/task-1/restore');
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('permanentlyDelete()', () => {
    it('should DELETE /api/admin/trash/:entityType/:entityId', () => {
      service.permanentlyDelete('task', 'task-1').subscribe();

      const req = httpMock.expectOne('/api/admin/trash/task/task-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('emptyTrash()', () => {
    it('should DELETE /api/admin/trash', () => {
      service.emptyTrash().subscribe();

      const req = httpMock.expectOne('/api/admin/trash');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on getAuditLog', () => {
      let error: any;
      service.getAuditLog().subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/admin/audit-log');
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(403);
    });
  });
});
