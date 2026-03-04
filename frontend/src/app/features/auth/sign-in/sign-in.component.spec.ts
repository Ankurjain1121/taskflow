import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SignInComponent } from './sign-in.component';
import { AuthService } from '../../../core/services/auth.service';

describe('SignInComponent', () => {
  let component: SignInComponent;
  let fixture: ComponentFixture<SignInComponent>;
  let router: Router;

  const mockAuthService = {
    signIn: vi.fn(),
  };

  const mockActivatedRoute = {
    snapshot: {
      queryParams: {} as Record<string, string>,
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockActivatedRoute.snapshot.queryParams = {};

    await TestBed.configureTestingModule({
      imports: [
        SignInComponent,
        HttpClientTestingModule,
        RouterTestingModule.withRoutes([]),
      ],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(SignInComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form initialization', () => {
    it('should create a form with email and password controls', () => {
      expect(component.signInForm.get('email')).toBeTruthy();
      expect(component.signInForm.get('password')).toBeTruthy();
    });

    it('should start with empty values', () => {
      expect(component.signInForm.get('email')?.value).toBe('');
      expect(component.signInForm.get('password')?.value).toBe('');
    });

    it('should be invalid when empty', () => {
      expect(component.signInForm.valid).toBe(false);
    });
  });

  describe('form validation', () => {
    it('should require email', () => {
      const email = component.signInForm.get('email');
      email?.setValue('');
      expect(email?.hasError('required')).toBe(true);
    });

    it('should validate email format', () => {
      const email = component.signInForm.get('email');
      email?.setValue('notanemail');
      expect(email?.hasError('email')).toBe(true);

      email?.setValue('valid@example.com');
      expect(email?.hasError('email')).toBe(false);
    });

    it('should require password', () => {
      const password = component.signInForm.get('password');
      password?.setValue('');
      expect(password?.hasError('required')).toBe(true);
    });

    it('should require minimum 8 characters for password', () => {
      const password = component.signInForm.get('password');
      password?.setValue('short');
      expect(password?.hasError('minlength')).toBe(true);

      password?.setValue('longenoughpassword');
      expect(password?.hasError('minlength')).toBe(false);
    });

    it('should be valid with correct email and password', () => {
      component.signInForm.setValue({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(component.signInForm.valid).toBe(true);
    });
  });

  describe('session expired message', () => {
    it('should set sessionExpiredMessage when reason is session_expired', async () => {
      mockActivatedRoute.snapshot.queryParams = { reason: 'session_expired' };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [
          SignInComponent,
          HttpClientTestingModule,
          RouterTestingModule.withRoutes([]),
        ],
        providers: [
          { provide: AuthService, useValue: mockAuthService },
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
        ],
      }).compileComponents();

      const newFixture = TestBed.createComponent(SignInComponent);
      const newComponent = newFixture.componentInstance;

      expect(newComponent.sessionExpiredMessage).toContain(
        'session has expired',
      );
    });

    it('should not set sessionExpiredMessage when no reason param', () => {
      expect(component.sessionExpiredMessage).toBe('');
    });
  });

  describe('onSubmit', () => {
    it('should not call authService when form is invalid', () => {
      component.onSubmit();
      expect(mockAuthService.signIn).not.toHaveBeenCalled();
    });

    it('should mark all fields as touched when form is invalid', () => {
      component.onSubmit();
      expect(component.signInForm.get('email')?.touched).toBe(true);
      expect(component.signInForm.get('password')?.touched).toBe(true);
    });

    it('should call authService.signIn with correct credentials', () => {
      mockAuthService.signIn.mockReturnValue(of({ access_token: 'token' }));
      const navigateSpy = vi.spyOn(router, 'navigateByUrl');

      component.signInForm.setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      component.onSubmit();

      expect(mockAuthService.signIn).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
      expect(component.isLoading).toBe(true);
      expect(navigateSpy).toHaveBeenCalledWith('/dashboard');
    });

    it('should navigate to returnUrl after successful sign in', () => {
      mockAuthService.signIn.mockReturnValue(of({ access_token: 'token' }));
      mockActivatedRoute.snapshot.queryParams = { returnUrl: '/board/123' };

      const navigateSpy = vi.spyOn(router, 'navigateByUrl');

      component.signInForm.setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      component.onSubmit();

      expect(navigateSpy).toHaveBeenCalledWith('/board/123');
    });

    it('should sanitize returnUrl to prevent open redirect', () => {
      mockAuthService.signIn.mockReturnValue(of({ access_token: 'token' }));
      mockActivatedRoute.snapshot.queryParams = { returnUrl: '//evil.com' };

      const navigateSpy = vi.spyOn(router, 'navigateByUrl');

      component.signInForm.setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      component.onSubmit();

      expect(navigateSpy).toHaveBeenCalledWith('/dashboard');
    });

    it('should show error message on 401', () => {
      mockAuthService.signIn.mockReturnValue(
        throwError(() => ({ status: 401 })),
      );

      component.signInForm.setValue({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      component.onSubmit();

      expect(component.isLoading).toBe(false);
      expect(component.errorMessage).toBe('Invalid email or password');
    });

    it('should show connection error on status 0', () => {
      mockAuthService.signIn.mockReturnValue(throwError(() => ({ status: 0 })));

      component.signInForm.setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      component.onSubmit();

      expect(component.errorMessage).toContain('Unable to connect');
    });

    it('should show generic error for other status codes', () => {
      mockAuthService.signIn.mockReturnValue(
        throwError(() => ({ status: 500, error: { message: 'Server error' } })),
      );

      component.signInForm.setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      component.onSubmit();

      expect(component.errorMessage).toBe('Server error');
    });
  });
});
