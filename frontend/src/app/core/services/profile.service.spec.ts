import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  ProfileService,
  UserProfile,
  UpdateProfileRequest,
  NotificationPreference,
  UpdatePreferenceRequest,
  DEFAULT_PREFERENCES,
} from './profile.service';

const MOCK_PROFILE: UserProfile = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  phone_number: null,
  avatar_url: null,
  role: 'Member',
  tenant_id: 'tenant-1',
  onboarding_completed: true,
};

const MOCK_PREFERENCE: NotificationPreference = {
  id: 'pref-1',
  user_id: 'user-1',
  event_type: 'task_assigned',
  in_app: true,
  email: true,
  slack: false,
  whatsapp: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProfileService],
    });
    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initial state', () => {
    it('should have null profile', () => {
      expect(service.profile()).toBeNull();
    });

    it('should have empty preferences', () => {
      expect(service.preferences()).toEqual([]);
    });

    it('should have isLoading false', () => {
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('getProfile()', () => {
    it('should GET /api/auth/me and update profile signal', () => {
      service.getProfile().subscribe((result) => {
        expect(result).toEqual(MOCK_PROFILE);
      });

      const req = httpMock.expectOne('/api/auth/me');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_PROFILE);

      expect(service.profile()).toEqual(MOCK_PROFILE);
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('updateProfile()', () => {
    it('should PATCH /api/auth/me with data and update profile signal', () => {
      const updateReq: UpdateProfileRequest = { name: 'Updated Name' };

      const updatedProfile = { ...MOCK_PROFILE, name: 'Updated Name' };
      service.updateProfile(updateReq).subscribe((result) => {
        expect(result).toEqual(updatedProfile);
      });

      const req = httpMock.expectOne('/api/auth/me');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateReq);
      req.flush(updatedProfile);

      expect(service.profile()).toEqual(updatedProfile);
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('getNotificationPreferences()', () => {
    it('should GET /api/notification-preferences and update preferences signal', () => {
      const prefs = [MOCK_PREFERENCE];

      service.getNotificationPreferences().subscribe((result) => {
        expect(result).toEqual(prefs);
      });

      const req = httpMock.expectOne('/api/notification-preferences');
      expect(req.request.method).toBe('GET');
      req.flush({ preferences: prefs });

      expect(service.preferences()).toEqual(prefs);
    });
  });

  describe('updateNotificationPreference()', () => {
    it('should PUT /api/notification-preferences and update preferences signal', () => {
      const updateReq: UpdatePreferenceRequest = {
        eventType: 'task_assigned',
        inApp: true,
        email: false,
        slack: true,
        whatsapp: false,
      };

      const updatedPref: NotificationPreference = {
        ...MOCK_PREFERENCE,
        email: false,
        slack: true,
      };

      // Pre-populate preferences
      service.getNotificationPreferences().subscribe();
      const prefsReq = httpMock.expectOne('/api/notification-preferences');
      prefsReq.flush({ preferences: [MOCK_PREFERENCE] });

      service.updateNotificationPreference(updateReq).subscribe((result) => {
        expect(result).toEqual(updatedPref);
      });

      const req = httpMock.expectOne('/api/notification-preferences');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateReq);
      req.flush(updatedPref);

      expect(service.preferences()[0].slack).toBe(true);
      expect(service.preferences()[0].email).toBe(false);
    });

    it('should add new preference if not found in existing list', () => {
      const newPref: NotificationPreference = {
        ...MOCK_PREFERENCE,
        id: 'pref-2',
        event_type: 'task_completed',
      };

      const updateReq: UpdatePreferenceRequest = {
        eventType: 'task_completed',
        inApp: true,
        email: false,
        slack: false,
        whatsapp: false,
      };

      service.updateNotificationPreference(updateReq).subscribe();

      const req = httpMock.expectOne('/api/notification-preferences');
      req.flush(newPref);

      expect(service.preferences()).toContainEqual(newPref);
    });
  });

  describe('resetNotificationPreferences()', () => {
    it('should DELETE /api/notification-preferences and clear preferences signal', () => {
      // Pre-populate
      service.getNotificationPreferences().subscribe();
      const prefsReq = httpMock.expectOne('/api/notification-preferences');
      prefsReq.flush({ preferences: [MOCK_PREFERENCE] });
      expect(service.preferences().length).toBe(1);

      service.resetNotificationPreferences().subscribe();

      const req = httpMock.expectOne('/api/notification-preferences');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(service.preferences()).toEqual([]);
    });
  });

  describe('getEffectivePreference()', () => {
    it('should return user preference when it exists', () => {
      service.getNotificationPreferences().subscribe();
      const prefsReq = httpMock.expectOne('/api/notification-preferences');
      prefsReq.flush({ preferences: [MOCK_PREFERENCE] });

      const result = service.getEffectivePreference('task_assigned');
      expect(result.event_type).toBe('task_assigned');
      expect(result.in_app).toBe(true);
      expect(result.email).toBe(true);
    });

    it('should return default preference when user preference does not exist', () => {
      const result = service.getEffectivePreference('task_due_soon');
      expect(result).toEqual(DEFAULT_PREFERENCES['task_due_soon']);
    });

    it('should return fallback for unknown event type', () => {
      const result = service.getEffectivePreference('unknown_event');
      expect(result.event_type).toBe('unknown_event');
      expect(result.in_app).toBe(true);
      expect(result.email).toBe(true);
      expect(result.slack).toBe(false);
      expect(result.whatsapp).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on getProfile', () => {
      let error: any;
      service.getProfile().subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/auth/me');
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(401);
    });
  });
});
