import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { StepSampleBoardComponent } from './step-sample-board.component';
import { OnboardingService } from '../../../core/services/onboarding.service';

describe('StepSampleBoardComponent', () => {
  let component: StepSampleBoardComponent;
  let fixture: ComponentFixture<StepSampleBoardComponent>;
  let mockOnboardingService: {
    generateSampleBoard: ReturnType<typeof vi.fn>;
    completeOnboarding: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockOnboardingService = {
      generateSampleBoard: vi.fn(),
      completeOnboarding: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [StepSampleBoardComponent],
      providers: [
        { provide: OnboardingService, useValue: mockOnboardingService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StepSampleBoardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workspaceId', 'ws-test');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should not be loading initially', () => {
      expect(component.isLoading()).toBe(false);
    });

    it('should not be generated initially', () => {
      expect(component.isGenerated()).toBe(false);
    });

    it('should not be navigating initially', () => {
      expect(component.isNavigating()).toBe(false);
    });

    it('should have no error initially', () => {
      expect(component.error()).toBeNull();
    });

    it('should have 5 sample columns for default software use case', () => {
      expect(component.previewColumns()).toHaveLength(5);
    });

    it('should have correct sample column names', () => {
      const names = component.previewColumns().map((c: any) => c.name);
      expect(names).toEqual(['Backlog', 'To Do', 'In Progress', 'Code Review', 'Done']);
    });
  });

  describe('getTaskPlaceholders', () => {
    it('should return array of correct length', () => {
      expect(component.getTaskPlaceholders(3)).toHaveLength(3);
    });

    it('should return array of indices', () => {
      expect(component.getTaskPlaceholders(3)).toEqual([0, 1, 2]);
    });

    it('should return empty array for 0', () => {
      expect(component.getTaskPlaceholders(0)).toHaveLength(0);
    });
  });

  describe('generate', () => {
    it('should set loading to true then false', () => {
      mockOnboardingService.generateSampleBoard.mockReturnValue(
        of({ board_id: 'board-1' }),
      );

      component.generate();

      expect(component.isLoading()).toBe(false);
    });

    it('should clear previous error', () => {
      component.error.set('old error');
      mockOnboardingService.generateSampleBoard.mockReturnValue(
        of({ board_id: 'board-1' }),
      );

      component.generate();

      expect(component.error()).toBeNull();
    });

    it('should call generateSampleBoard with workspaceId and useCase', () => {
      mockOnboardingService.generateSampleBoard.mockReturnValue(
        of({ board_id: 'board-1' }),
      );

      component.generate();

      expect(mockOnboardingService.generateSampleBoard).toHaveBeenCalledWith(
        'ws-test',
        'software',
      );
    });

    it('should set isGenerated to true on success', () => {
      mockOnboardingService.generateSampleBoard.mockReturnValue(
        of({ board_id: 'board-1' }),
      );

      component.generate();

      expect(component.isGenerated()).toBe(true);
    });

    it('should set error on failure with server message', () => {
      mockOnboardingService.generateSampleBoard.mockReturnValue(
        throwError(() => ({ error: { message: 'Quota exceeded' } })),
      );

      component.generate();

      expect(component.error()).toBe('Quota exceeded');
      expect(component.isLoading()).toBe(false);
    });

    it('should set default error on failure without server message', () => {
      mockOnboardingService.generateSampleBoard.mockReturnValue(
        throwError(() => ({ error: {} })),
      );

      component.generate();

      expect(component.error()).toBe(
        'Failed to generate sample board. Please try again.',
      );
    });
  });

  describe('goToDashboard', () => {
    it('should set isNavigating to true then false', () => {
      mockOnboardingService.completeOnboarding.mockReturnValue(of(undefined));

      component.goToDashboard();

      expect(component.isNavigating()).toBe(false);
    });

    it('should clear previous error', () => {
      component.error.set('old error');
      mockOnboardingService.completeOnboarding.mockReturnValue(of(undefined));

      component.goToDashboard();

      expect(component.error()).toBeNull();
    });

    it('should call completeOnboarding', () => {
      mockOnboardingService.completeOnboarding.mockReturnValue(of(undefined));

      component.goToDashboard();

      expect(mockOnboardingService.completeOnboarding).toHaveBeenCalledOnce();
    });

    it('should navigate to dashboard on success', () => {
      mockOnboardingService.completeOnboarding.mockReturnValue(of(undefined));

      component.goToDashboard();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should set error on failure with server message', () => {
      mockOnboardingService.completeOnboarding.mockReturnValue(
        throwError(() => ({ error: { message: 'Server error' } })),
      );

      component.goToDashboard();

      expect(component.error()).toBe('Server error');
      expect(component.isNavigating()).toBe(false);
    });

    it('should set default error on failure without server message', () => {
      mockOnboardingService.completeOnboarding.mockReturnValue(
        throwError(() => ({ error: {} })),
      );

      component.goToDashboard();

      expect(component.error()).toBe(
        'Failed to complete onboarding. Please try again.',
      );
    });
  });
});
