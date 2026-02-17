import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, User, TokenResponse } from './auth.service';

const MOCK_USER: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  avatar_url: null,
  role: 'Member',
  tenant_id: 'tenant-1',
  onboarding_completed: true,
};

const MOCK_TOKEN_RESPONSE: TokenResponse = {
  access_token: 'access-abc',
  refresh_token: 'refresh-xyz',
  expires_in: 3600,
  user: MOCK_USER,
};

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();

    mockRouter = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: mockRouter },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should have null currentUser when no stored user', () => {
      expect(service.currentUser()).toBeNull();
    });

    it('should have isAuthenticated false when no stored user', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should load user from localStorage on construction', () => {
      localStorage.setItem('taskflow_user', JSON.stringify(MOCK_USER));

      // Re-create service to trigger constructor
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          AuthService,
          { provide: Router, useValue: mockRouter },
        ],
      });
      const freshService = TestBed.inject(AuthService);

      expect(freshService.currentUser()).toEqual(MOCK_USER);
      expect(freshService.isAuthenticated()).toBe(true);
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      localStorage.setItem('taskflow_user', 'not-valid-json');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          AuthService,
          { provide: Router, useValue: mockRouter },
        ],
      });
      const freshService = TestBed.inject(AuthService);

      expect(freshService.currentUser()).toBeNull();
    });
  });

  describe('signIn()', () => {
    it('should POST to /api/auth/sign-in', () => {
      service.signIn('test@example.com', 'password123').subscribe();

      const req = httpMock.expectOne('/api/auth/sign-in');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 'test@example.com',
        password: 'password123',
      });
      req.flush(MOCK_TOKEN_RESPONSE);
    });

    it('should store user and update currentUser on success', () => {
      service.signIn('test@example.com', 'password123').subscribe();

      const req = httpMock.expectOne('/api/auth/sign-in');
      req.flush(MOCK_TOKEN_RESPONSE);

      expect(service.currentUser()).toEqual(MOCK_USER);
      expect(service.isAuthenticated()).toBe(true);
      expect(localStorage.getItem('taskflow_user')).toBe(
        JSON.stringify(MOCK_USER),
      );
    });

    it('should propagate error on failure', () => {
      let error: any;
      service.signIn('bad@email.com', 'wrong').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/auth/sign-in');
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(401);
    });
  });

  describe('signOut()', () => {
    it('should clear user from signal and localStorage', () => {
      localStorage.setItem('taskflow_user', JSON.stringify(MOCK_USER));

      service.signOut();

      // POST to /api/auth/logout
      const req = httpMock.expectOne('/api/auth/logout');
      req.flush({});

      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('taskflow_user')).toBeNull();
    });

    it('should navigate to /auth/sign-in', () => {
      service.signOut();

      const req = httpMock.expectOne('/api/auth/logout');
      req.flush({});

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth/sign-in'], {
        queryParams: {},
      });
    });

    it('should navigate with session_expired reason when expired', () => {
      service.signOut('expired');

      const req = httpMock.expectOne('/api/auth/logout');
      req.flush({});

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth/sign-in'], {
        queryParams: { reason: 'session_expired' },
      });
    });
  });

  describe('getAccessToken()', () => {
    it('should return null (cookie-based auth)', () => {
      expect(service.getAccessToken()).toBeNull();
    });
  });

  describe('getRefreshToken()', () => {
    it('should return null (cookie-based auth)', () => {
      expect(service.getRefreshToken()).toBeNull();
    });
  });

  describe('refresh()', () => {
    it('should POST to /api/auth/refresh', () => {
      service.refresh().subscribe();

      const req = httpMock.expectOne('/api/auth/refresh');
      expect(req.request.method).toBe('POST');
      req.flush(MOCK_TOKEN_RESPONSE);
    });
  });
});
