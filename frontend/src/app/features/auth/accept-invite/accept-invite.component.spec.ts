import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AcceptInviteComponent } from './accept-invite.component';
import {
  InvitationService,
  InvitationValidateResponse,
} from '../../../core/services/invitation.service';

describe('AcceptInviteComponent', () => {
  let component: AcceptInviteComponent;
  let fixture: ComponentFixture<AcceptInviteComponent>;

  const mockInvitationService = {
    validate: vi.fn(),
    accept: vi.fn(),
  };

  function setupTestBed(token: string | null) {
    TestBed.resetTestingModule();

    const queryParams: Record<string, string> = {};
    const pathParams: Record<string, string> = {};
    if (token) {
      queryParams['token'] = token;
    }

    const mockRoute = {
      snapshot: {
        queryParamMap: convertToParamMap(queryParams),
        paramMap: convertToParamMap(pathParams),
      },
    };

    TestBed.configureTestingModule({
      imports: [
        AcceptInviteComponent,
        HttpClientTestingModule,
        RouterTestingModule.withRoutes([]),
      ],
      providers: [
        { provide: InvitationService, useValue: mockInvitationService },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AcceptInviteComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ngOnInit with no token', () => {
    it('should set pageState to invalid when no token', () => {
      setupTestBed(null);
      component.ngOnInit();

      expect(component.pageState()).toBe('invalid');
    });
  });

  describe('ngOnInit with valid token', () => {
    const validResponse: InvitationValidateResponse = {
      valid: true,
      email: 'test@example.com',
      workspace_id: 'ws-1',
      role: 'member',
      expired: false,
      already_accepted: false,
    };

    it('should set pageState to valid when token is valid', () => {
      mockInvitationService.validate.mockReturnValue(of(validResponse));
      setupTestBed('valid-token');
      component.ngOnInit();

      expect(component.pageState()).toBe('valid');
      expect(component.invitation()).toEqual(validResponse);
    });

    it('should set pageState to expired when invitation is expired', () => {
      mockInvitationService.validate.mockReturnValue(
        of({ ...validResponse, valid: false, expired: true }),
      );
      setupTestBed('expired-token');
      component.ngOnInit();

      expect(component.pageState()).toBe('expired');
    });

    it('should set pageState to already_accepted when already used', () => {
      mockInvitationService.validate.mockReturnValue(
        of({ ...validResponse, valid: false, already_accepted: true }),
      );
      setupTestBed('used-token');
      component.ngOnInit();

      expect(component.pageState()).toBe('already_accepted');
    });

    it('should set pageState to invalid on validation error', () => {
      mockInvitationService.validate.mockReturnValue(
        throwError(() => ({ status: 404 })),
      );
      setupTestBed('bad-token');
      component.ngOnInit();

      expect(component.pageState()).toBe('invalid');
    });
  });

  describe('form initialization', () => {
    it('should have name, password, confirmPassword controls', () => {
      const validResponse: InvitationValidateResponse = {
        valid: true,
        email: 'test@example.com',
        workspace_id: 'ws-1',
        role: 'member',
        expired: false,
        already_accepted: false,
      };
      mockInvitationService.validate.mockReturnValue(of(validResponse));
      setupTestBed('valid-token');
      component.ngOnInit();

      expect(component.acceptForm.get('name')).toBeTruthy();
      expect(component.acceptForm.get('password')).toBeTruthy();
      expect(component.acceptForm.get('confirmPassword')).toBeTruthy();
    });
  });

  describe('form validation', () => {
    beforeEach(() => {
      const validResponse: InvitationValidateResponse = {
        valid: true,
        email: 'test@example.com',
        workspace_id: 'ws-1',
        role: 'member',
        expired: false,
        already_accepted: false,
      };
      mockInvitationService.validate.mockReturnValue(of(validResponse));
      setupTestBed('valid-token');
      component.ngOnInit();
    });

    it('should require name', () => {
      component.acceptForm.get('name')?.setValue('');
      expect(component.acceptForm.get('name')?.hasError('required')).toBe(true);
    });

    it('should require password of min 8 chars', () => {
      const pw = component.acceptForm.get('password');
      pw?.setValue('short');
      expect(pw?.hasError('minlength')).toBe(true);
    });

    it('should detect password mismatch', () => {
      component.acceptForm.get('password')?.setValue('password123');
      component.acceptForm.get('confirmPassword')?.setValue('different');
      component.acceptForm.updateValueAndValidity();

      expect(
        component.acceptForm
          .get('confirmPassword')
          ?.hasError('passwordMismatch'),
      ).toBe(true);
    });
  });

  describe('onSubmit', () => {
    beforeEach(() => {
      const validResponse: InvitationValidateResponse = {
        valid: true,
        email: 'test@example.com',
        workspace_id: 'ws-1',
        role: 'member',
        expired: false,
        already_accepted: false,
      };
      mockInvitationService.validate.mockReturnValue(of(validResponse));
      setupTestBed('valid-token');
      component.ngOnInit();
    });

    it('should not call accept when form is invalid', () => {
      component.onSubmit();
      expect(mockInvitationService.accept).not.toHaveBeenCalled();
    });

    it('should call accept and set pageState to success on success', () => {
      mockInvitationService.accept.mockReturnValue(of({ message: 'ok' }));

      component.acceptForm.setValue({
        name: 'Test User',
        password: 'password123',
        confirmPassword: 'password123',
      });

      component.onSubmit();

      expect(mockInvitationService.accept).toHaveBeenCalledWith({
        token: 'valid-token',
        name: 'Test User',
        password: 'password123',
      });
      expect(component.pageState()).toBe('success');
      expect(component.isLoading()).toBe(false);
    });

    it('should show error on 409 (duplicate email)', () => {
      mockInvitationService.accept.mockReturnValue(
        throwError(() => ({ status: 409 })),
      );

      component.acceptForm.setValue({
        name: 'Test User',
        password: 'password123',
        confirmPassword: 'password123',
      });

      component.onSubmit();

      expect(component.errorMessage()).toContain('already exists');
    });

    it('should show connection error on status 0', () => {
      mockInvitationService.accept.mockReturnValue(
        throwError(() => ({ status: 0 })),
      );

      component.acceptForm.setValue({
        name: 'Test User',
        password: 'password123',
        confirmPassword: 'password123',
      });

      component.onSubmit();

      expect(component.errorMessage()).toContain('Unable to connect');
    });

    it('should show bad request error on 400', () => {
      mockInvitationService.accept.mockReturnValue(
        throwError(() => ({
          status: 400,
          error: { error: { message: 'Token expired' } },
        })),
      );

      component.acceptForm.setValue({
        name: 'Test User',
        password: 'password123',
        confirmPassword: 'password123',
      });

      component.onSubmit();

      expect(component.errorMessage()).toBe('Token expired');
    });
  });
});
