import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  SummaryNumbersComponent,
  SummaryStats,
} from './summary-numbers.component';

describe('SummaryNumbersComponent', () => {
  let component: SummaryNumbersComponent;
  let fixture: ComponentFixture<SummaryNumbersComponent>;

  const mockStats: SummaryStats = {
    totalTasks: 50,
    completedThisWeek: 12,
    completedLastWeek: 8,
    overdueTasks: 3,
    overdueLastWeek: 5,
    completionRate: 75,
    completionRateLastWeek: 60,
  };

  beforeEach(async () => {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    await TestBed.configureTestingModule({
      imports: [SummaryNumbersComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SummaryNumbersComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('cards computed signal', () => {
    it('should generate 4 cards', () => {
      expect(component.cards().length).toBe(4);
    });

    it('should have Total Tasks card', () => {
      const totalCard = component
        .cards()
        .find((c) => c.label === 'Total Tasks');
      expect(totalCard).toBeTruthy();
      expect(totalCard!.value).toBe(50);
      expect(totalCard!.isPercentage).toBe(false);
    });

    it('should have Completed This Week card with trend', () => {
      const completedCard = component
        .cards()
        .find((c) => c.label === 'Completed This Week');
      expect(completedCard).toBeTruthy();
      expect(completedCard!.value).toBe(12);
      // Trend: (12 - 8) / 8 * 100 = 50%
      expect(completedCard!.trend).toBe(50);
      expect(completedCard!.trendPositive).toBe(true);
    });

    it('should have Overdue card with negative trend', () => {
      const overdueCard = component.cards().find((c) => c.label === 'Overdue');
      expect(overdueCard).toBeTruthy();
      expect(overdueCard!.value).toBe(3);
      // Trend: (3 - 5) / 5 * 100 = -40%
      expect(overdueCard!.trend).toBe(-40);
      expect(overdueCard!.trendPositive).toBe(false);
    });

    it('should have Completion Rate card as percentage', () => {
      const rateCard = component
        .cards()
        .find((c) => c.label === 'Completion Rate');
      expect(rateCard).toBeTruthy();
      expect(rateCard!.value).toBe(75);
      expect(rateCard!.isPercentage).toBe(true);
      // Trend: 75 - 60 = 15
      expect(rateCard!.trend).toBe(15);
    });

    it('should compute 0 trend when last week is 0', () => {
      fixture.componentRef.setInput('stats', {
        ...mockStats,
        completedLastWeek: 0,
        overdueLastWeek: 0,
        completionRateLastWeek: 0,
      });
      fixture.detectChanges();
      const completedCard = component
        .cards()
        .find((c) => c.label === 'Completed This Week');
      expect(completedCard!.trend).toBe(0);
    });
  });
});
