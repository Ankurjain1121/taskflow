import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { SessionService, SessionInfo } from './session.service';

const MOCK_SESSION: SessionInfo = {
  id: 'session-1',
  ip_address: '192.168.1.1',
  user_agent: 'Mozilla/5.0',
  device_name: 'Chrome on Linux',
  last_active_at: '2026-01-15T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  is_current: true,
};

describe('SessionService', () => {
  let service: SessionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SessionService],
    });
    service = TestBed.inject(SessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('listSessions()', () => {
    it('should GET /api/users/me/sessions', () => {
      const sessions = [MOCK_SESSION];

      service.listSessions().subscribe((result) => {
        expect(result).toEqual(sessions);
      });

      const req = httpMock.expectOne('/api/users/me/sessions');
      expect(req.request.method).toBe('GET');
      req.flush(sessions);
    });
  });

  describe('revokeSession()', () => {
    it('should DELETE /api/users/me/sessions/:id', () => {
      service.revokeSession('session-1').subscribe();

      const req = httpMock.expectOne('/api/users/me/sessions/session-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('revokeAllOtherSessions()', () => {
    it('should DELETE /api/users/me/sessions and return revoked count', () => {
      const response = { revoked_count: 3 };

      service.revokeAllOtherSessions().subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/users/me/sessions');
      expect(req.request.method).toBe('DELETE');
      req.flush(response);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on listSessions', () => {
      let error: any;
      service.listSessions().subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/users/me/sessions');
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(401);
    });
  });
});
