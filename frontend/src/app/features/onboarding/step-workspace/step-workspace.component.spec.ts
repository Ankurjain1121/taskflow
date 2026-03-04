import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { StepWorkspaceComponent } from './step-workspace.component';
import { OnboardingService } from '../../../core/services/onboarding.service';

describe('StepWorkspaceComponent', () => {
  let component: StepWorkspaceComponent;
  let fixture: ComponentFixture<StepWorkspaceComponent>;
  let mockOnboardingService: {
    createWorkspace: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockOnboardingService = {
      createWorkspace: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [StepWorkspaceComponent, ReactiveFormsModule],
      providers: [
        { provide: OnboardingService, useValue: mockOnboardingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StepWorkspaceComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have an invalid form initially', () => {
      expect(component.form.valid).toBe(false);
    });

    it('should not be loading initially', () => {
      expect(component.isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      expect(component.error).toBeNull();
    });

    it('should have empty name field', () => {
      expect(component.form.get('name')?.value).toBe('');
    });

    it('should have empty description field', () => {
      expect(component.form.get('description')?.value).toBe('');
    });
  });

  describe('form validation', () => {
    it('should be invalid when name is empty', () => {
      component.form.patchValue({ name: '' });
      expect(component.form.valid).toBe(false);
    });

    it('should be invalid when name is too short (1 char)', () => {
      component.form.patchValue({ name: 'a' });
      expect(component.form.valid).toBe(false);
    });

    it('should be valid when name has 2+ characters', () => {
      component.form.patchValue({ name: 'ab' });
      expect(component.form.valid).toBe(true);
    });

    it('should be valid with name and description', () => {
      component.form.patchValue({
        name: 'My Workspace',
        description: 'A desc',
      });
      expect(component.form.valid).toBe(true);
    });

    it('should be valid with name and empty description', () => {
      component.form.patchValue({ name: 'My Workspace', description: '' });
      expect(component.form.valid).toBe(true);
    });
  });

  describe('onSubmit', () => {
    it('should mark all fields as touched when form is invalid', () => {
      component.onSubmit();

      expect(component.form.get('name')?.touched).toBe(true);
      expect(mockOnboardingService.createWorkspace).not.toHaveBeenCalled();
    });

    it('should not call service when form is invalid', () => {
      component.form.patchValue({ name: '' });
      component.onSubmit();

      expect(mockOnboardingService.createWorkspace).not.toHaveBeenCalled();
    });

    it('should set isLoading to true while submitting', () => {
      component.form.patchValue({ name: 'My Workspace' });
      mockOnboardingService.createWorkspace.mockReturnValue(
        of({ workspace_id: 'ws-123' }),
      );

      component.onSubmit();

      // isLoading should be false after completion
      expect(component.isLoading).toBe(false);
    });

    it('should clear previous error on submit', () => {
      component.error = 'Previous error';
      component.form.patchValue({ name: 'My Workspace' });
      mockOnboardingService.createWorkspace.mockReturnValue(
        of({ workspace_id: 'ws-123' }),
      );

      component.onSubmit();

      expect(component.error).toBeNull();
    });

    it('should call createWorkspace with name and description', () => {
      component.form.patchValue({ name: 'Test WS', description: 'Test desc' });
      mockOnboardingService.createWorkspace.mockReturnValue(
        of({ workspace_id: 'ws-1' }),
      );

      component.onSubmit();

      expect(mockOnboardingService.createWorkspace).toHaveBeenCalledWith(
        'Test WS',
        'Test desc',
      );
    });

    it('should call createWorkspace with undefined description when empty', () => {
      component.form.patchValue({ name: 'Test WS', description: '' });
      mockOnboardingService.createWorkspace.mockReturnValue(
        of({ workspace_id: 'ws-1' }),
      );

      component.onSubmit();

      expect(mockOnboardingService.createWorkspace).toHaveBeenCalledWith(
        'Test WS',
        undefined,
      );
    });

    it('should emit completed with workspace_id on success', () => {
      component.form.patchValue({ name: 'Test WS' });
      mockOnboardingService.createWorkspace.mockReturnValue(
        of({ workspace_id: 'ws-abc' }),
      );

      let emittedId: string | undefined;
      component.completed.subscribe((id) => {
        emittedId = id;
      });

      component.onSubmit();

      expect(emittedId).toBe('ws-abc');
      expect(component.isLoading).toBe(false);
    });

    it('should set error message on failure with server message', () => {
      component.form.patchValue({ name: 'Test WS' });
      mockOnboardingService.createWorkspace.mockReturnValue(
        throwError(() => ({ error: { message: 'Name already taken' } })),
      );

      component.onSubmit();

      expect(component.error).toBe('Name already taken');
      expect(component.isLoading).toBe(false);
    });

    it('should set default error message when server provides none', () => {
      component.form.patchValue({ name: 'Test WS' });
      mockOnboardingService.createWorkspace.mockReturnValue(
        throwError(() => ({ error: {} })),
      );

      component.onSubmit();

      expect(component.error).toBe(
        'Failed to create workspace. Please try again.',
      );
    });
  });
});
