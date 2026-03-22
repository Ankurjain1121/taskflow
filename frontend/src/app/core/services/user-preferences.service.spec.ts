import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  UserPreferencesService,
  UserPreferences,
  ThemePreferenceUpdate,
} from './user-preferences.service';

const MOCK_PREFS: UserPreferences = {
  timezone: 'America/New_York',
  date_format: 'MM/DD/YYYY',
  default_project_view: 'kanban',
  sidebar_density: 'comfortable',
  locale: 'en-US',
  language: 'en',
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  digest_frequency: 'daily',
  accent_color: 'warm-earth',
  dark_theme: 'warm-earth-dark',
  color_mode: 'system',
};

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserPreferencesService],
    });
    service = TestBed.inject(UserPreferencesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getPreferences()', () => {
    it('should GET /api/users/me/preferences', () => {
      service.getPreferences().subscribe((result) => {
        expect(result).toEqual(MOCK_PREFS);
      });

      const req = httpMock.expectOne('/api/users/me/preferences');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_PREFS);
    });
  });

  describe('updatePreferences()', () => {
    it('should PUT /api/users/me/preferences with partial prefs', () => {
      const update: Partial<UserPreferences> = {
        timezone: 'UTC',
        language: 'fr',
      };

      service.updatePreferences(update).subscribe((result) => {
        expect(result).toEqual(MOCK_PREFS);
      });

      const req = httpMock.expectOne('/api/users/me/preferences');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(update);
      req.flush(MOCK_PREFS);
    });
  });

  describe('updateThemePreferences()', () => {
    it('should PUT /api/users/me/preferences with theme prefs', () => {
      const themeUpdate: ThemePreferenceUpdate = {
        accent_color: 'sea-foam',
        dark_theme: 'purple-night',
      };

      service.updateThemePreferences(themeUpdate).subscribe((result) => {
        expect(result).toEqual(MOCK_PREFS);
      });

      const req = httpMock.expectOne('/api/users/me/preferences');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(themeUpdate);
      req.flush(MOCK_PREFS);
    });
  });
});
