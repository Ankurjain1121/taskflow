import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ListViewComponent } from './list-view.component';

describe('ListViewComponent', () => {
  let component: ListViewComponent;
  let fixture: ComponentFixture<ListViewComponent>;

  beforeEach(async () => {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false, media: query, onchange: null,
          addListener: vi.fn(), removeListener: vi.fn(),
          addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        })),
      });
    }

    await TestBed.configureTestingModule({
      imports: [ListViewComponent],
      providers: [provideRouter([])],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ListViewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getPriorityHexColor', () => {
    it('should return a color string for known priorities', () => {
      const color = component.getPriorityHexColor('urgent');
      expect(color).toBeTruthy();
      expect(typeof color).toBe('string');
    });

    it('should return a color for medium priority', () => {
      expect(component.getPriorityHexColor('medium')).toBeTruthy();
    });
  });

  describe('getPriorityLabelText', () => {
    it('should return human-readable label', () => {
      const label = component.getPriorityLabelText('urgent');
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });

    it('should return label for low priority', () => {
      expect(component.getPriorityLabelText('low')).toBeTruthy();
    });
  });

  describe('getDueDateColorClass', () => {
    it('should return CSS class strings for a date', () => {
      const cls = component.getDueDateColorClass('2026-01-01');
      expect(typeof cls).toBe('string');
    });

    it('should handle null due date', () => {
      const cls = component.getDueDateColorClass(null);
      expect(typeof cls).toBe('string');
    });
  });

  describe('onRowClick', () => {
    it('should emit taskClicked with task id', () => {
      const emitSpy = vi.spyOn(component.taskClicked, 'emit');
      const task = { id: 'task-1', title: 'Test' } as any;
      component.onRowClick(task);
      expect(emitSpy).toHaveBeenCalledWith('task-1');
    });
  });

  describe('formatDueDate', () => {
    it('should return "Today" for today\'s date', () => {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(component.formatDueDate(dateStr)).toBe('Today');
    });

    it('should return "Tomorrow" for tomorrow\'s date', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
      expect(component.formatDueDate(dateStr)).toBe('Tomorrow');
    });

    it('should return "Overdue (Xd)" for past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);
      const dateStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`;
      const result = component.formatDueDate(dateStr);
      expect(result).toMatch(/Overdue/);
    });

    it('should return formatted date for future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const dateStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
      const result = component.formatDueDate(dateStr);
      // Should be like "Jan 15" or "Feb 3"
      expect(result).not.toBe('Today');
      expect(result).not.toBe('Tomorrow');
      expect(result).not.toMatch(/Overdue/);
    });
  });

  describe('formatDate', () => {
    it('should format date string', () => {
      const result = component.formatDate('2026-03-15');
      expect(result).toContain('Mar');
      expect(result).toContain('15');
      expect(result).toContain('2026');
    });
  });
});
