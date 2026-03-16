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
  phone_number: null,
  avatar_url: null,
  job_title: null,
  department: null,
  bio: null,
  role: 'Member',
  tenant_id: 'tenant-1',
  onboarding_completed: true,
  last_login_at: null,
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
      providers: [AuthService, { provide: Router, useValue: mockRouter }],
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

    it('should start with null currentUser even when session flag is set', () => {
      localStorage.setItem('taskflow_auth', '1');

      // Re-create service to trigger constructor
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [AuthService, { provide: Router, useValue: mockRouter }],
      });
      const freshService = TestBed.inject(AuthService);

      // User is null until validateSession fetches from /auth/me
      expect(freshService.currentUser()).toBeNull();
      expect(freshService.isAuthenticated()).toBe(false);
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
      expect(localStorage.getItem('taskflow_auth')).toBe('1');
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
      localStorage.setItem('taskflow_auth', '1');

      service.signOut();

      // POST to /api/auth/logout
      const req = httpMock.expectOne('/api/auth/logout');
      req.flush({});

      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('taskflow_auth')).toBeNull();
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

  describe('refresh()', () => {
    it('should POST to /api/auth/refresh', () => {
      service.refresh().subscribe();

      const req = httpMock.expectOne('/api/auth/refresh');
      expect(req.request.method).toBe('POST');
      req.flush(MOCK_TOKEN_RESPONSE);
    });

    it('should update user on successful refresh', () => {
      service.refresh().subscribe();

      const req = httpMock.expectOne('/api/auth/refresh');
      req.flush(MOCK_TOKEN_RESPONSE);

      expect(service.currentUser()).toEqual(MOCK_USER);
    });

    it('should propagate error on failed refresh', () => {
      let error: any;
      service.refresh().subscribe({ error: (e) => (error = e) });

      const req = httpMock.expectOne('/api/auth/refresh');
      req.flush('Failed', { status: 401, statusText: 'Unauthorized' });

      expect(error).toBeTruthy();
    });
  });

  describe('signUp()', () => {
    it('should POST to /api/auth/sign-up', () => {
      service
        .signUp({
          name: 'New User',
          email: 'new@example.com',
          password: 'pass123',
        })
        .subscribe();

      const req = httpMock.expectOne('/api/auth/sign-up');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'New User',
        email: 'new@example.com',
        password: 'pass123',
      });
      req.flush(MOCK_TOKEN_RESPONSE);
    });

    it('should store user on success', () => {
      service
        .signUp({
          name: 'New User',
          email: 'new@example.com',
          password: 'pass123',
        })
        .subscribe();

      const req = httpMock.expectOne('/api/auth/sign-up');
      req.flush(MOCK_TOKEN_RESPONSE);

      expect(service.currentUser()).toEqual(MOCK_USER);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should propagate error on failure', () => {
      let error: any;
      service
        .signUp({ name: 'New', email: 'dup@example.com', password: 'pass' })
        .subscribe({ error: (e) => (error = e) });

      const req = httpMock.expectOne('/api/auth/sign-up');
      req.flush('Conflict', { status: 409, statusText: 'Conflict' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(409);
    });
  });

  describe('forgotPassword()', () => {
    it('should POST to /api/auth/forgot-password', () => {
      service.forgotPassword('test@example.com').subscribe();

      const req = httpMock.expectOne('/api/auth/forgot-password');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'test@example.com' });
      req.flush({ message: 'Reset link sent' });
    });

    it('should return message on success', () => {
      let result: any;
      service.forgotPassword('test@example.com').subscribe((r) => (result = r));

      const req = httpMock.expectOne('/api/auth/forgot-password');
      req.flush({ message: 'Reset link sent' });

      expect(result).toEqual({ message: 'Reset link sent' });
    });
  });

  describe('resetPassword()', () => {
    it('should POST to /api/auth/reset-password', () => {
      service.resetPassword('token-123', 'newpass').subscribe();

      const req = httpMock.expectOne('/api/auth/reset-password');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        token: 'token-123',
        new_password: 'newpass',
      });
      req.flush({ message: 'Password reset' });
    });
  });

  describe('updateProfile()', () => {
    it('should PATCH to /api/auth/me', () => {
      service.updateProfile({ name: 'Updated Name' }).subscribe();

      const req = httpMock.expectOne('/api/auth/me');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ name: 'Updated Name' });
      req.flush(MOCK_USER);
    });

    it('should update currentUser on success', () => {
      const updatedUser = { ...MOCK_USER, name: 'Updated Name' };
      service.updateProfile({ name: 'Updated Name' }).subscribe();

      const req = httpMock.expectOne('/api/auth/me');
      req.flush(updatedUser);

      expect(service.currentUser()).toEqual(updatedUser);
    });

    it('should update session flag in localStorage on success', () => {
      service.updateProfile({ name: 'Updated Name' }).subscribe();

      const req = httpMock.expectOne('/api/auth/me');
      req.flush({ ...MOCK_USER, name: 'Updated Name' });

      expect(localStorage.getItem('taskflow_auth')).toBe('1');
    });
  });

  describe('deleteAccount()', () => {
    it('should DELETE to /api/auth/me with password', () => {
      service.deleteAccount('mypassword').subscribe();

      const req = httpMock.expectOne('/api/auth/me');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({ password: 'mypassword' });
      req.flush({ message: 'Account deleted' });
    });
  });

  describe('changePassword()', () => {
    it('should POST to /api/auth/change-password', () => {
      service
        .changePassword({
          current_password: 'oldpass',
          new_password: 'newpass',
        })
        .subscribe();

      const req = httpMock.expectOne('/api/auth/change-password');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        current_password: 'oldpass',
        new_password: 'newpass',
      });
      req.flush({ message: 'Password changed' });
    });
  });

  describe('isRefreshInProgress()', () => {
    it('should return false initially', () => {
      expect(service.isRefreshInProgress()).toBe(false);
    });
  });

  describe('validateSession()', () => {
    it('should return false when no stored user', () => {
      let result: boolean | undefined;
      service.validateSession().subscribe((r) => (result = r));

      expect(result).toBe(false);
    });

    it('should call /api/auth/me when user is stored', () => {
      localStorage.setItem('taskflow_auth', '1');

      // Re-create to pick up stored user
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [AuthService, { provide: Router, useValue: mockRouter }],
      });
      const freshService = TestBed.inject(AuthService);
      const freshHttpMock = TestBed.inject(HttpTestingController);

      freshService.validateSession().subscribe();

      const req = freshHttpMock.expectOne('/api/auth/me');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_USER);
      freshHttpMock.verify();
    });

    it('should update user on successful /me call', () => {
      localStorage.setItem('taskflow_auth', '1');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [AuthService, { provide: Router, useValue: mockRouter }],
      });
      const freshService = TestBed.inject(AuthService);
      const freshHttpMock = TestBed.inject(HttpTestingController);

      let result: boolean | undefined;
      freshService.validateSession().subscribe((r) => (result = r));

      const req = freshHttpMock.expectOne('/api/auth/me');
      const updatedUser = { ...MOCK_USER, name: 'Refreshed' };
      req.flush(updatedUser);

      expect(result).toBe(true);
      expect(freshService.currentUser()).toEqual(updatedUser);
      freshHttpMock.verify();
    });

    it('should try refresh when /me fails, and succeed', () => {
      localStorage.setItem('taskflow_auth', '1');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [AuthService, { provide: Router, useValue: mockRouter }],
      });
      const freshService = TestBed.inject(AuthService);
      const freshHttpMock = TestBed.inject(HttpTestingController);

      let result: boolean | undefined;
      freshService.validateSession().subscribe((r) => (result = r));

      // /me fails
      const meReq = freshHttpMock.expectOne('/api/auth/me');
      meReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      // refresh succeeds
      const refreshReq = freshHttpMock.expectOne('/api/auth/refresh');
      refreshReq.flush(MOCK_TOKEN_RESPONSE);

      expect(result).toBe(true);
      freshHttpMock.verify();
    });

    it('should clear state when both /me and refresh fail', () => {
      localStorage.setItem('taskflow_auth', '1');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [AuthService, { provide: Router, useValue: mockRouter }],
      });
      const freshService = TestBed.inject(AuthService);
      const freshHttpMock = TestBed.inject(HttpTestingController);

      let result: boolean | undefined;
      freshService.validateSession().subscribe((r) => (result = r));

      // /me fails
      const meReq = freshHttpMock.expectOne('/api/auth/me');
      meReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      // refresh also fails
      const refreshReq = freshHttpMock.expectOne('/api/auth/refresh');
      refreshReq.flush('Unauthorized', {
        status: 401,
        statusText: 'Unauthorized',
      });

      expect(result).toBe(false);
      expect(freshService.currentUser()).toBeNull();
      freshHttpMock.verify();
    });
  });
});
