import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { SecuritySectionComponent } from './security-section.component';
import { AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';

describe('SecuritySectionComponent', () => {
  let component: SecuritySectionComponent;
  let fixture: ComponentFixture<SecuritySectionComponent>;
  let mockAuthService: any;
  let mockSessionService: any;

  beforeEach(async () => {
    mockAuthService = {
      changePassword: vi.fn().mockReturnValue(of({})),
    };

    mockSessionService = {
      listSessions: vi.fn().mockReturnValue(
        of([
          {
            id: 's-1',
            user_agent: 'Chrome on Windows',
            ip_address: '1.2.3.4',
            last_active_at: new Date().toISOString(),
            is_current: true,
            device_name: null,
          },
          {
            id: 's-2',
            user_agent: 'Firefox on Linux',
            ip_address: '5.6.7.8',
            last_active_at: new Date(Date.now() - 3600000).toISOString(),
            is_current: false,
            device_name: null,
          },
        ]),
      ),
      revokeSession: vi.fn().mockReturnValue(of(void 0)),
      revokeAllOtherSessions: vi.fn().mockReturnValue(of({ revoked_count: 1 })),
    };

    await TestBed.configureTestingModule({
      imports: [SecuritySectionComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: SessionService, useValue: mockSessionService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SecuritySectionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load sessions on init', () => {
    component.ngOnInit();
    expect(mockSessionService.listSessions).toHaveBeenCalled();
    expect(component.sessions().length).toBe(2);
    expect(component.sessions()[0].is_current).toBe(true);
  });

  it('should sort sessions with current first', () => {
    mockSessionService.listSessions.mockReturnValue(
      of([
        {
          id: 's-2',
          user_agent: 'Firefox',
          ip_address: '5.6.7.8',
          last_active_at: new Date().toISOString(),
          is_current: false,
          device_name: null,
        },
        {
          id: 's-1',
          user_agent: 'Chrome',
          ip_address: '1.2.3.4',
          last_active_at: new Date(Date.now() - 1000).toISOString(),
          is_current: true,
          device_name: null,
        },
      ]),
    );
    component.ngOnInit();
    expect(component.sessions()[0].is_current).toBe(true);
    expect(component.sessions()[0].id).toBe('s-1');
  });

  it('should handle session load error', () => {
    mockSessionService.listSessions.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.ngOnInit();
    expect(component.sessionsLoading()).toBe(false);
  });

  it('should change password successfully', () => {
    component.currentPassword = 'old';
    component.newPassword = 'newpass123';
    component.confirmPassword = 'newpass123';
    component.changePassword();
    expect(mockAuthService.changePassword).toHaveBeenCalledWith({
      current_password: 'old',
      new_password: 'newpass123',
    });
    expect(component.currentPassword).toBe('');
    expect(component.newPassword).toBe('');
    expect(component.confirmPassword).toBe('');
    expect(component.passwordLoading()).toBe(false);
  });

  it('should reload sessions after password change', () => {
    component.currentPassword = 'old';
    component.newPassword = 'newpass123';
    component.confirmPassword = 'newpass123';
    mockSessionService.listSessions.mockClear();
    component.changePassword();
    expect(mockSessionService.listSessions).toHaveBeenCalled();
  });

  it('should not change password when they do not match', () => {
    component.currentPassword = 'old';
    component.newPassword = 'newpass123';
    component.confirmPassword = 'different';
    component.changePassword();
    expect(mockAuthService.changePassword).not.toHaveBeenCalled();
  });

  it('should handle password change error', () => {
    mockAuthService.changePassword.mockReturnValue(
      throwError(() => ({ error: { message: 'Wrong' } })),
    );
    component.currentPassword = 'old';
    component.newPassword = 'newpass123';
    component.confirmPassword = 'newpass123';
    component.changePassword();
    expect(component.passwordLoading()).toBe(false);
  });

  it('should revoke a session', () => {
    component.revokeSession('s-2');
    expect(mockSessionService.revokeSession).toHaveBeenCalledWith('s-2');
    expect(component.revokingSessionId()).toBe(null);
  });

  it('should reload sessions after revoke', () => {
    mockSessionService.listSessions.mockClear();
    component.revokeSession('s-2');
    expect(mockSessionService.listSessions).toHaveBeenCalled();
  });

  it('should handle revoke session error', () => {
    mockSessionService.revokeSession.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.revokeSession('s-2');
    expect(component.revokingSessionId()).toBe(null);
  });

  it('should revoke all other sessions', () => {
    component.revokeAllOther();
    expect(mockSessionService.revokeAllOtherSessions).toHaveBeenCalled();
    expect(component.revokeAllLoading()).toBe(false);
  });

  it('should handle revoke all error', () => {
    mockSessionService.revokeAllOtherSessions.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.revokeAllOther();
    expect(component.revokeAllLoading()).toBe(false);
  });

  it('should parse user agent correctly', () => {
    expect(component.parseUserAgent('Mozilla/5.0 Chrome Windows')).toContain(
      'Chrome',
    );
    expect(component.parseUserAgent('Mozilla/5.0 Chrome Windows')).toContain(
      'Windows',
    );
    expect(component.parseUserAgent('Mozilla/5.0 Firefox Linux')).toContain(
      'Firefox',
    );
    expect(component.parseUserAgent('Mozilla/5.0 Firefox Linux')).toContain(
      'Linux',
    );
    expect(component.parseUserAgent('Mozilla/5.0 Safari Mac OS')).toContain(
      'Safari',
    );
    expect(component.parseUserAgent('Mozilla/5.0 Safari Mac OS')).toContain(
      'macOS',
    );
    expect(component.parseUserAgent('Mozilla/5.0 Edg Windows')).toContain(
      'Edge',
    );
    expect(component.parseUserAgent('Mozilla/5.0 iPhone Safari')).toContain(
      'iOS',
    );
    expect(component.parseUserAgent('Mozilla/5.0 Android Chrome')).toContain(
      'Android',
    );
    expect(component.parseUserAgent('')).toBe('Unknown Device');
  });

  it('should get correct device icon', () => {
    expect(component.getDeviceIcon('mobile')).toBe('pi pi-mobile');
    expect(component.getDeviceIcon('iphone')).toBe('pi pi-mobile');
    expect(component.getDeviceIcon('android')).toBe('pi pi-mobile');
    expect(component.getDeviceIcon('tablet')).toBe('pi pi-tablet');
    expect(component.getDeviceIcon('ipad')).toBe('pi pi-tablet');
    expect(component.getDeviceIcon('desktop Chrome')).toBe('pi pi-desktop');
  });

  it('should format relative time', () => {
    expect(component.formatRelativeTime(new Date().toISOString())).toBe(
      'just now',
    );
    expect(
      component.formatRelativeTime(
        new Date(Date.now() - 5 * 60000).toISOString(),
      ),
    ).toBe('5m ago');
    expect(
      component.formatRelativeTime(
        new Date(Date.now() - 3 * 3600000).toISOString(),
      ),
    ).toBe('3h ago');
    expect(
      component.formatRelativeTime(
        new Date(Date.now() - 5 * 86400000).toISOString(),
      ),
    ).toBe('5d ago');
    // More than 30 days should return a locale date string
    const oldDate = new Date(Date.now() - 35 * 86400000).toISOString();
    const result = component.formatRelativeTime(oldDate);
    expect(result).not.toContain('ago');
  });

  it('should toggle password visibility signals', () => {
    expect(component.hideCurrentPassword()).toBe(true);
    component.hideCurrentPassword.set(false);
    expect(component.hideCurrentPassword()).toBe(false);

    expect(component.hideNewPassword()).toBe(true);
    component.hideNewPassword.set(false);
    expect(component.hideNewPassword()).toBe(false);

    expect(component.hideConfirmPassword()).toBe(true);
    component.hideConfirmPassword.set(false);
    expect(component.hideConfirmPassword()).toBe(false);
  });
});
