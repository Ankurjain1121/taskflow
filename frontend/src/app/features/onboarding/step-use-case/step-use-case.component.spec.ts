import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { StepUseCaseComponent } from './step-use-case.component';

// --- Suite ---

describe('StepUseCaseComponent', () => {
  let fixture: ComponentFixture<StepUseCaseComponent>;
  let component: StepUseCaseComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepUseCaseComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StepUseCaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // --- Creation ---

  it('should create successfully', () => {
    expect(component).toBeInstanceOf(StepUseCaseComponent);
  });

  // --- Use cases ---

  describe('useCases', () => {
    it('should have exactly 4 use cases', () => {
      expect(component.useCases).toHaveLength(4);
    });

    it('should include software, marketing, personal, and design use cases', () => {
      const ids = component.useCases.map((uc) => uc.id);
      expect(ids).toContain('software');
      expect(ids).toContain('marketing');
      expect(ids).toContain('personal');
      expect(ids).toContain('design');
    });
  });

  // --- Initial state ---

  describe('initial state', () => {
    it('selectedUseCase should start as null', () => {
      expect(component.selectedUseCase()).toBeNull();
    });
  });

  // --- select() ---

  describe('select()', () => {
    it('should set selectedUseCase signal to the provided id', () => {
      component.select('software');
      expect(component.selectedUseCase()).toBe('software');
    });

    it('should update selectedUseCase when called again with a different id', () => {
      component.select('marketing');
      component.select('design');
      expect(component.selectedUseCase()).toBe('design');
    });
  });

  // --- Continue button state ---

  describe('Continue button', () => {
    it('should be disabled when no use case is selected', () => {
      fixture.detectChanges();
      const continueBtn = fixture.debugElement
        .queryAll(By.css('button'))
        .find((btn) => btn.nativeElement.textContent.trim() === 'Continue');
      expect(continueBtn).toBeTruthy();
      expect(continueBtn!.nativeElement.disabled).toBe(true);
    });

    it('should be enabled after a use case is selected', () => {
      component.select('personal');
      fixture.detectChanges();

      const continueBtn = fixture.debugElement
        .queryAll(By.css('button'))
        .find((btn) => btn.nativeElement.textContent.trim() === 'Continue');
      expect(continueBtn).toBeTruthy();
      expect(continueBtn!.nativeElement.disabled).toBe(false);
    });
  });

  // --- onContinue() ---

  describe('onContinue()', () => {
    it('should emit completed with the selected use case id', () => {
      const emitted: string[] = [];
      component.completed.subscribe((value) => emitted.push(value));

      component.select('marketing');
      component.onContinue();

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toBe('marketing');
    });

    it('should NOT emit completed when selectedUseCase is null', () => {
      const emitted: string[] = [];
      component.completed.subscribe((value) => emitted.push(value));

      // selectedUseCase is null by default
      component.onContinue();

      expect(emitted).toHaveLength(0);
    });

    it('should emit the exact id that was selected, not a default', () => {
      const emitted: string[] = [];
      component.completed.subscribe((value) => emitted.push(value));

      component.select('design');
      component.onContinue();

      expect(emitted[0]).toBe('design');
    });
  });

  // --- onSkip() ---

  describe('onSkip()', () => {
    it('should emit the skipped event', () => {
      let skippedFired = false;
      component.skipped.subscribe(() => {
        skippedFired = true;
      });

      component.onSkip();

      expect(skippedFired).toBe(true);
    });

    it('should emit skipped regardless of whether a use case was selected', () => {
      let skippedCount = 0;
      component.skipped.subscribe(() => skippedCount++);

      component.select('software');
      component.onSkip();

      expect(skippedCount).toBe(1);
    });
  });
});
