import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SignUpComponent } from './sign-up.component';
import { AuthService } from '../../../core/services/auth.service';

describe('SignUpComponent', () => {
  let component: SignUpComponent;
  let fixture: ComponentFixture<SignUpComponent>;
  let router: Router;

  const mockAuthService = {
    signUp: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [
        SignUpComponent,
        HttpClientTestingModule,
        RouterTestingModule.withRoutes([]),
      ],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(SignUpComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form initialization', () => {
    it('should have name, email, password, confirmPassword controls', () => {
      expect(component.signUpForm.get('name')).toBeTruthy();
      expect(component.signUpForm.get('email')).toBeTruthy();
      expect(component.signUpForm.get('password')).toBeTruthy();
      expect(component.signUpForm.get('confirmPassword')).toBeTruthy();
    });

    it('should be invalid when empty', () => {
      expect(component.signUpForm.valid).toBe(false);
    });
  });

  describe('form validation', () => {
    it('should require name', () => {
      const name = component.signUpForm.get('name');
      name?.setValue('');
      expect(name?.hasError('required')).toBe(true);
    });

    it('should require email', () => {
      const email = component.signUpForm.get('email');
      email?.setValue('');
      expect(email?.hasError('required')).toBe(true);
    });

    it('should validate email format', () => {
      const email = component.signUpForm.get('email');
      email?.setValue('bad');
      expect(email?.hasError('email')).toBe(true);

      email?.setValue('good@example.com');
      expect(email?.hasError('email')).toBe(false);
    });

    it('should require password of minimum 8 characters', () => {
      const password = component.signUpForm.get('password');
      password?.setValue('short');
      expect(password?.hasError('minlength')).toBe(true);

      password?.setValue('longenough');
      expect(password?.hasError('minlength')).toBe(false);
    });

    it('should require confirmPassword', () => {
      const confirm = component.signUpForm.get('confirmPassword');
      confirm?.setValue('');
      expect(confirm?.hasError('required')).toBe(true);
    });
  });

  describe('password match validation', () => {
    it('should set passwordMismatch error when passwords differ', () => {
      component.signUpForm.get('password')?.setValue('password123');
      component.signUpForm.get('confirmPassword')?.setValue('different');
      component.signUpForm.updateValueAndValidity();

      expect(
        component.signUpForm
          .get('confirmPassword')
          ?.hasError('passwordMismatch'),
      ).toBe(true);
    });

    it('should clear passwordMismatch error when passwords match', () => {
      component.signUpForm.get('password')?.setValue('password123');
      component.signUpForm.get('confirmPassword')?.setValue('password123');
      component.signUpForm.updateValueAndValidity();

      expect(
        component.signUpForm
          .get('confirmPassword')
          ?.hasError('passwordMismatch'),
      ).toBe(false);
    });
  });

  describe('passwordStrength', () => {
    it('should return 0 for empty password', () => {
      component.signUpForm.get('password')?.setValue('');
      expect(component.passwordStrength).toBe(0);
    });

    it('should give 25 for 8+ chars', () => {
      component.signUpForm.get('password')?.setValue('aaaaaaaa');
      // 8 chars + lowercase: 25 + 10 = 35
      expect(component.passwordStrength).toBe(35);
    });

    it('should give higher score for mixed case, numbers, special chars', () => {
      component.signUpForm.get('password')?.setValue('Abc123!@#xyz');
      // 8+ (25) + 12+ (15) + lowercase (10) + uppercase (15) + digits (15) + special (20) = 100
      expect(component.passwordStrength).toBe(100);
    });

    it('should cap at 100', () => {
      component.signUpForm.get('password')?.setValue('VeryStr0ng!Pass#Word99');
      expect(component.passwordStrength).toBeLessThanOrEqual(100);
    });
  });

  describe('passwordStrengthBarClass', () => {
    it('should return strength-weak for weak passwords', () => {
      component.signUpForm.get('password')?.setValue('short');
      expect(component.passwordStrengthBarClass).toBe('strength-weak');
    });

    it('should return strength-strong for strong passwords', () => {
      component.signUpForm.get('password')?.setValue('Abc123!@#xyz');
      expect(component.passwordStrengthBarClass).toBe('strength-strong');
    });
  });

  describe('passwordStrengthLabel', () => {
    it('should return "Weak password" for weak passwords', () => {
      component.signUpForm.get('password')?.setValue('short');
      expect(component.passwordStrengthLabel).toBe('Weak password');
    });

    it('should return "Strong password" for strong passwords', () => {
      component.signUpForm.get('password')?.setValue('Abc123!@#xyz');
      expect(component.passwordStrengthLabel).toBe('Strong password');
    });
  });

  describe('passwordStrengthTextClass', () => {
    it('should return red class for weak', () => {
      component.signUpForm.get('password')?.setValue('short');
      expect(component.passwordStrengthTextClass).toContain('red');
    });

    it('should return green class for strong', () => {
      component.signUpForm.get('password')?.setValue('Abc123!@#xyz');
      expect(component.passwordStrengthTextClass).toContain('green');
    });
  });

  describe('onSubmit', () => {
    it('should not call authService when form is invalid', () => {
      component.onSubmit();
      expect(mockAuthService.signUp).not.toHaveBeenCalled();
    });

    it('should mark all fields touched when form is invalid', () => {
      component.onSubmit();
      expect(component.signUpForm.get('name')?.touched).toBe(true);
      expect(component.signUpForm.get('email')?.touched).toBe(true);
    });

    it('should call authService.signUp and navigate on success', () => {
      mockAuthService.signUp.mockReturnValue(of({ access_token: 'token' }));
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.signUpForm.setValue({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

      component.onSubmit();

      expect(mockAuthService.signUp).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });
      expect(navigateSpy).toHaveBeenCalledWith(['/onboarding']);
    });

    it('should show error on 409 (duplicate email)', () => {
      mockAuthService.signUp.mockReturnValue(
        throwError(() => ({ status: 409 })),
      );

      component.signUpForm.setValue({
        name: 'Test',
        email: 'taken@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

      component.onSubmit();

      expect(component.isLoading).toBe(false);
      expect(component.errorMessage).toContain('already exists');
    });

    it('should show connection error on status 0', () => {
      mockAuthService.signUp.mockReturnValue(throwError(() => ({ status: 0 })));

      component.signUpForm.setValue({
        name: 'Test',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

      component.onSubmit();

      expect(component.errorMessage).toContain('Unable to connect');
    });

    it('should show validation error on 400', () => {
      mockAuthService.signUp.mockReturnValue(
        throwError(() => ({
          status: 400,
          error: { error: { message: 'Password too weak' } },
        })),
      );

      component.signUpForm.setValue({
        name: 'Test',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });

      component.onSubmit();

      expect(component.errorMessage).toBe('Password too weak');
    });
  });
});
