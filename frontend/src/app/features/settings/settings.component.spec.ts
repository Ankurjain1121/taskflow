import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { SettingsComponent } from './settings.component';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { MessageService } from 'primeng/api';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let mockAuthService: any;

  beforeEach(async () => {
    // Mock window.matchMedia for ThemeService
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

    mockAuthService = {
      currentUser: signal({
        id: 'u-1',
        name: 'Alice',
        email: 'alice@test.com',
        avatar_url: 'https://example.com/avatar.jpg',
        role: 'Member' as const,
        tenant_id: 't-1',
        onboarding_completed: true,
      }),
      updateProfile: vi.fn().mockReturnValue(of({})),
      changePassword: vi.fn().mockReturnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should populate profile data from auth service on init', () => {
    component.ngOnInit();
    expect(component.profileData.name).toBe('Alice');
    expect(component.profileData.email).toBe('alice@test.com');
    expect(component.profileData.avatar_url).toBe(
      'https://example.com/avatar.jpg',
    );
  });

  it('should call updateProfile on save', () => {
    component.ngOnInit();
    component.profileData.name = 'Alice Updated';
    component.updateProfile();
    expect(mockAuthService.updateProfile).toHaveBeenCalledWith({
      name: 'Alice Updated',
      avatar_url: 'https://example.com/avatar.jpg',
    });
  });

  it('should set profileLoading during update', () => {
    component.updateProfile();
    expect(component.profileLoading()).toBe(false); // resolved immediately
  });

  it('should handle updateProfile error', () => {
    mockAuthService.updateProfile.mockReturnValue(
      throwError(() => ({
        error: { message: 'Profile update failed' },
      })),
    );
    component.updateProfile();
    expect(component.profileLoading()).toBe(false);
  });

  it('should call changePassword on auth service', () => {
    component.passwordData = {
      current_password: 'old123',
      new_password: 'newpass123',
      confirm_password: 'newpass123',
    };
    component.changePassword();
    expect(mockAuthService.changePassword).toHaveBeenCalledWith({
      current_password: 'old123',
      new_password: 'newpass123',
    });
  });

  it('should not call changePassword if passwords do not match', () => {
    component.passwordData = {
      current_password: 'old123',
      new_password: 'newpass123',
      confirm_password: 'different',
    };
    component.changePassword();
    expect(mockAuthService.changePassword).not.toHaveBeenCalled();
  });

  it('should reset password data after successful change', () => {
    component.passwordData = {
      current_password: 'old123',
      new_password: 'newpass123',
      confirm_password: 'newpass123',
    };
    component.changePassword();
    expect(component.passwordData.current_password).toBe('');
    expect(component.passwordData.new_password).toBe('');
  });

  it('should handle changePassword error', () => {
    mockAuthService.changePassword.mockReturnValue(
      throwError(() => ({
        error: { message: 'Wrong password' },
      })),
    );
    component.passwordData = {
      current_password: 'wrong',
      new_password: 'newpass123',
      confirm_password: 'newpass123',
    };
    component.changePassword();
    expect(component.passwordLoading()).toBe(false);
  });

  it('should toggle password visibility', () => {
    expect(component.hideCurrentPassword()).toBe(true);
    component.hideCurrentPassword.set(false);
    expect(component.hideCurrentPassword()).toBe(false);
  });
});
