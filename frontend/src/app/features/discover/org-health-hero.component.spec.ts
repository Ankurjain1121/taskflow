import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrgHealthHeroComponent } from './org-health-hero.component';
import { Component } from '@angular/core';

// Wrapper component to provide required inputs
@Component({
  standalone: true,
  imports: [OrgHealthHeroComponent],
  template: `
    <app-org-health-hero
      [score]="score"
      [label]="label"
      [color]="color"
      [totalProjects]="totalProjects"
      [onTimePct]="onTimePct"
      [totalOverdue]="totalOverdue"
      [totalMembers]="totalMembers"
      [totalCompleted]="totalCompleted"
      [onTimePrevious]="onTimePrevious"
      [overdueAging]="overdueAging"
      [onTimeCount]="onTimeCount"
    />
  `,
})
class TestHostComponent {
  score = 85;
  label = 'Healthy';
  color = '#5E8C4A';
  totalProjects = 12;
  onTimePct = 78;
  totalOverdue = 3;
  totalMembers = 8;
  totalCompleted = 20;
  onTimePrevious: { pct: number; label: string } | null = null;
  overdueAging = { critical: 1, recent: 2 };
  onTimeCount = 15;
}

describe('OrgHealthHeroComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('should create', () => {
    const heroEl = el.querySelector('app-org-health-hero');
    expect(heroEl).toBeTruthy();
  });

  describe('onTimeTooltip computed', () => {
    it('should return no-data message when totalCompleted is 0', () => {
      host.totalCompleted = 0;
      host.onTimeCount = 0;
      fixture.detectChanges();

      const heroComponent = fixture.debugElement.children[0].componentInstance as OrgHealthHeroComponent;
      expect(heroComponent.onTimeTooltip()).toBe(
        'No tasks with due dates completed in this period',
      );
    });

    it('should return breakdown when totalCompleted > 0', () => {
      host.totalCompleted = 20;
      host.onTimeCount = 15;
      fixture.detectChanges();

      const heroComponent = fixture.debugElement.children[0].componentInstance as OrgHealthHeroComponent;
      expect(heroComponent.onTimeTooltip()).toBe(
        'On time: 15 | Late: 5 | Total: 20',
      );
    });
  });

  describe('absDiff', () => {
    it('should return absolute difference', () => {
      const heroComponent = fixture.debugElement.children[0].componentInstance as OrgHealthHeroComponent;
      expect(heroComponent.absDiff(10, 3)).toBe(7);
      expect(heroComponent.absDiff(3, 10)).toBe(7);
      expect(heroComponent.absDiff(5, 5)).toBe(0);
    });
  });

  describe('template rendering', () => {
    it('should display the health score', () => {
      const scoreEl = el.querySelector('.text-5xl');
      expect(scoreEl?.textContent?.trim()).toBe('85');
    });

    it('should display the health label', () => {
      const labelEl = el.querySelector('.rounded-full');
      expect(labelEl?.textContent?.trim()).toBe('Healthy');
    });

    it('should display stat cards with correct values', () => {
      const statValues = el.querySelectorAll('.stat-value');
      expect(statValues.length).toBe(4);
      expect(statValues[0].textContent?.trim()).toBe('12'); // totalProjects
      expect(statValues[1].textContent?.trim()).toBe('78%'); // onTimePct
      expect(statValues[2].textContent?.trim()).toBe('3'); // totalOverdue
      expect(statValues[3].textContent?.trim()).toBe('8'); // totalMembers
    });

    it('should show dash when totalCompleted is 0', () => {
      host.totalCompleted = 0;
      fixture.detectChanges();

      // The on-time stat card should show mdash instead of percentage
      const statCards = el.querySelectorAll('.stat-card');
      const onTimeCard = statCards[1];
      const value = onTimeCard.querySelector('.stat-value');
      // mdash character
      expect(value?.textContent?.trim()).toBe('\u2014');
    });

    it('should show overdue aging details when overdue > 0', () => {
      host.totalOverdue = 5;
      host.overdueAging = { critical: 2, recent: 3 };
      fixture.detectChanges();

      const html = el.innerHTML;
      expect(html).toContain('2 critical');
      expect(html).toContain('3 recent');
    });

    it('should show previous period comparison when onTimePrevious is set', () => {
      host.onTimePrevious = { pct: 70, label: 'Last Month' };
      fixture.detectChanges();

      const html = el.innerHTML;
      expect(html).toContain('Last Month');
    });

    it('should not show previous period comparison when onTimePrevious is null', () => {
      host.onTimePrevious = null;
      fixture.detectChanges();

      const html = el.innerHTML;
      expect(html).not.toContain('vs');
    });
  });
});
