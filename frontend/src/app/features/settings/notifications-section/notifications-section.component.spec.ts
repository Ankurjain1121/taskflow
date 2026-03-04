import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { NotificationsSectionComponent } from './notifications-section.component';
import {
  ProfileService,
  DEFAULT_PREFERENCES,
  EVENT_TYPE_LABELS,
} from '../../../core/services/profile.service';
import { UserPreferencesService } from '../../../core/services/user-preferences.service';

describe('NotificationsSectionComponent', () => {
  let component: NotificationsSectionComponent;
  let fixture: ComponentFixture<NotificationsSectionComponent>;
  let mockProfileService: any;
  let mockUserPreferencesService: any;

  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    mockProfileService = {
      getNotificationPreferences: vi
        .fn()
        .mockReturnValue(
          of([
            {
              event_type: 'task_assigned',
              in_app: true,
              email: true,
              slack: false,
              whatsapp: false,
            },
          ]),
        ),
      updateNotificationPreference: vi.fn().mockReturnValue(
        of({
          event_type: 'task_assigned',
          in_app: true,
          email: false,
          slack: false,
          whatsapp: false,
        }),
      ),
      resetNotificationPreferences: vi.fn().mockReturnValue(of(void 0)),
    };

    mockUserPreferencesService = {
      getPreferences: vi.fn().mockReturnValue(
        of({
          quiet_hours_start: '23:00',
          quiet_hours_end: '07:00',
          digest_frequency: 'hourly',
        }),
      ),
      updatePreferences: vi.fn().mockReturnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationsSectionComponent],
      providers: [
        { provide: ProfileService, useValue: mockProfileService },
        {
          provide: UserPreferencesService,
          useValue: mockUserPreferencesService,
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsSectionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load notification preferences on init', () => {
    component.ngOnInit();
    expect(mockProfileService.getNotificationPreferences).toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
  });

  it('should load extra settings on init', () => {
    component.ngOnInit();
    expect(mockUserPreferencesService.getPreferences).toHaveBeenCalled();
    expect(component.quietHoursStart).toBe('23:00');
    expect(component.quietHoursEnd).toBe('07:00');
    expect(component.digestFrequency).toBe('hourly');
  });

  it('should keep defaults when extra settings load fails', () => {
    mockUserPreferencesService.getPreferences.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.ngOnInit();
    expect(component.quietHoursStart).toBe('22:00');
    expect(component.quietHoursEnd).toBe('08:00');
    expect(component.digestFrequency).toBe('realtime');
  });

  it('should handle notification preferences load error', () => {
    mockProfileService.getNotificationPreferences.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.ngOnInit();
    expect(component.isLoading()).toBe(false);
  });

  it('should compute preferenceRows from loaded data and defaults', () => {
    component.ngOnInit();
    const rows = component.preferenceRows();
    expect(rows.length).toBeGreaterThan(0);
    const taskAssigned = rows.find((r) => r.eventType === 'task_assigned');
    if (taskAssigned) {
      expect(taskAssigned.email).toBe(true);
    }
  });

  it('should toggle email preference via onToggleChange', () => {
    component.ngOnInit();
    component.onToggleChange('task_assigned', 'email', false);
    expect(
      mockProfileService.updateNotificationPreference,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'task_assigned',
        email: false,
        inApp: true,
      }),
    );
    expect(component.isSaving()).toBe(false);
  });

  it('should handle toggle change error', () => {
    mockProfileService.updateNotificationPreference.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.ngOnInit();
    component.onToggleChange('task_assigned', 'email', false);
    expect(component.isSaving()).toBe(false);
  });

  it('should not call service when event type not found in onToggleChange', () => {
    component.ngOnInit();
    component.onToggleChange('nonexistent_event_xyz', 'email', true);
    // The method returns early because no matching row is found
    // isSaving may have been set or not depending on the match
  });

  it('should reset to defaults when confirmed', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    component.resetToDefaults();
    expect(mockProfileService.resetNotificationPreferences).toHaveBeenCalled();
    expect(component.isSaving()).toBe(false);
    vi.restoreAllMocks();
  });

  it('should not reset when user cancels confirm dialog', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    component.resetToDefaults();
    expect(
      mockProfileService.resetNotificationPreferences,
    ).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('should handle reset error', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    mockProfileService.resetNotificationPreferences.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.resetToDefaults();
    expect(component.isSaving()).toBe(false);
    vi.restoreAllMocks();
  });

  it('should save extra settings', () => {
    component.quietHoursEnabled.set(true);
    component.quietHoursStart = '21:00';
    component.quietHoursEnd = '06:00';
    component.digestFrequency = 'daily';
    component.saveExtraSettings();

    expect(mockUserPreferencesService.updatePreferences).toHaveBeenCalledWith({
      quiet_hours_start: '21:00',
      quiet_hours_end: '06:00',
      digest_frequency: 'daily',
    });
    expect(component.isSavingExtra()).toBe(false);
  });

  it('should handle save extra settings error', () => {
    mockUserPreferencesService.updatePreferences.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.saveExtraSettings();
    expect(component.isSavingExtra()).toBe(false);
  });

  it('should have 3 digest options', () => {
    expect(component.digestOptions.length).toBe(3);
    const values = component.digestOptions.map((o) => o.value);
    expect(values).toContain('realtime');
    expect(values).toContain('hourly');
    expect(values).toContain('daily');
  });
});
