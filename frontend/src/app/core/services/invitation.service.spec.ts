import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  InvitationService,
  Invitation,
  CreateInvitationRequest,
  InvitationValidateResponse,
  AcceptInvitationRequest,
} from './invitation.service';
import { ApiService } from './api.service';

const MOCK_INVITATION: Invitation = {
  id: 'inv-1',
  email: 'user@example.com',
  workspace_id: 'ws-1',
  token: 'abc123',
  expires_at: '2026-03-01T00:00:00Z',
  created_at: '2026-02-20T00:00:00Z',
};

describe('InvitationService', () => {
  let service: InvitationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [InvitationService, ApiService],
    });
    service = TestBed.inject(InvitationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('listByWorkspace()', () => {
    it('should GET /api/invitations?workspace_id=:id', () => {
      const invitations = [MOCK_INVITATION];

      service.listByWorkspace('ws-1').subscribe((result) => {
        expect(result).toEqual(invitations);
      });

      const req = httpMock.expectOne('/api/invitations?workspace_id=ws-1');
      expect(req.request.method).toBe('GET');
      req.flush(invitations);
    });
  });

  describe('create()', () => {
    it('should POST /api/invitations with body', () => {
      const createReq: CreateInvitationRequest = {
        email: 'new@example.com',
        workspace_id: 'ws-1',
        role: 'member',
      };

      service.create(createReq).subscribe((result) => {
        expect(result).toEqual(MOCK_INVITATION);
      });

      const req = httpMock.expectOne('/api/invitations');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_INVITATION);
    });
  });

  describe('cancel()', () => {
    it('should DELETE /api/invitations/:id', () => {
      service.cancel('inv-1').subscribe();

      const req = httpMock.expectOne('/api/invitations/inv-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('resend()', () => {
    it('should POST /api/invitations/:id/resend', () => {
      service.resend('inv-1').subscribe((result) => {
        expect(result).toEqual(MOCK_INVITATION);
      });

      const req = httpMock.expectOne('/api/invitations/inv-1/resend');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(MOCK_INVITATION);
    });
  });

  describe('validate()', () => {
    it('should GET /api/invitations/validate/:token', () => {
      const response: InvitationValidateResponse = {
        valid: true,
        email: 'user@example.com',
        workspace_id: 'ws-1',
        role: 'member',
        expired: false,
        already_accepted: false,
      };

      service.validate('abc123').subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/invitations/validate/abc123');
      expect(req.request.method).toBe('GET');
      req.flush(response);
    });
  });

  describe('accept()', () => {
    it('should POST /api/invitations/accept with body', () => {
      const acceptReq: AcceptInvitationRequest = {
        token: 'abc123',
        name: 'New User',
        password: 'securePass',
      };

      service.accept(acceptReq).subscribe((result) => {
        expect(result).toEqual({ message: 'Accepted' });
      });

      const req = httpMock.expectOne('/api/invitations/accept');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(acceptReq);
      req.flush({ message: 'Accepted' });
    });
  });
});
