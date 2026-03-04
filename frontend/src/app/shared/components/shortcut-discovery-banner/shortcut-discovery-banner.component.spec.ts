import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ShortcutDiscoveryBannerComponent } from './shortcut-discovery-banner.component';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';

const MODAL_OPENED_KEY = 'tf_shortcut_modal_opened';
const BANNER_DISMISSED_KEY = 'tf_shortcut_dismissed_banner';

describe('ShortcutDiscoveryBannerComponent', () => {
  let component: ShortcutDiscoveryBannerComponent;
  let fixture: ComponentFixture<ShortcutDiscoveryBannerComponent>;
  let mockShortcutsService: { helpRequested$: Subject<void> };

  beforeEach(async () => {
    localStorage.clear();

    mockShortcutsService = {
      helpRequested$: new Subject<void>(),
    };

    await TestBed.configureTestingModule({
      imports: [ShortcutDiscoveryBannerComponent],
      providers: [
        { provide: KeyboardShortcutsService, useValue: mockShortcutsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShortcutDiscoveryBannerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
    component.ngOnDestroy();
  });

  it('creates the component', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('ngOnInit()', () => {
    it('shows the banner when neither localStorage key is set', () => {
      vi.useFakeTimers();
      fixture.detectChanges();
      component.ngOnInit();

      expect(component.visible()).toBe(true);
    });

    it('does NOT show when tf_shortcut_modal_opened is set', () => {
      vi.useFakeTimers();
      localStorage.setItem(MODAL_OPENED_KEY, '1');
      fixture.detectChanges();
      component.ngOnInit();

      expect(component.visible()).toBe(false);
    });

    it('does NOT show when tf_shortcut_dismissed_banner is set', () => {
      vi.useFakeTimers();
      localStorage.setItem(BANNER_DISMISSED_KEY, '1');
      fixture.detectChanges();
      component.ngOnInit();

      expect(component.visible()).toBe(false);
    });

    it('auto-dismisses after 8000ms', () => {
      vi.useFakeTimers();
      fixture.detectChanges();
      component.ngOnInit();

      expect(component.visible()).toBe(true);

      vi.advanceTimersByTime(8001);

      expect(component.visible()).toBe(false);
    });
  });

  describe('dismiss()', () => {
    it('sets visible to false and writes the dismissed key to localStorage', () => {
      vi.useFakeTimers();
      fixture.detectChanges();
      component.ngOnInit();
      expect(component.visible()).toBe(true);

      component.dismiss();

      expect(component.visible()).toBe(false);
      expect(localStorage.getItem(BANNER_DISMISSED_KEY)).toBe('1');
    });
  });

  describe('helpRequested$ subscription', () => {
    it('hides the banner when helpRequested$ emits', () => {
      vi.useFakeTimers();
      fixture.detectChanges();
      component.ngOnInit();
      expect(component.visible()).toBe(true);

      mockShortcutsService.helpRequested$.next();

      expect(component.visible()).toBe(false);
    });
  });
});
