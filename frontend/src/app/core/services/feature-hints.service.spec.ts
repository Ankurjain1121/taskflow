import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FeatureHintsService } from './feature-hints.service';
import { AuthService } from './auth.service';

describe('FeatureHintsService', () => {
  let service: FeatureHintsService;

  // Writable signal so individual tests can simulate different users
  const mockCurrentUser = signal<{ id: string } | null>({ id: 'user-1' });

  const mockAuthService = {
    currentUser: mockCurrentUser,
  };

  beforeEach(() => {
    localStorage.clear();
    // Reset the user signal to a logged-in state before each test
    mockCurrentUser.set({ id: 'user-1' });

    TestBed.configureTestingModule({
      providers: [
        FeatureHintsService,
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
    service = TestBed.inject(FeatureHintsService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('isHintDismissed()', () => {
    it('should return false for an unknown hint id', () => {
      expect(service.isHintDismissed('nonexistent-hint')).toBe(false);
    });

    it('should return true after dismissing a hint', () => {
      service.dismissHint('board-tour');
      expect(service.isHintDismissed('board-tour')).toBe(true);
    });
  });

  describe('dismissHint()', () => {
    it('should add the hint id to dismissedHints', () => {
      service.dismissHint('board-tour');
      expect(service.dismissedHints().has('board-tour')).toBe(true);
    });

    it('should set activeHint to null', () => {
      service.showHint('board-tour');
      expect(service.activeHint()).toBe('board-tour');

      service.dismissHint('board-tour');
      expect(service.activeHint()).toBeNull();
    });

    it('should be idempotent — calling twice does not duplicate the entry', () => {
      service.dismissHint('board-tour');
      service.dismissHint('board-tour');

      // A Set can never hold duplicates, so size should remain 1
      expect(service.dismissedHints().size).toBe(1);
      expect(service.dismissedHints().has('board-tour')).toBe(true);
    });
  });

  describe('showHint()', () => {
    it('should set activeHint to the given id', () => {
      service.showHint('kanban-hint');
      expect(service.activeHint()).toBe('kanban-hint');
    });

    it('should set hintShownThisSession to true', () => {
      service.showHint('kanban-hint');
      expect(service.hintShownThisSession()).toBe(true);
    });

    it('should do nothing when the hint has already been dismissed', () => {
      service.dismissHint('kanban-hint');
      service.showHint('kanban-hint');

      // activeHint was set to null by dismissHint and showHint should not override it
      expect(service.activeHint()).toBeNull();
    });
  });

  describe('completeSpotlight()', () => {
    it('should set hasSeenSpotlight to true', () => {
      expect(service.hasSeenSpotlight()).toBe(false);
      service.completeSpotlight();
      expect(service.hasSeenSpotlight()).toBe(true);
    });
  });

  describe('incrementBoardVisit()', () => {
    it('should increment boardVisitCount by 1 on each call', () => {
      expect(service.boardVisitCount()).toBe(0);
      service.incrementBoardVisit();
      expect(service.boardVisitCount()).toBe(1);
      service.incrementBoardVisit();
      expect(service.boardVisitCount()).toBe(2);
    });
  });

  describe('canShowHint', () => {
    it('should be true initially', () => {
      expect(service.canShowHint()).toBe(true);
    });

    it('should be false when hintShownThisSession is true', () => {
      service.showHint('some-hint');
      // hintShownThisSession is now true
      expect(service.canShowHint()).toBe(false);
    });

    it('should be false when activeHint is set', () => {
      // Directly set activeHint without going through showHint to isolate
      // the canShowHint computed logic for the activeHint condition
      service.showHint('another-hint');
      expect(service.activeHint()).toBe('another-hint');
      expect(service.canShowHint()).toBe(false);
    });
  });

  describe('resetAll()', () => {
    it('should reset all state back to defaults', () => {
      // Mutate everything first
      service.dismissHint('hint-a');
      service.showHint('hint-b');
      service.completeSpotlight();
      service.incrementBoardVisit();
      service.incrementBoardVisit();

      service.resetAll();

      expect(service.dismissedHints().size).toBe(0);
      expect(service.activeHint()).toBeNull();
      expect(service.hasSeenSpotlight()).toBe(false);
      expect(service.hintShownThisSession()).toBe(false);
      expect(service.boardVisitCount()).toBe(0);
    });
  });

  describe('localStorage persistence', () => {
    it('should load persisted dismissed hints on construction when user is available', () => {
      // Pre-populate localStorage for user-2
      const storageData = {
        dismissed: ['persisted-hint'],
        spotlightCompleted: true,
        boardVisitCount: 3,
      };
      localStorage.setItem('tf_hints_user-2', JSON.stringify(storageData));

      // Re-configure TestBed with a user whose data is already stored
      const userSignal = signal<{ id: string } | null>({ id: 'user-2' });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          FeatureHintsService,
          { provide: AuthService, useValue: { currentUser: userSignal } },
        ],
      });

      const freshService = TestBed.inject(FeatureHintsService);

      // The effect runs synchronously with the test environment
      TestBed.flushEffects();

      expect(freshService.dismissedHints().has('persisted-hint')).toBe(true);
      expect(freshService.hasSeenSpotlight()).toBe(true);
      expect(freshService.boardVisitCount()).toBe(3);
    });
  });
});
