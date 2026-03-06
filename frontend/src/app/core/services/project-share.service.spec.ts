import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  ProjectShareService,
  ProjectShare,
  CreateShareRequest,
  SharedProjectAccess,
} from './project-share.service';

const MOCK_SHARE: ProjectShare = {
  id: 'share-1',
  project_id: 'board-1',
  share_token: 'token-abc',
  name: 'Public Link',
  expires_at: null,
  is_active: true,
  permissions: { view: true, comment: false },
  tenant_id: 'tenant-1',
  created_by_id: 'user-1',
  created_at: '2026-02-20T00:00:00Z',
};

describe('ProjectShareService', () => {
  let service: ProjectShareService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProjectShareService],
    });
    service = TestBed.inject(ProjectShareService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('listShares()', () => {
    it('should GET /api/projects/:projectId/shares', () => {
      const shares = [MOCK_SHARE];

      service.listShares('board-1').subscribe((result) => {
        expect(result).toEqual(shares);
      });

      const req = httpMock.expectOne('/api/projects/board-1/shares');
      expect(req.request.method).toBe('GET');
      req.flush(shares);
    });
  });

  describe('createShare()', () => {
    it('should POST /api/projects/:projectId/shares with body', () => {
      const createReq: CreateShareRequest = {
        name: 'New Link',
        permissions: { view: true },
      };

      service.createShare('board-1', createReq).subscribe((result) => {
        expect(result).toEqual(MOCK_SHARE);
      });

      const req = httpMock.expectOne('/api/projects/board-1/shares');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_SHARE);
    });
  });

  describe('deleteShare()', () => {
    it('should DELETE /api/shares/:shareId', () => {
      service.deleteShare('share-1').subscribe();

      const req = httpMock.expectOne('/api/shares/share-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('toggleShare()', () => {
    it('should PUT /api/shares/:shareId with is_active flag', () => {
      service.toggleShare('share-1', false).subscribe((result) => {
        expect(result).toEqual(MOCK_SHARE);
      });

      const req = httpMock.expectOne('/api/shares/share-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ is_active: false });
      req.flush(MOCK_SHARE);
    });
  });

  describe('accessSharedBoard()', () => {
    it('should GET /api/shared/:token without password', () => {
      const access: SharedProjectAccess = {
        project_id: 'board-1',
        project_name: 'Test Project',
        permissions: { view: true },
        columns: [],
        tasks: [],
      };

      service.accessSharedBoard('token-abc').subscribe((result) => {
        expect(result).toEqual(access);
      });

      const req = httpMock.expectOne('/api/shared/token-abc');
      expect(req.request.method).toBe('GET');
      req.flush(access);
    });

    it('should include password param when provided', () => {
      service.accessSharedBoard('token-abc', 'secret').subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/shared/token-abc');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('password')).toBe('secret');
      req.flush({
        project_id: 'board-1',
        project_name: 'Test Project',
        permissions: {},
        columns: [],
        tasks: [],
      });
    });
  });
});
