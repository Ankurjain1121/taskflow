import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { OnboardingChecklistComponent } from './onboarding-checklist.component';
import {
  OnboardingChecklistService,
  ChecklistItem,
} from '../../../core/services/onboarding-checklist.service';
import { Router } from '@angular/router';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';

function makeChecklistItem(
  overrides: Partial<ChecklistItem> = {},
): ChecklistItem {
  return {
    id: 'create_task',
    title: 'Create your first task',
    description: 'Add a task to any board',
    completed: false,
    icon: 'pi-plus',
    ctaLabel: 'Go to Board',
    ctaRoute: '/dashboard',
    ...overrides,
  };
}

describe('OnboardingChecklistComponent', () => {
  let component: OnboardingChecklistComponent;
  let fixture: ComponentFixture<OnboardingChecklistComponent>;

  const mockChecklist = {
    shouldShow: signal(true),
    isDismissed: signal(false),
    isSkipped: signal(false),
    items: signal<ChecklistItem[]>([makeChecklistItem()]),
    completedCount: signal(0),
    totalCount: signal(5),
    progress: signal(0),
    allComplete: signal(false),
    dismiss: vi.fn(),
    reopen: vi.fn(),
    skipAll: vi.fn(),
    markComplete: vi.fn(),
    initialize: vi.fn(),
  };

  const mockRouter = {
    navigate: vi.fn(),
  };

  const mockShortcutsService = {
    helpRequested$: new Subject<void>(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [OnboardingChecklistComponent],
      providers: [
        { provide: OnboardingChecklistService, useValue: mockChecklist },
        { provide: Router, useValue: mockRouter },
        { provide: KeyboardShortcutsService, useValue: mockShortcutsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingChecklistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  describe('onCtaClick()', () => {
    it('calls shortcutsService.helpRequested$.next() when ctaAction is open_shortcuts', () => {
      const nextSpy = vi.spyOn(mockShortcutsService.helpRequested$, 'next');
      const item = makeChecklistItem({
        ctaRoute: undefined,
        ctaAction: 'open_shortcuts',
      });

      component.onCtaClick(item);

      expect(nextSpy).toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('navigates via router.navigate when item has ctaRoute', () => {
      const item = makeChecklistItem({
        ctaRoute: '/dashboard',
        ctaAction: undefined,
      });

      component.onCtaClick(item);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('does nothing when item has neither ctaRoute nor ctaAction', () => {
      const nextSpy = vi.spyOn(mockShortcutsService.helpRequested$, 'next');
      const item = makeChecklistItem({
        ctaRoute: undefined,
        ctaAction: undefined,
      });

      component.onCtaClick(item);

      expect(nextSpy).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('confirmSkip()', () => {
    it('calls checklist.skipAll() and sets showSkipConfirm to false', () => {
      component.showSkipConfirm.set(true);

      component.confirmSkip();

      expect(mockChecklist.skipAll).toHaveBeenCalled();
      expect(component.showSkipConfirm()).toBe(false);
    });
  });
});
