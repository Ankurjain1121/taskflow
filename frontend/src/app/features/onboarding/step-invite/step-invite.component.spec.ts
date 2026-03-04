import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Component } from '@angular/core';
import { StepInviteComponent } from './step-invite.component';
import { OnboardingService } from '../../../core/services/onboarding.service';

describe('StepInviteComponent', () => {
  let component: StepInviteComponent;
  let fixture: ComponentFixture<StepInviteComponent>;
  let mockOnboardingService: {
    inviteMembers: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockOnboardingService = {
      inviteMembers: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [StepInviteComponent],
      providers: [
        { provide: OnboardingService, useValue: mockOnboardingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StepInviteComponent);
    component = fixture.componentInstance;
    // Set the required input
    fixture.componentRef.setInput('workspaceId', 'ws-test');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have one empty email entry', () => {
      expect(component.emails).toHaveLength(1);
      expect(component.emails[0].value).toBe('');
      expect(component.emails[0].error).toBeNull();
    });

    it('should not be loading', () => {
      expect(component.isLoading).toBe(false);
    });

    it('should have no error', () => {
      expect(component.error).toBeNull();
    });

    it('should have no success message', () => {
      expect(component.successMessage).toBeNull();
    });
  });

  describe('addEmail', () => {
    it('should add a new email entry', () => {
      component.addEmail();
      expect(component.emails).toHaveLength(2);
    });

    it('should increment the nextId', () => {
      const initialNextId = component.nextId;
      component.addEmail();
      expect(component.nextId).toBe(initialNextId + 1);
    });

    it('should not exceed 10 emails', () => {
      for (let i = 0; i < 15; i++) {
        component.addEmail();
      }
      expect(component.emails.length).toBeLessThanOrEqual(10);
    });
  });

  describe('removeEmail', () => {
    it('should remove an email entry at given index', () => {
      component.addEmail();
      component.addEmail();
      expect(component.emails).toHaveLength(3);

      component.removeEmail(1);
      expect(component.emails).toHaveLength(2);
    });

    it('should not remove the last email entry', () => {
      expect(component.emails).toHaveLength(1);
      component.removeEmail(0);
      expect(component.emails).toHaveLength(1);
    });
  });

  describe('validateEmail', () => {
    it('should set no error for empty email (optional)', () => {
      const email = component.emails[0];
      email.value = '';
      component.validateEmail(email);
      expect(email.error).toBeNull();
    });

    it('should set no error for whitespace-only email', () => {
      const email = component.emails[0];
      email.value = '   ';
      component.validateEmail(email);
      expect(email.error).toBeNull();
    });

    it('should set error for invalid email format', () => {
      const email = component.emails[0];
      email.value = 'notanemail';
      component.validateEmail(email);
      expect(email.error).toBe('Please enter a valid email address');
    });

    it('should set error for email missing domain', () => {
      const email = component.emails[0];
      email.value = 'user@';
      component.validateEmail(email);
      expect(email.error).toBe('Please enter a valid email address');
    });

    it('should clear error for valid email', () => {
      const email = component.emails[0];
      email.value = 'invalid';
      component.validateEmail(email);
      expect(email.error).not.toBeNull();

      email.value = 'user@example.com';
      component.validateEmail(email);
      expect(email.error).toBeNull();
    });

    it('should accept standard email format', () => {
      const email = component.emails[0];
      email.value = 'test@company.org';
      component.validateEmail(email);
      expect(email.error).toBeNull();
    });
  });

  describe('hasValidEmails', () => {
    it('should return false when all emails are empty', () => {
      expect(component.hasValidEmails()).toBe(false);
    });

    it('should return false when emails have validation errors', () => {
      component.emails[0].value = 'invalid';
      component.emails[0].error = 'Please enter a valid email address';
      expect(component.hasValidEmails()).toBe(false);
    });

    it('should return true when at least one valid email exists', () => {
      component.emails[0].value = 'user@example.com';
      component.emails[0].error = null;
      expect(component.hasValidEmails()).toBe(true);
    });

    it('should return true when some emails are valid and some empty', () => {
      component.addEmail();
      component.emails[0].value = 'user@example.com';
      component.emails[0].error = null;
      component.emails[1].value = '';
      expect(component.hasValidEmails()).toBe(true);
    });
  });

  describe('sendInvites', () => {
    it('should not call service when no valid emails', () => {
      component.sendInvites();
      expect(mockOnboardingService.inviteMembers).not.toHaveBeenCalled();
    });

    it('should call inviteMembers with valid emails only', () => {
      component.emails[0].value = 'user1@example.com';
      component.addEmail();
      component.emails[1].value = '';
      component.addEmail();
      component.emails[2].value = 'user2@example.com';

      mockOnboardingService.inviteMembers.mockReturnValue(
        of({ invited: 2, pending: 0 }),
      );

      component.sendInvites();

      expect(mockOnboardingService.inviteMembers).toHaveBeenCalledWith(
        'ws-test',
        ['user1@example.com', 'user2@example.com'],
      );
    });

    it('should set loading state during request', () => {
      component.emails[0].value = 'user@test.com';
      mockOnboardingService.inviteMembers.mockReturnValue(
        of({ invited: 1, pending: 0 }),
      );

      component.sendInvites();

      expect(component.isLoading).toBe(false);
    });

    it('should show success message when invitations sent', () => {
      vi.useFakeTimers();
      component.emails[0].value = 'user@test.com';
      mockOnboardingService.inviteMembers.mockReturnValue(
        of({ invited: 1, pending: 1 }),
      );

      component.sendInvites();

      expect(component.successMessage).toBe(
        'Invitations sent to 2 team member(s)!',
      );
      vi.useRealTimers();
    });

    it('should emit completed immediately when total is 0', () => {
      component.emails[0].value = 'user@test.com';
      mockOnboardingService.inviteMembers.mockReturnValue(
        of({ invited: 0, pending: 0 }),
      );

      let emitted = false;
      component.completed.subscribe(() => {
        emitted = true;
      });

      component.sendInvites();

      expect(emitted).toBe(true);
    });

    it('should emit completed after delay when invitations succeed', () => {
      vi.useFakeTimers();
      component.emails[0].value = 'user@test.com';
      mockOnboardingService.inviteMembers.mockReturnValue(
        of({ invited: 1, pending: 0 }),
      );

      let emitted = false;
      component.completed.subscribe(() => {
        emitted = true;
      });

      component.sendInvites();

      expect(emitted).toBe(false);

      vi.advanceTimersByTime(1500);
      expect(emitted).toBe(true);

      vi.useRealTimers();
    });

    it('should set error on failure with server message', () => {
      component.emails[0].value = 'user@test.com';
      mockOnboardingService.inviteMembers.mockReturnValue(
        throwError(() => ({ error: { message: 'Rate limited' } })),
      );

      component.sendInvites();

      expect(component.error).toBe('Rate limited');
      expect(component.isLoading).toBe(false);
    });

    it('should set default error on failure without server message', () => {
      component.emails[0].value = 'user@test.com';
      mockOnboardingService.inviteMembers.mockReturnValue(
        throwError(() => ({ error: {} })),
      );

      component.sendInvites();

      expect(component.error).toBe(
        'Failed to send invitations. Please try again.',
      );
    });

    it('should clear previous error and success message before sending', () => {
      component.error = 'old error';
      component.successMessage = 'old success';
      component.emails[0].value = 'user@test.com';
      mockOnboardingService.inviteMembers.mockReturnValue(
        of({ invited: 1, pending: 0 }),
      );

      component.sendInvites();

      // error and successMessage are cleared before request
      // After success, successMessage is set
      expect(component.error).toBeNull();
    });
  });

  describe('skip', () => {
    it('should emit completed immediately', () => {
      let emitted = false;
      component.completed.subscribe(() => {
        emitted = true;
      });

      component.skip();

      expect(emitted).toBe(true);
    });
  });
});
