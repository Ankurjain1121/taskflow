import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ContextualHintComponent } from './contextual-hint.component';
import { FeatureHintsService } from '../../../core/services/feature-hints.service';

describe('ContextualHintComponent', () => {
  let component: ContextualHintComponent;
  let fixture: ComponentFixture<ContextualHintComponent>;
  let mockHintsService: {
    isHintDismissed: ReturnType<typeof vi.fn>;
    hintShownThisSession: ReturnType<typeof signal<boolean>>;
    showHint: ReturnType<typeof vi.fn>;
    dismissHint: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockHintsService = {
      isHintDismissed: vi.fn(() => false),
      hintShownThisSession: signal(false),
      showHint: vi.fn(),
      dismissHint: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ContextualHintComponent],
      providers: [{ provide: FeatureHintsService, useValue: mockHintsService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ContextualHintComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('hintId', 'test-hint');
    fixture.componentRef.setInput('message', 'Test hint message');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates with hintId and message inputs', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component.hintId()).toBe('test-hint');
    expect(component.message()).toBe('Test hint message');
  });

  describe('ngOnInit()', () => {
    it('does not show if hint already dismissed', () => {
      vi.useFakeTimers();
      mockHintsService.isHintDismissed.mockReturnValue(true);
      fixture.componentRef.setInput('delayMs', 0);
      fixture.detectChanges();
      component.ngOnInit();

      vi.advanceTimersByTime(100);

      expect(component.visible()).toBe(false);
      expect(mockHintsService.showHint).not.toHaveBeenCalled();

      component.ngOnDestroy();
    });

    it('does not show if another hint shown this session', () => {
      vi.useFakeTimers();
      mockHintsService.hintShownThisSession = signal(true);

      fixture.componentRef.setInput('delayMs', 0);
      fixture.detectChanges();
      component.ngOnInit();

      vi.advanceTimersByTime(100);

      expect(component.visible()).toBe(false);
      expect(mockHintsService.showHint).not.toHaveBeenCalled();

      component.ngOnDestroy();
    });

    it('shows hint after delayMs when conditions are met', () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('delayMs', 500);
      fixture.detectChanges();
      component.ngOnInit();

      expect(component.visible()).toBe(false);

      vi.advanceTimersByTime(500);

      expect(component.visible()).toBe(true);
      expect(mockHintsService.showHint).toHaveBeenCalledWith('test-hint');

      component.ngOnDestroy();
    });

    it('does not show after delay if hint dismissed between init and timer fire', () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('delayMs', 500);
      fixture.detectChanges();
      component.ngOnInit();

      vi.advanceTimersByTime(250);
      // Simulate hint being dismissed while timer is still pending
      mockHintsService.isHintDismissed.mockReturnValue(true);
      vi.advanceTimersByTime(250);

      expect(component.visible()).toBe(false);
      expect(mockHintsService.showHint).not.toHaveBeenCalled();

      component.ngOnDestroy();
    });
  });

  describe('ngOnDestroy()', () => {
    it('clears the pending timer on destroy', () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      fixture.componentRef.setInput('delayMs', 5000);
      fixture.detectChanges();
      component.ngOnInit();

      // Timer must be set at this point
      expect((component as unknown as { timer: unknown }).timer).not.toBeNull();

      component.ngOnDestroy();

      // clearTimeout must have been called during destroy
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('dismiss()', () => {
    it('calls hintsService.dismissHint, sets visible false, and emits dismissed', () => {
      vi.useFakeTimers();
      fixture.componentRef.setInput('delayMs', 0);
      fixture.detectChanges();
      component.ngOnInit();
      vi.advanceTimersByTime(0);

      let dismissedEmitted = false;
      component.dismissed.subscribe(() => {
        dismissedEmitted = true;
      });

      component.dismiss();

      expect(mockHintsService.dismissHint).toHaveBeenCalledWith('test-hint');
      expect(component.visible()).toBe(false);
      expect(dismissedEmitted).toBe(true);

      component.ngOnDestroy();
    });
  });
});
