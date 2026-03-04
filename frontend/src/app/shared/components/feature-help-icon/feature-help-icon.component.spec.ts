import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FeatureHelpIconComponent } from './feature-help-icon.component';

// --- Test host ---
// input.required() must be supplied from a parent template.

@Component({
  standalone: true,
  imports: [FeatureHelpIconComponent],
  template: `
    <app-feature-help-icon
      [title]="title()"
      [description]="description()"
      [shortcutKey]="shortcutKey()"
    />
  `,
})
class TestHostComponent {
  title = signal('Card Density');
  description = signal('Controls how much information is shown on each card.');
  shortcutKey = signal('');
}

// --- Helpers ---

function getComponent(
  fixture: ComponentFixture<TestHostComponent>,
): FeatureHelpIconComponent {
  return fixture.debugElement.query(By.directive(FeatureHelpIconComponent))
    .componentInstance as FeatureHelpIconComponent;
}

function makeClickEvent(
  target: EventTarget | null = document.body,
): MouseEvent {
  return { target, stopPropagation: vi.fn() } as unknown as MouseEvent;
}

// --- Suite ---

describe('FeatureHelpIconComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let component: FeatureHelpIconComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    component = getComponent(fixture);
  });

  // --- Creation ---

  it('should create successfully with required inputs (title and description)', () => {
    expect(component).toBeInstanceOf(FeatureHelpIconComponent);
    expect(component.title()).toBe('Card Density');
    expect(component.description()).toBe(
      'Controls how much information is shown on each card.',
    );
  });

  // --- Initial open state ---

  describe('open signal', () => {
    it('should start as false', () => {
      expect(component.open()).toBe(false);
    });
  });

  // --- toggle() ---

  describe('toggle()', () => {
    it('should set open to true on first call', () => {
      const event = makeClickEvent();
      component.toggle(event);
      expect(component.open()).toBe(true);
    });

    it('should call stopPropagation on the event', () => {
      const event = makeClickEvent();
      const stopSpy = vi.spyOn(event, 'stopPropagation');
      component.toggle(event);
      expect(stopSpy).toHaveBeenCalledOnce();
    });

    it('should set open back to false on second call (toggle behaviour)', () => {
      const event = makeClickEvent();
      component.toggle(event);
      component.toggle(event);
      expect(component.open()).toBe(false);
    });

    it('should alternate open state on each subsequent call', () => {
      const event = makeClickEvent();
      component.toggle(event); // true
      component.toggle(event); // false
      component.toggle(event); // true
      expect(component.open()).toBe(true);
    });
  });

  // --- onDocClick() ---

  describe('onDocClick()', () => {
    it('should close the popover when clicking outside the component element', () => {
      const toggleEvent = makeClickEvent();
      component.toggle(toggleEvent); // open it first
      expect(component.open()).toBe(true);

      // Click target is outside the component's native element
      const outsideElement = document.createElement('div');
      const docClickEvent = makeClickEvent(outsideElement);
      component.onDocClick(docClickEvent);

      expect(component.open()).toBe(false);
    });

    it('should NOT close when clicking inside the component element', () => {
      const toggleEvent = makeClickEvent();
      component.toggle(toggleEvent); // open it first

      // The button inside the component is part of nativeElement
      const button = fixture.nativeElement.querySelector('button');
      const docClickEvent = makeClickEvent(button);
      component.onDocClick(docClickEvent);

      // Still open — target was inside the component
      expect(component.open()).toBe(true);
    });

    it('should do nothing when open is false', () => {
      expect(component.open()).toBe(false);

      const outsideElement = document.createElement('div');
      const docClickEvent = makeClickEvent(outsideElement);
      component.onDocClick(docClickEvent);

      // remains false — no state change
      expect(component.open()).toBe(false);
    });
  });

  // --- onEscape() ---

  describe('onEscape()', () => {
    it('should close an open popover', () => {
      const toggleEvent = makeClickEvent();
      component.toggle(toggleEvent); // open it
      expect(component.open()).toBe(true);

      component.onEscape();

      expect(component.open()).toBe(false);
    });

    it('should remain closed when already closed', () => {
      expect(component.open()).toBe(false);
      component.onEscape();
      expect(component.open()).toBe(false);
    });
  });

  // --- Popover rendering ---

  describe('popover rendering', () => {
    it('should not render popover content when open is false', () => {
      fixture.detectChanges();
      const popover = fixture.nativeElement.querySelector(
        '.absolute.bottom-full',
      );
      expect(popover).toBeNull();
    });

    it('should render popover content when open is true', () => {
      const event = makeClickEvent();
      component.toggle(event);
      fixture.detectChanges();

      const popover = fixture.nativeElement.querySelector(
        '.absolute.bottom-full',
      );
      expect(popover).toBeTruthy();
    });

    it('should render title and description inside the popover', () => {
      const event = makeClickEvent();
      component.toggle(event);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Card Density');
      expect(text).toContain(
        'Controls how much information is shown on each card.',
      );
    });

    it('should render shortcutKey inside a kbd element when provided', () => {
      host.shortcutKey.set('D');
      fixture.detectChanges();

      const event = makeClickEvent();
      component.toggle(event);
      fixture.detectChanges();

      const kbd = fixture.nativeElement.querySelector('kbd');
      expect(kbd).toBeTruthy();
      expect(kbd.textContent.trim()).toBe('D');
    });

    it('should NOT render a kbd element when shortcutKey is empty', () => {
      // shortcutKey defaults to ''
      const event = makeClickEvent();
      component.toggle(event);
      fixture.detectChanges();

      const kbd = fixture.nativeElement.querySelector('kbd');
      expect(kbd).toBeNull();
    });
  });
});
