import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  SpotlightOverlayComponent,
  SpotlightStep,
} from './spotlight-overlay.component';
import { FeatureHintsService } from '../../../core/services/feature-hints.service';

function makeStep(overrides: Partial<SpotlightStep> = {}): SpotlightStep {
  return {
    targetSelector: '.some-el',
    title: 'Step title',
    description: 'Step description',
    position: 'bottom',
    ...overrides,
  };
}

const TWO_STEPS: SpotlightStep[] = [
  makeStep({ title: 'Step 1' }),
  makeStep({ title: 'Step 2' }),
];

const THREE_STEPS: SpotlightStep[] = [
  makeStep({ title: 'Step 1' }),
  makeStep({ title: 'Step 2' }),
  makeStep({ title: 'Step 3' }),
];

describe('SpotlightOverlayComponent', () => {
  let component: SpotlightOverlayComponent;
  let fixture: ComponentFixture<SpotlightOverlayComponent>;

  const mockHintsService = {
    completeSpotlight: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [SpotlightOverlayComponent],
      providers: [{ provide: FeatureHintsService, useValue: mockHintsService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SpotlightOverlayComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
    component.ngOnDestroy();
  });

  it('creates the component', () => {
    fixture.componentRef.setInput('steps', []);
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('next()', () => {
    it('increments currentStepIndex on a non-last step', () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('steps', THREE_STEPS);
      fixture.componentRef.setInput('active', true);
      fixture.detectChanges();
      vi.advanceTimersByTime(100);

      expect(component.currentStepIndex()).toBe(0);

      component.next();

      expect(component.currentStepIndex()).toBe(1);
    });

    it('calls hintsService.completeSpotlight(), sets internalActive false, and emits completed on last step', () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('steps', TWO_STEPS);
      fixture.componentRef.setInput('active', true);
      fixture.detectChanges();
      vi.advanceTimersByTime(100);

      component.currentStepIndex.set(1);

      let completedEmitted = false;
      component.completed.subscribe(() => {
        completedEmitted = true;
      });

      component.next();

      expect(mockHintsService.completeSpotlight).toHaveBeenCalled();
      expect(component.internalActive()).toBe(false);
      expect(completedEmitted).toBe(true);
    });
  });

  describe('prev()', () => {
    it('decrements currentStepIndex when not on step 0', () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('steps', THREE_STEPS);
      fixture.componentRef.setInput('active', true);
      fixture.detectChanges();
      vi.advanceTimersByTime(100);

      component.currentStepIndex.set(2);
      component.prev();

      expect(component.currentStepIndex()).toBe(1);
    });

    it('does nothing when already on step 0', () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('steps', THREE_STEPS);
      fixture.componentRef.setInput('active', true);
      fixture.detectChanges();
      vi.advanceTimersByTime(100);

      component.currentStepIndex.set(0);
      component.prev();

      expect(component.currentStepIndex()).toBe(0);
    });
  });

  describe('skip()', () => {
    it('calls hintsService.completeSpotlight(), sets internalActive false, and emits skipped', () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('steps', TWO_STEPS);
      fixture.componentRef.setInput('active', true);
      fixture.detectChanges();
      vi.advanceTimersByTime(100);

      let skippedEmitted = false;
      component.skipped.subscribe(() => {
        skippedEmitted = true;
      });

      component.skip();

      expect(mockHintsService.completeSpotlight).toHaveBeenCalled();
      expect(component.internalActive()).toBe(false);
      expect(skippedEmitted).toBe(true);
    });
  });

  describe('isLastStep computed', () => {
    it('returns true when on the last step', () => {
      fixture.componentRef.setInput('steps', TWO_STEPS);
      fixture.componentRef.setInput('active', false);
      fixture.detectChanges();

      component.currentStepIndex.set(1);

      expect(component.isLastStep()).toBe(true);
    });

    it('returns false when not on the last step', () => {
      fixture.componentRef.setInput('steps', THREE_STEPS);
      fixture.componentRef.setInput('active', false);
      fixture.detectChanges();

      component.currentStepIndex.set(0);

      expect(component.isLastStep()).toBe(false);
    });
  });

  describe('onEscape()', () => {
    it('calls skip() when active and internalActive', () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('steps', TWO_STEPS);
      fixture.componentRef.setInput('active', true);
      fixture.detectChanges();
      vi.advanceTimersByTime(100);

      const skipSpy = vi.spyOn(component, 'skip');

      component.onEscape();

      expect(skipSpy).toHaveBeenCalled();
    });

    it('does not call skip() when inactive', () => {
      fixture.componentRef.setInput('steps', TWO_STEPS);
      fixture.componentRef.setInput('active', false);
      fixture.detectChanges();

      const skipSpy = vi.spyOn(component, 'skip');

      component.onEscape();

      expect(skipSpy).not.toHaveBeenCalled();
    });
  });
});
