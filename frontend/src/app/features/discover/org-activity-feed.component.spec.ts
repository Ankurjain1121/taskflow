import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrgActivityFeedComponent } from './org-activity-feed.component';
import { Component } from '@angular/core';
import { DashboardActivityEntry } from '../../core/services/dashboard.service';

function makeActivity(overrides: Partial<DashboardActivityEntry> = {}): DashboardActivityEntry {
  return {
    id: 'act-1',
    action: 'created',
    entity_type: 'task',
    entity_id: 'task-1',
    metadata: { title: 'New Task' },
    created_at: new Date().toISOString(),
    actor_name: 'Alice Smith',
    actor_avatar_url: null,
    ...overrides,
  };
}

@Component({
  standalone: true,
  imports: [OrgActivityFeedComponent],
  template: `<app-org-activity-feed [activities]="activities" />`,
})
class TestHostComponent {
  activities: DashboardActivityEntry[] = [];
}

describe('OrgActivityFeedComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;
  let comp: OrgActivityFeedComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
    comp = fixture.debugElement.children[0].componentInstance as OrgActivityFeedComponent;
  });

  it('should create', () => {
    expect(el.querySelector('app-org-activity-feed')).toBeTruthy();
  });

  describe('getInitials', () => {
    it('should return initials from full name', () => {
      expect(comp.getInitials('Alice Smith')).toBe('AS');
    });

    it('should return ? for empty name', () => {
      expect(comp.getInitials('')).toBe('?');
    });

    it('should handle single name', () => {
      expect(comp.getInitials('Alice')).toBe('A');
    });

    it('should limit to 2 characters', () => {
      expect(comp.getInitials('John Michael Smith')).toBe('JM');
    });
  });

  describe('formatAction', () => {
    it('should format action with title from metadata', () => {
      const entry = makeActivity({
        action: 'created',
        metadata: { title: 'Setup CI' },
      });
      expect(comp.formatAction(entry)).toBe('created "Setup CI"');
    });

    it('should fall back to name in metadata', () => {
      const entry = makeActivity({
        action: 'updated',
        metadata: { name: 'My Board' },
      });
      expect(comp.formatAction(entry)).toBe('updated "My Board"');
    });

    it('should fall back to entity_type when no title or name', () => {
      const entry = makeActivity({
        action: 'deleted',
        entity_type: 'board',
        metadata: {},
      });
      expect(comp.formatAction(entry)).toBe('deleted "board"');
    });

    it('should include project name when present', () => {
      const entry = makeActivity({
        action: 'created',
        metadata: { title: 'Fix bug', project_name: 'Backend' },
      });
      expect(comp.formatAction(entry)).toBe('created "Fix bug" in Backend');
    });

    it('should replace underscores with spaces in action', () => {
      const entry = makeActivity({
        action: 'moved_task',
        metadata: { title: 'Test' },
      });
      expect(comp.formatAction(entry)).toBe('moved task "Test"');
    });

    it('should handle null metadata', () => {
      const entry = makeActivity({
        action: 'created',
        entity_type: 'task',
        metadata: null,
      });
      expect(comp.formatAction(entry)).toBe('created "task"');
    });
  });

  describe('formatTimeAgo', () => {
    it('should return "just now" for recent timestamps', () => {
      const now = new Date().toISOString();
      expect(comp.formatTimeAgo(now)).toBe('just now');
    });

    it('should return minutes ago', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(comp.formatTimeAgo(fiveMinAgo)).toBe('5m ago');
    });

    it('should return hours ago', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      expect(comp.formatTimeAgo(threeHoursAgo)).toBe('3h ago');
    });

    it('should return days ago', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
      expect(comp.formatTimeAgo(twoDaysAgo)).toBe('2d ago');
    });

    it('should return formatted date for older entries', () => {
      const oldDate = new Date(Date.now() - 14 * 86400 * 1000).toISOString();
      const result = comp.formatTimeAgo(oldDate);
      // Should contain month abbreviation and day number
      expect(result).toMatch(/\w+ \d+/);
    });
  });

  describe('template rendering', () => {
    it('should show empty message when no activities', () => {
      expect(el.textContent).toContain('No recent activity');
    });

    it('should render activity entries', () => {
      host.activities = [
        makeActivity({
          actor_name: 'Bob Jones',
          action: 'created',
          metadata: { title: 'Deploy v2' },
        }),
      ];
      fixture.detectChanges();

      expect(el.textContent).toContain('Bob Jones');
      expect(el.textContent).toContain('Deploy v2');
    });

    it('should show actor initials in avatar', () => {
      host.activities = [makeActivity({ actor_name: 'Charlie Delta' })];
      fixture.detectChanges();

      const avatar = el.querySelector('.rounded-full');
      expect(avatar?.textContent?.trim()).toBe('CD');
    });

    it('should render multiple activities', () => {
      host.activities = [
        makeActivity({ id: 'a-1', actor_name: 'User One' }),
        makeActivity({ id: 'a-2', actor_name: 'User Two' }),
      ];
      fixture.detectChanges();

      expect(el.textContent).toContain('User One');
      expect(el.textContent).toContain('User Two');
    });
  });
});
