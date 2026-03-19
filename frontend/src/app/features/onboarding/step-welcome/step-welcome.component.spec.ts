import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { StepWelcomeComponent } from './step-welcome.component';
import { OnboardingService } from '../../../core/services/onboarding.service';

describe('StepWelcomeComponent', () => {
  let component: StepWelcomeComponent;
  let fixture: ComponentFixture<StepWelcomeComponent>;
  let mockOnboardingService: {
    completeOnboarding: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockOnboardingService = {
      completeOnboarding: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [StepWelcomeComponent],
      providers: [
        { provide: OnboardingService, useValue: mockOnboardingService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StepWelcomeComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workspaceName', 'Test Workspace');
    fixture.componentRef.setInput('workspaceId', 'ws-1');
    fixture.componentRef.setInput('boardIds', ['b-1', 'b-2']);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have no selected option initially', () => {
      expect(component.selectedOption).toBeNull();
    });

    it('should not be loading initially', () => {
      expect(component.isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      expect(component.error).toBeNull();
    });
  });

  describe('exploreExisting', () => {
    it('should set selectedOption to explore', () => {
      mockOnboardingService.completeOnboarding.mockReturnValue(of(undefined));
      component.exploreExisting();
      // After completion
      expect(component.selectedOption).toBe('explore');
    });

    it('should call completeOnboarding', () => {
      mockOnboardingService.completeOnboarding.mockReturnValue(of(undefined));
      component.exploreExisting();
      expect(mockOnboardingService.completeOnboarding).toHaveBeenCalledOnce();
    });

    it('should navigate to dashboard on success', () => {
      mockOnboardingService.completeOnboarding.mockReturnValue(of(undefined));
      component.exploreExisting();
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/workspace',
        'ws-1',
        'dashboard',
      ]);
      expect(component.isLoading).toBe(false);
    });

    it('should set error on failure with server message', () => {
      mockOnboardingService.completeOnboarding.mockReturnValue(
        throwError(() => ({ error: { message: 'Server down' } })),
      );
      component.exploreExisting();
      expect(component.error).toBe('Server down');
      expect(component.isLoading).toBe(false);
    });

    it('should set default error on failure without server message', () => {
      mockOnboardingService.completeOnboarding.mockReturnValue(
        throwError(() => ({ error: {} })),
      );
      component.exploreExisting();
      expect(component.error).toBe(
        'Failed to complete onboarding. Please try again.',
      );
    });

    it('should clear previous error', () => {
      component.error = 'old error';
      mockOnboardingService.completeOnboarding.mockReturnValue(of(undefined));
      component.exploreExisting();
      expect(component.error).toBeNull();
    });
  });

  describe('createSample', () => {
    it('should set selectedOption to sample', () => {
      component.createSample();
      expect(component.selectedOption).toBe('sample');
    });

    it('should emit goToSampleBoard event', () => {
      let emitted = false;
      component.goToSampleBoard.subscribe(() => {
        emitted = true;
      });
      component.createSample();
      expect(emitted).toBe(true);
    });
  });
});
