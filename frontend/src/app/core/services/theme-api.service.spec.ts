import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ThemeApiService } from './theme-api.service';
import { Theme, ThemeListResponse } from '../../shared/types/theme.types';

const MOCK_THEME: Theme = {
  slug: 'ocean-breeze',
  name: 'Ocean Breeze',
  category: 'clean',
  description: 'A calm blue theme',
  is_dark: false,
  sort_order: 1,
  is_active: true,
  colors: {} as Theme['colors'],
  personality: {
    sidebar_style: 'light',
    card_style: 'flat',
    border_radius: 'medium',
    background_pattern: 'none',
  },
  preview: {
    sidebar_color: '#ffffff',
    background_color: '#f8fafc',
    card_color: '#ffffff',
    primary_color: '#3b82f6',
    sidebar_is_dark: false,
  },
  primeng_ramp: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('ThemeApiService', () => {
  let service: ThemeApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ThemeApiService],
    });
    service = TestBed.inject(ThemeApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('listThemes()', () => {
    it('should GET /api/themes without params when isDark is undefined', () => {
      const response: ThemeListResponse = { themes: [MOCK_THEME] };

      service.listThemes().subscribe((result) => {
        expect(result).toEqual(response);
      });

      const req = httpMock.expectOne('/api/themes');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush(response);
    });

    it('should include is_dark param when true', () => {
      service.listThemes(true).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/themes');
      expect(req.request.params.get('is_dark')).toBe('true');
      req.flush({ themes: [] });
    });

    it('should include is_dark param when false', () => {
      service.listThemes(false).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/themes');
      expect(req.request.params.get('is_dark')).toBe('false');
      req.flush({ themes: [] });
    });
  });

  describe('getTheme()', () => {
    it('should GET /api/themes/:slug', () => {
      service.getTheme('ocean-breeze').subscribe((result) => {
        expect(result).toEqual(MOCK_THEME);
      });

      const req = httpMock.expectOne('/api/themes/ocean-breeze');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_THEME);
    });
  });
});
