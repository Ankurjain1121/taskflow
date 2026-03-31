import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrgPeopleVelocityComponent } from './org-people-velocity.component';
import { Component } from '@angular/core';
import { MemberWorkload } from '../../core/services/team.service';
import { VelocityPoint } from '../../core/services/dashboard.service';

function makeWorkload(overrides: Partial<MemberWorkload> = {}): MemberWorkload {
  return {
    user_id: 'u-1',
    user_name: 'Alice Smith',
    user_avatar: null,
    active_tasks: 5,
    overdue_tasks: 1,
    due_today: 0,
    due_this_week: 2,
    done_tasks: 10,
    total_tasks: 15,
    is_overloaded: false,
    ...overrides,
  };
}

function makeVelocity(weekStart: string, tasks: number): VelocityPoint {
  return { week_start: weekStart, tasks_completed: tasks };
}

@Component({
  standalone: true,
  imports: [OrgPeopleVelocityComponent],
  template: `
    <app-org-people-velocity
      [workloads]="workloads"
      [velocity]="velocity"
      [onTimePct]="onTimePct"
    />
  `,
})
class TestHostComponent {
  workloads: MemberWorkload[] = [];
  velocity: VelocityPoint[] = [];
  onTimePct = 80;
}

describe('OrgPeopleVelocityComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;
  let comp: OrgPeopleVelocityComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
    comp = fixture.debugElement.children[0].componentInstance as OrgPeopleVelocityComponent;
  });

  it('should create', () => {
    expect(el.querySelector('app-org-people-velocity')).toBeTruthy();
  });

  describe('topMembers computed', () => {
    it('should return empty array when no workloads', () => {
      expect(comp.topMembers()).toEqual([]);
    });

    it('should sort by active_tasks descending and limit to 8', () => {
      const members = Array.from({ length: 12 }, (_, i) =>
        makeWorkload({ user_id: `u-${i}`, user_name: `User ${i}`, active_tasks: i }),
      );
      host.workloads = members;
      fixture.detectChanges();

      const top = comp.topMembers();
      expect(top.length).toBe(8);
      expect(top[0].active_tasks).toBe(11);
      expect(top[7].active_tasks).toBe(4);
    });
  });

  describe('overloadedCount computed', () => {
    it('should return 0 when no members are overloaded', () => {
      host.workloads = [makeWorkload({ active_tasks: 5 })];
      fixture.detectChanges();
      expect(comp.overloadedCount()).toBe(0);
    });

    it('should count members with 10+ active tasks', () => {
      host.workloads = [
        makeWorkload({ user_id: 'u-1', active_tasks: 10 }),
        makeWorkload({ user_id: 'u-2', active_tasks: 15 }),
        makeWorkload({ user_id: 'u-3', active_tasks: 3 }),
      ];
      fixture.detectChanges();
      expect(comp.overloadedCount()).toBe(2);
    });
  });

  describe('latestVelocity computed', () => {
    it('should return 0 when no velocity data', () => {
      expect(comp.latestVelocity()).toBe(0);
    });

    it('should return tasks_completed of last entry', () => {
      host.velocity = [
        makeVelocity('2026-03-01', 10),
        makeVelocity('2026-03-08', 15),
      ];
      fixture.detectChanges();
      expect(comp.latestVelocity()).toBe(15);
    });
  });

  describe('velocityTrend computed', () => {
    it('should return 0 when fewer than 5 data points', () => {
      host.velocity = [
        makeVelocity('2026-03-01', 10),
        makeVelocity('2026-03-08', 15),
      ];
      fixture.detectChanges();
      expect(comp.velocityTrend()).toBe(0);
    });

    it('should calculate percentage change between recent 4 and previous 4 weeks', () => {
      // prev4: 10+10+10+10 = 40, recent4: 15+15+15+15 = 60
      // trend = ((60-40)/40)*100 = 50%
      host.velocity = [
        makeVelocity('w1', 10),
        makeVelocity('w2', 10),
        makeVelocity('w3', 10),
        makeVelocity('w4', 10),
        makeVelocity('w5', 15),
        makeVelocity('w6', 15),
        makeVelocity('w7', 15),
        makeVelocity('w8', 15),
      ];
      fixture.detectChanges();
      expect(comp.velocityTrend()).toBe(50);
    });

    it('should return 0 when prev4 sum is 0', () => {
      host.velocity = [
        makeVelocity('w1', 0),
        makeVelocity('w2', 0),
        makeVelocity('w3', 0),
        makeVelocity('w4', 0),
        makeVelocity('w5', 10),
      ];
      fixture.detectChanges();
      expect(comp.velocityTrend()).toBe(0);
    });
  });

  describe('getInitials', () => {
    it('should return initials from full name', () => {
      expect(comp.getInitials('Alice Smith')).toBe('AS');
    });

    it('should handle single name', () => {
      expect(comp.getInitials('Alice')).toBe('A');
    });

    it('should handle empty string', () => {
      expect(comp.getInitials('')).toBe('?');
    });

    it('should limit to 2 characters', () => {
      expect(comp.getInitials('John Michael Smith')).toBe('JM');
    });
  });

  describe('getBarWidth', () => {
    it('should return proportional width', () => {
      host.workloads = [makeWorkload({ active_tasks: 10 })];
      fixture.detectChanges();
      expect(comp.getBarWidth(5)).toBe(50);
    });

    it('should cap at 100', () => {
      host.workloads = [makeWorkload({ active_tasks: 5 })];
      fixture.detectChanges();
      expect(comp.getBarWidth(200)).toBe(100);
    });
  });

  describe('getSparkHeight', () => {
    it('should return proportional height based on max velocity', () => {
      host.velocity = [
        makeVelocity('w1', 20),
        makeVelocity('w2', 10),
      ];
      fixture.detectChanges();
      expect(comp.getSparkHeight(10)).toBe(50);
      expect(comp.getSparkHeight(20)).toBe(100);
    });
  });

  describe('template rendering', () => {
    it('should show no workload data message when empty', () => {
      expect(el.textContent).toContain('No workload data available');
    });

    it('should show member names when workloads provided', () => {
      host.workloads = [makeWorkload({ user_name: 'Bob Jones' })];
      fixture.detectChanges();
      expect(el.textContent).toContain('Bob Jones');
    });

    it('should show overloaded message for overloaded members', () => {
      host.workloads = [
        makeWorkload({ user_id: 'u-1', active_tasks: 12 }),
      ];
      fixture.detectChanges();
      expect(el.textContent).toContain('1 member overloaded');
    });

    it('should pluralize overloaded message', () => {
      host.workloads = [
        makeWorkload({ user_id: 'u-1', active_tasks: 10 }),
        makeWorkload({ user_id: 'u-2', active_tasks: 15 }),
      ];
      fixture.detectChanges();
      expect(el.textContent).toContain('2 members overloaded');
    });

    it('should show no velocity message when empty', () => {
      expect(el.textContent).toContain('No velocity data yet');
    });

    it('should display latest velocity value', () => {
      host.velocity = [makeVelocity('w1', 42)];
      fixture.detectChanges();
      expect(el.textContent).toContain('42');
      expect(el.textContent).toContain('/week');
    });
  });
});
