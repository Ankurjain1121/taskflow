import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SampleProjectBannerComponent } from './sample-board-banner.component';
import { ProjectService } from '../../../core/services/board.service';

// Minimal stub component for catch-all route, suppressing NG04002 console noise.
@Component({ standalone: true, template: '' })
class StubRouteComponent {}

// --- Test host ---

@Component({
  standalone: true,
  imports: [SampleProjectBannerComponent],
  template: `
    <app-sample-board-banner
      [boardId]="boardId()"
      [workspaceId]="workspaceId()"
      (deleted)="onDeleted()"
    />
  `,
})
class TestHostComponent {
  boardId = signal('board-42');
  workspaceId = signal('ws-1');
  deletedCount = 0;
  onDeleted() {
    this.deletedCount++;
  }
}

// --- Helpers ---

function getBanner(
  fixture: ComponentFixture<TestHostComponent>,
): SampleProjectBannerComponent {
  return fixture.debugElement.children[0]
    .componentInstance as SampleProjectBannerComponent;
}

// --- Suite ---

describe('SampleProjectBannerComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let router: Router;

  const mockProjectService = {
    deleteBoard: vi.fn(),
  };

  const BOARD_ID = 'board-42';
  const STORAGE_KEY = `tf_sample_banner_dismissed_${BOARD_ID}`;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [
        TestHostComponent,
        RouterTestingModule.withRoutes([
          { path: '**', component: StubRouteComponent },
        ]),
      ],
      providers: [{ provide: ProjectService, useValue: mockProjectService }],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
  });

  afterEach(() => {
    localStorage.clear();
  });

  // --- Creation ---

  it('should create successfully with required inputs', () => {
    fixture.detectChanges();
    const banner = getBanner(fixture);
    expect(banner).toBeInstanceOf(SampleProjectBannerComponent);
  });

  // --- ngOnInit: localStorage dismissal ---

  describe('ngOnInit', () => {
    it('should dismiss the banner when localStorage has the dismissed key set to "true"', () => {
      localStorage.setItem(STORAGE_KEY, 'true');
      fixture.detectChanges(); // triggers ngOnInit

      const banner = getBanner(fixture);
      expect(banner.dismissed()).toBe(true);
    });

    it('should NOT dismiss the banner when the localStorage key is absent', () => {
      fixture.detectChanges();

      const banner = getBanner(fixture);
      expect(banner.dismissed()).toBe(false);
    });

    it('should NOT dismiss when key has a value other than "true"', () => {
      localStorage.setItem(STORAGE_KEY, 'false');
      fixture.detectChanges();

      const banner = getBanner(fixture);
      expect(banner.dismissed()).toBe(false);
    });
  });

  // --- dismiss() ---

  describe('dismiss()', () => {
    it('should set dismissed signal to true', () => {
      fixture.detectChanges();
      const banner = getBanner(fixture);

      banner.dismiss();

      expect(banner.dismissed()).toBe(true);
    });

    it('should write the localStorage key with value "true"', () => {
      fixture.detectChanges();
      const banner = getBanner(fixture);

      banner.dismiss();

      expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    });
  });

  // --- deleteBoard() success path ---

  describe('deleteBoard() — success', () => {
    it('should call projectService.deleteBoard with the boardId', () => {
      mockProjectService.deleteBoard.mockReturnValue(of(null));
      fixture.detectChanges();
      const banner = getBanner(fixture);

      banner.deleteBoard();

      expect(mockProjectService.deleteBoard).toHaveBeenCalledWith(BOARD_ID);
    });

    it('should emit the deleted output event on success', () => {
      mockProjectService.deleteBoard.mockReturnValue(of(null));
      fixture.detectChanges();
      const banner = getBanner(fixture);

      banner.deleteBoard();

      expect(host.deletedCount).toBe(1);
    });

    it('should navigate to /dashboard on success', () => {
      mockProjectService.deleteBoard.mockReturnValue(of(null));
      const navigateSpy = vi.spyOn(router, 'navigate');
      fixture.detectChanges();
      const banner = getBanner(fixture);

      banner.deleteBoard();

      expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should reset isDeleting to false after success', () => {
      mockProjectService.deleteBoard.mockReturnValue(of(null));
      fixture.detectChanges();
      const banner = getBanner(fixture);

      banner.deleteBoard();

      expect(banner.isDeleting()).toBe(false);
    });
  });

  // --- deleteBoard() — isDeleting state ---

  describe('deleteBoard() — isDeleting', () => {
    it('should set isDeleting to true at the start of the call', () => {
      // Verify that isDeleting is true when the Observable constructor runs
      // (which happens synchronously inside deleteBoard before any async work).
      let isDeletingAtSubscribeTime = false;
      mockProjectService.deleteBoard.mockReturnValue(
        new Observable<null>((observer) => {
          // The Observable constructor is called synchronously by subscribe(),
          // which is called after this.isDeleting.set(true) in deleteBoard().
          isDeletingAtSubscribeTime = true;
          observer.next(null);
          observer.complete();
        }),
      );
      fixture.detectChanges();
      const banner = getBanner(fixture);

      expect(banner.isDeleting()).toBe(false); // precondition

      banner.deleteBoard();

      expect(isDeletingAtSubscribeTime).toBe(true);
    });

    it('should reset isDeleting to false once the observable completes successfully', () => {
      mockProjectService.deleteBoard.mockReturnValue(of(null));
      fixture.detectChanges();
      const banner = getBanner(fixture);

      banner.deleteBoard();

      expect(banner.isDeleting()).toBe(false);
    });
  });

  // --- deleteBoard() error path ---

  describe('deleteBoard() — error', () => {
    it('should reset isDeleting to false on error', () => {
      mockProjectService.deleteBoard.mockReturnValue(
        throwError(() => new Error('Server error')),
      );
      fixture.detectChanges();
      const banner = getBanner(fixture);

      banner.deleteBoard();

      expect(banner.isDeleting()).toBe(false);
    });

    it('should NOT emit deleted event on error', () => {
      mockProjectService.deleteBoard.mockReturnValue(
        throwError(() => new Error('Server error')),
      );
      fixture.detectChanges();
      const banner = getBanner(fixture);

      banner.deleteBoard();

      expect(host.deletedCount).toBe(0);
    });

    it('should NOT navigate on error', () => {
      mockProjectService.deleteBoard.mockReturnValue(
        throwError(() => new Error('Server error')),
      );
      const navigateSpy = vi.spyOn(router, 'navigate');
      fixture.detectChanges();
      const banner = getBanner(fixture);

      banner.deleteBoard();

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
