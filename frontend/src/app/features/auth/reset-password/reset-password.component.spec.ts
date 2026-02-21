import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;

  const mockAuthService = {
    resetPassword: vi.fn(),
  };

  function createComponent(token: string | null) {
    TestBed.resetTestingModule();

    const mockRoute = {
      snapshot: {
        queryParamMap: convertToParamMap(token ? { token } : {}),
      },
    };

    TestBed.configureTestingModule({
      imports: [
        ResetPasswordComponent,
        HttpClientTestingModule,
        RouterTestingModule.withRoutes([]),
      ],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    createComponent('valid-token-123');
    component.ngOnInit();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('token handling', () => {
    it('should extract token from query params on init', () => {
      expect(component.token).toBe('valid-token-123');
    });

    it('should have null token when none in query params', () => {
      createComponent(null);
      component.ngOnInit();
      expect(component.token).toBeNull();
    });
  });

  describe('form initialization', () => {
    it('should have newPassword and confirmPassword controls', () => {
      expect(component.resetForm.get('newPassword')).toBeTruthy();
      expect(component.resetForm.get('confirmPassword')).toBeTruthy();
    });

    it('should be invalid when empty', () => {
      expect(component.resetForm.valid).toBe(false);
    });
  });

  describe('form validation', () => {
    it('should require newPassword of minimum 8 characters', () => {
      const pw = component.resetForm.get('newPassword');
      pw?.setValue('short');
      expect(pw?.hasError('minlength')).toBe(true);

      pw?.setValue('longenough');
      expect(pw?.hasError('minlength')).toBe(false);
    });

    it('should require confirmPassword', () => {
      const confirm = component.resetForm.get('confirmPassword');
      confirm?.setValue('');
      expect(confirm?.hasError('required')).toBe(true);
    });
  });

  describe('password match validation', () => {
    it('should set passwordMismatch when passwords differ', () => {
      component.resetForm.get('newPassword')?.setValue('password123');
      component.resetForm.get('confirmPassword')?.setValue('different');
      component.resetForm.updateValueAndValidity();

      expect(
        component.resetForm.get('confirmPassword')?.hasError('passwordMismatch'),
      ).toBe(true);
    });

    it('should clear passwordMismatch when passwords match', () => {
      component.resetForm.get('newPassword')?.setValue('password123');
      component.resetForm.get('confirmPassword')?.setValue('password123');
      component.resetForm.updateValueAndValidity();

      expect(
        component.resetForm.get('confirmPassword')?.hasError('passwordMismatch'),
      ).toBe(false);
    });
  });

  describe('onSubmit', () => {
    it('should not call service when form is invalid', () => {
      component.onSubmit();
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('should not call service when token is null', () => {
      createComponent(null);
      component.ngOnInit();

      component.resetForm.setValue({
        newPassword: 'password123',
        confirmPassword: 'password123',
      });

      component.onSubmit();
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('should call resetPassword and set success on success', () => {
      mockAuthService.resetPassword.mockReturnValue(of({ message: 'ok' }));

      component.resetForm.setValue({
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123',
      });

      component.onSubmit();

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        'valid-token-123',
        'newPassword123',
      );
      expect(component.isLoading).toBe(false);
      expect(component.resetSuccess).toBe(true);
    });

    it('should show connection error on status 0', () => {
      mockAuthService.resetPassword.mockReturnValue(
        throwError(() => ({ status: 0 })),
      );

      component.resetForm.setValue({
        newPassword: 'password123',
        confirmPassword: 'password123',
      });

      component.onSubmit();

      expect(component.errorMessage).toContain('Unable to connect');
    });

    it('should show invalid token error on 400', () => {
      mockAuthService.resetPassword.mockReturnValue(
        throwError(() => ({ status: 400, error: {} })),
      );

      component.resetForm.setValue({
        newPassword: 'password123',
        confirmPassword: 'password123',
      });

      component.onSubmit();

      expect(component.errorMessage).toContain('Invalid or expired');
    });

    it('should show server error message for other failures', () => {
      mockAuthService.resetPassword.mockReturnValue(
        throwError(() => ({ status: 500, error: { message: 'Internal error' } })),
      );

      component.resetForm.setValue({
        newPassword: 'password123',
        confirmPassword: 'password123',
      });

      component.onSubmit();

      expect(component.errorMessage).toBe('Internal error');
    });
  });
});
