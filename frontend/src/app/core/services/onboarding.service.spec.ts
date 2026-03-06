import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  OnboardingService,
  InvitationContext,
  CreateWorkspaceResponse,
  InviteMembersResponse,
  GenerateSampleBoardResponse,
} from './onboarding.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OnboardingService],
    });
    service = TestBed.inject(OnboardingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getInvitationContext()', () => {
    it('should GET /api/onboarding/invitation-context with token param', () => {
      const context: InvitationContext = {
        workspace_id: 'ws-1',
        workspace_name: 'My Workspace',
        project_ids: ['board-1'],
      };

      service.getInvitationContext('token-xyz').subscribe((result) => {
        expect(result).toEqual(context);
      });

      const req = httpMock.expectOne(
        (r) => r.url === '/api/onboarding/invitation-context',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('token')).toBe('token-xyz');
      req.flush(context);
    });
  });

  describe('createWorkspace()', () => {
    it('should POST /api/onboarding/create-workspace with name and description', () => {
      const response: CreateWorkspaceResponse = { workspace_id: 'ws-new' };

      service.createWorkspace('New WS', 'Description').subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/onboarding/create-workspace');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'New WS',
        description: 'Description',
      });
      req.flush(response);
    });

    it('should send undefined description when not provided', () => {
      service.createWorkspace('New WS').subscribe();

      const req = httpMock.expectOne('/api/onboarding/create-workspace');
      expect(req.request.body.name).toBe('New WS');
      req.flush({ workspace_id: 'ws-new' });
    });
  });

  describe('inviteMembers()', () => {
    it('should POST /api/onboarding/invite-members with workspace_id and emails', () => {
      const response: InviteMembersResponse = { invited: 2, pending: 1 };

      service
        .inviteMembers('ws-1', ['a@test.com', 'b@test.com'])
        .subscribe((result) => {
          expect(result).toEqual(response);
        });

      const req = httpMock.expectOne('/api/onboarding/invite-members');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        workspace_id: 'ws-1',
        emails: ['a@test.com', 'b@test.com'],
      });
      req.flush(response);
    });
  });

  describe('generateSampleBoard()', () => {
    it('should POST /api/onboarding/generate-sample-board with workspace_id', () => {
      const response: GenerateSampleBoardResponse = {
        project_id: 'board-sample',
      };

      service.generateSampleBoard('ws-1').subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/onboarding/generate-sample-board');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ workspace_id: 'ws-1' });
      req.flush(response);
    });
  });

  describe('completeOnboarding()', () => {
    it('should POST /api/onboarding/complete with empty body', () => {
      service.completeOnboarding().subscribe();

      const req = httpMock.expectOne('/api/onboarding/complete');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(null);
    });
  });
});
