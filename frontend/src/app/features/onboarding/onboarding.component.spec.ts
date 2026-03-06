import { TestBed, ComponentFixture } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OnboardingComponent } from './onboarding.component';
import { OnboardingService } from '../../core/services/onboarding.service';

describe('OnboardingComponent', () => {
  let component: OnboardingComponent;
  let fixture: ComponentFixture<OnboardingComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  const mockOnboardingService = {
    getInvitationContext: vi.fn(),
    createWorkspace: vi.fn(),
    inviteMembers: vi.fn(),
    generateSampleBoard: vi.fn(),
    completeOnboarding: vi.fn(),
  };

  function createComponent(queryToken: string | null = null) {
    TestBed.resetTestingModule();

    const queryParams: Record<string, string> = {};
    if (queryToken) {
      queryParams['token'] = queryToken;
    }

    const mockRoute = {
      snapshot: {
        queryParamMap: convertToParamMap(queryParams),
      },
    };

    TestBed.configureTestingModule({
      imports: [
        OnboardingComponent,
        HttpClientTestingModule,
        RouterTestingModule.withRoutes([]),
      ],
      providers: [
        { provide: OnboardingService, useValue: mockOnboardingService },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should start in loading state', () => {
      createComponent();
      expect(component.isLoading()).toBe(true);
    });

    it('should default to full flow', () => {
      createComponent();
      expect(component.flow()).toBe('full');
    });

    it('should start at step index 0', () => {
      createComponent();
      expect(component.currentStepIndex()).toBe(0);
    });
  });

  describe('ngOnInit - full flow', () => {
    it('should redirect to dashboard if onboarding already completed', () => {
      createComponent();
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.ngOnInit();
      const req = httpMock.expectOne('/api/auth/me');
      req.flush({ onboarding_completed: true });

      expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should init full flow when no token present', () => {
      createComponent();

      component.ngOnInit();
      const req = httpMock.expectOne('/api/auth/me');
      req.flush({ onboarding_completed: false });

      expect(component.flow()).toBe('full');
      expect(component.isLoading()).toBe(false);
    });

    it('should redirect to sign-in on auth error', () => {
      createComponent();
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.ngOnInit();
      const req = httpMock.expectOne('/api/auth/me');
      req.error(new ProgressEvent('error'));

      expect(navigateSpy).toHaveBeenCalledWith(['/auth/sign-in']);
    });
  });

  describe('ngOnInit - abbreviated flow', () => {
    it('should init abbreviated flow with valid token', () => {
      mockOnboardingService.getInvitationContext.mockReturnValue(
        of({
          workspace_id: 'ws-1',
          workspace_name: 'Test WS',
          project_ids: ['b-1'],
        }),
      );

      createComponent('invite-token');

      component.ngOnInit();
      const req = httpMock.expectOne('/api/auth/me');
      req.flush({ onboarding_completed: false });

      expect(component.flow()).toBe('abbreviated');
      expect(component.invitationContext()).toEqual({
        workspace_id: 'ws-1',
        workspace_name: 'Test WS',
        project_ids: ['b-1'],
      });
      expect(component.isLoading()).toBe(false);
    });

    it('should fall back to full flow if token is invalid', () => {
      mockOnboardingService.getInvitationContext.mockReturnValue(
        throwError(() => ({ status: 404 })),
      );

      createComponent('bad-token');

      component.ngOnInit();
      const req = httpMock.expectOne('/api/auth/me');
      req.flush({ onboarding_completed: false });

      expect(component.flow()).toBe('full');
    });
  });

  describe('computed signals', () => {
    beforeEach(() => {
      createComponent();
    });

    it('currentSteps should return full flow steps for full flow', () => {
      component.flow.set('full');
      expect(component.currentSteps()).toHaveLength(4);
    });

    it('currentSteps should return abbreviated steps for abbreviated flow', () => {
      component.flow.set('abbreviated');
      expect(component.currentSteps()).toHaveLength(2);
    });

    it('currentFullStep should return step id based on index', () => {
      component.flow.set('full');
      component.currentStepIndex.set(0);
      expect(component.currentFullStep()).toBe('workspace');

      component.currentStepIndex.set(1);
      expect(component.currentFullStep()).toBe('invite');

      component.currentStepIndex.set(2);
      expect(component.currentFullStep()).toBe('use-case');

      component.currentStepIndex.set(3);
      expect(component.currentFullStep()).toBe('sample-board');
    });

    it('currentAbbreviatedStep should return step id based on index', () => {
      component.flow.set('abbreviated');
      component.currentStepIndex.set(0);
      expect(component.currentAbbreviatedStep()).toBe('welcome');

      component.currentStepIndex.set(1);
      expect(component.currentAbbreviatedStep()).toBe('sample-board');
    });

    it('showBackButton should be true only at invite step of full flow', () => {
      component.flow.set('full');
      component.currentStepIndex.set(0);
      expect(component.showBackButton()).toBe(false);

      component.currentStepIndex.set(1);
      expect(component.showBackButton()).toBe(true);

      component.currentStepIndex.set(2);
      expect(component.showBackButton()).toBe(false);
    });

    it('showBackButton should be false for abbreviated flow', () => {
      component.flow.set('abbreviated');
      component.currentStepIndex.set(1);
      expect(component.showBackButton()).toBe(false);
    });
  });

  describe('navigation methods', () => {
    beforeEach(() => {
      createComponent();
    });

    it('onWorkspaceCreated should set workspaceId and advance to step 1', () => {
      component.onWorkspaceCreated('ws-new');
      expect(component.workspaceId()).toBe('ws-new');
      expect(component.currentStepIndex()).toBe(1);
    });

    it('onInviteComplete should advance to step 2', () => {
      component.onInviteComplete();
      expect(component.currentStepIndex()).toBe(2);
    });

    it('goToSampleBoardStep should advance to step 1', () => {
      component.goToSampleBoardStep();
      expect(component.currentStepIndex()).toBe(1);
    });

    it('goBack should decrement step index', () => {
      component.currentStepIndex.set(2);
      component.goBack();
      expect(component.currentStepIndex()).toBe(1);
    });

    it('goBack should not go below 0', () => {
      component.currentStepIndex.set(0);
      component.goBack();
      expect(component.currentStepIndex()).toBe(0);
    });
  });
});
