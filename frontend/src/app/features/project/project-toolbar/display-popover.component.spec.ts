import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { DisplayPopoverComponent } from './display-popover.component';
import { COLOR_BY_MODES, type ColorByMode } from '../../../shared/utils/task-colors';

describe('DisplayPopoverComponent', () => {
  let fixture: ComponentFixture<DisplayPopoverComponent>;
  let component: DisplayPopoverComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisplayPopoverComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DisplayPopoverComponent);
    component = fixture.componentInstance;

    // Set required inputs
    fixture.componentRef.setInput('viewMode', 'kanban');
    fixture.componentRef.setInput('cardFields', {
      showPriority: true,
      showDueDate: true,
      showAssignees: true,
      showLabels: true,
      showSubtaskProgress: true,
      showComments: true,
      showAttachments: true,
      showTaskId: true,
      showDescription: true,
      showDaysInColumn: true,
    });
    fixture.componentRef.setInput('colorBy', 'priority');
    fixture.detectChanges();
  });

  // --- Color By section ---

  describe('colorBy input', () => {
    it('should accept a ColorByMode value', () => {
      fixture.componentRef.setInput('colorBy', 'label');
      fixture.detectChanges();
      expect(component.colorBy()).toBe('label');
    });

    it('should default to priority', () => {
      expect(component.colorBy()).toBe('priority');
    });
  });

  describe('colorByChanged output', () => {
    it('should emit when onColorBySelect is called', () => {
      let emitted: ColorByMode | undefined;
      component.colorByChanged.subscribe((val: ColorByMode) => {
        emitted = val;
      });

      component.onColorBySelect('label');
      expect(emitted).toBe('label');
    });
  });

  describe('COLOR_BY_OPTIONS', () => {
    it('should expose color-by options matching COLOR_BY_MODES', () => {
      const optionValues = component.colorByOptions.map((o) => o.value);
      for (const mode of COLOR_BY_MODES) {
        expect(optionValues).toContain(mode);
      }
    });

    it('each option should have a label and icon', () => {
      for (const opt of component.colorByOptions) {
        expect(opt.label.length).toBeGreaterThan(0);
        expect(opt.icon.length).toBeGreaterThan(0);
      }
    });
  });

  describe('hasNonDefaultSettings', () => {
    it('should return true when colorBy is not priority', () => {
      fixture.componentRef.setInput('colorBy', 'label');
      fixture.detectChanges();
      expect(component.hasNonDefaultSettings()).toBe(true);
    });

    it('should return false when all settings are default', () => {
      fixture.componentRef.setInput('density', 'normal');
      fixture.componentRef.setInput('groupBy', 'none');
      fixture.componentRef.setInput('colorBy', 'priority');
      fixture.detectChanges();
      expect(component.hasNonDefaultSettings()).toBe(false);
    });
  });
});
