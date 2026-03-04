import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SaveStatusService } from './save-status.service';

describe('SaveStatusService', () => {
  let service: SaveStatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SaveStatusService],
    });
    service = TestBed.inject(SaveStatusService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('should start with idle state', () => {
      expect(service.state()).toBe('idle');
    });
  });

  describe('markSaving()', () => {
    it('should transition state to saving', () => {
      service.markSaving();
      expect(service.state()).toBe('saving');
    });

    it('should keep state as saving when called twice before markSaved()', () => {
      service.markSaving();
      service.markSaving();
      service.markSaved();
      // pendingCount was 2, now 1 — still saving
      expect(service.state()).toBe('saving');
    });
  });

  describe('markSaved()', () => {
    it('should transition to saved after a single markSaving + markSaved', fakeAsync(() => {
      service.markSaving();
      service.markSaved();
      expect(service.state()).toBe('saved');

      tick(2000);
      expect(service.state()).toBe('idle');
    }));

    it('should return to idle after 2000ms following saved state', fakeAsync(() => {
      service.markSaving();
      service.markSaved();

      tick(1999);
      expect(service.state()).toBe('saved');

      tick(1);
      expect(service.state()).toBe('idle');
    }));

    it('should only trigger saved when the last pending count resolves', fakeAsync(() => {
      service.markSaving();
      service.markSaving();
      service.markSaving();

      service.markSaved();
      // pendingCount = 2 — still saving
      expect(service.state()).toBe('saving');

      service.markSaved();
      // pendingCount = 1 — still saving
      expect(service.state()).toBe('saving');

      service.markSaved();
      // pendingCount = 0 — saved
      expect(service.state()).toBe('saved');

      tick(2000);
      expect(service.state()).toBe('idle');
    }));

    it('should transition to saved even when pendingCount is already 0', fakeAsync(() => {
      // markSaved without a preceding markSaving — pendingCount floors at 0 and saved fires
      service.markSaved();
      expect(service.state()).toBe('saved');

      tick(2000);
      expect(service.state()).toBe('idle');
    }));
  });

  describe('markError()', () => {
    it('should transition state to error after markSaving + markError', fakeAsync(() => {
      service.markSaving();
      service.markError();
      expect(service.state()).toBe('error');

      tick(5000);
      expect(service.state()).toBe('idle');
    }));

    it('should return to idle after 5000ms following error state', fakeAsync(() => {
      service.markSaving();
      service.markError();

      tick(4999);
      expect(service.state()).toBe('error');

      tick(1);
      expect(service.state()).toBe('idle');
    }));
  });

  describe('timer cancellation', () => {
    it('should cancel the idle timer when markSaving is called while saved', fakeAsync(() => {
      service.markSaving();
      service.markSaved();
      expect(service.state()).toBe('saved');

      // Before the 2-second timer fires, start saving again
      tick(500);
      service.markSaving();
      // State is now 'saving' due to pendingCount > 0
      expect(service.state()).toBe('saving');

      // Advance past the original timer duration — should not revert to idle yet
      tick(1600);
      expect(service.state()).toBe('saving');

      // Resolve the new save
      service.markSaved();
      expect(service.state()).toBe('saved');

      tick(2000);
      expect(service.state()).toBe('idle');
    }));
  });
});
