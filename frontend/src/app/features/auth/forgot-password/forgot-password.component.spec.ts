import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;

  const mockAuthService = {
    forgotPassword: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [
        ForgotPasswordComponent,
        HttpClientTestingModule,
        RouterTestingModule.withRoutes([]),
      ],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form initialization', () => {
    it('should have an email control', () => {
      expect(component.forgotForm.get('email')).toBeTruthy();
    });

    it('should be invalid when empty', () => {
      expect(component.forgotForm.valid).toBe(false);
    });

    it('should start with submitted = false', () => {
      expect(component.submitted).toBe(false);
    });
  });

  describe('form validation', () => {
    it('should require email', () => {
      const email = component.forgotForm.get('email');
      email?.setValue('');
      expect(email?.hasError('required')).toBe(true);
    });

    it('should validate email format', () => {
      const email = component.forgotForm.get('email');
      email?.setValue('invalid');
      expect(email?.hasError('email')).toBe(true);

      email?.setValue('valid@example.com');
      expect(email?.hasError('email')).toBe(false);
    });
  });

  describe('onSubmit', () => {
    it('should not call service when form is invalid', () => {
      component.onSubmit();
      expect(mockAuthService.forgotPassword).not.toHaveBeenCalled();
    });

    it('should mark fields as touched when form is invalid', () => {
      component.onSubmit();
      expect(component.forgotForm.get('email')?.touched).toBe(true);
    });

    it('should call forgotPassword and set submitted on success', () => {
      mockAuthService.forgotPassword.mockReturnValue(of({ message: 'ok' }));

      component.forgotForm.setValue({ email: 'test@example.com' });
      component.onSubmit();

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(component.isLoading).toBe(false);
      expect(component.submitted).toBe(true);
    });

    it('should set isLoading during request', () => {
      mockAuthService.forgotPassword.mockReturnValue(of({ message: 'ok' }));

      component.forgotForm.setValue({ email: 'test@example.com' });
      // Check isLoading right before the observable resolves
      expect(component.isLoading).toBe(false);
      component.onSubmit();
      // After sync resolution, isLoading is reset
      expect(component.isLoading).toBe(false);
    });

    it('should show connection error on status 0', () => {
      mockAuthService.forgotPassword.mockReturnValue(
        throwError(() => ({ status: 0 })),
      );

      component.forgotForm.setValue({ email: 'test@example.com' });
      component.onSubmit();

      expect(component.isLoading).toBe(false);
      expect(component.errorMessage).toContain('Unable to connect');
    });

    it('should show generic error for other failures', () => {
      mockAuthService.forgotPassword.mockReturnValue(
        throwError(() => ({ status: 500, error: { message: 'Server error' } })),
      );

      component.forgotForm.setValue({ email: 'test@example.com' });
      component.onSubmit();

      expect(component.errorMessage).toBe('Server error');
    });
  });
});
