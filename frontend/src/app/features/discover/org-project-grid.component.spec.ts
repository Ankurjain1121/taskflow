import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { OrgProjectGridComponent } from './org-project-grid.component';
import { Component } from '@angular/core';
import { PortfolioProject } from '../../core/services/portfolio.service';
import { Workspace } from '../../core/services/workspace.service';

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: 'Test Workspace',
    description: null,
    logo_url: null,
    created_by_id: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProject(overrides: Partial<PortfolioProject> = {}): PortfolioProject {
  return {
    id: 'proj-1',
    name: 'Test Project',
    description: null,
    prefix: null,
    background_color: null,
    created_at: '2026-01-01T00:00:00Z',
    total_tasks: 20,
    completed_tasks: 10,
    overdue_tasks: 2,
    active_tasks: 8,
    member_count: 4,
    progress_pct: 50,
    health: 'on_track',
    next_milestone_name: null,
    next_milestone_due: null,
    ...overrides,
  };
}

@Component({
  standalone: true,
  imports: [OrgProjectGridComponent],
  template: `<app-org-project-grid [projectGroups]="groups" />`,
})
class TestHostComponent {
  groups: { workspace: Workspace; projects: PortfolioProject[] }[] = [];
}

describe('OrgProjectGridComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('should create', () => {
    expect(el.querySelector('app-org-project-grid')).toBeTruthy();
  });

  describe('isEmpty computed', () => {
    it('should be true when projectGroups is empty', () => {
      host.groups = [];
      fixture.detectChanges();
      const comp = fixture.debugElement.children[0].componentInstance as OrgProjectGridComponent;
      expect(comp.isEmpty()).toBe(true);
    });

    it('should be true when all groups have empty projects', () => {
      host.groups = [{ workspace: makeWorkspace(), projects: [] }];
      fixture.detectChanges();
      const comp = fixture.debugElement.children[0].componentInstance as OrgProjectGridComponent;
      expect(comp.isEmpty()).toBe(true);
    });

    it('should be false when groups have projects', () => {
      host.groups = [
        { workspace: makeWorkspace(), projects: [makeProject()] },
      ];
      fixture.detectChanges();
      const comp = fixture.debugElement.children[0].componentInstance as OrgProjectGridComponent;
      expect(comp.isEmpty()).toBe(false);
    });
  });

  describe('getHealthColor', () => {
    let comp: OrgProjectGridComponent;

    beforeEach(() => {
      comp = fixture.debugElement.children[0].componentInstance as OrgProjectGridComponent;
    });

    it('should return green for on_track', () => {
      expect(comp.getHealthColor('on_track')).toBe('#5E8C4A');
    });

    it('should return amber for at_risk', () => {
      expect(comp.getHealthColor('at_risk')).toBe('#D4A853');
    });

    it('should return red for behind', () => {
      expect(comp.getHealthColor('behind')).toBe('#B81414');
    });

    it('should return gray for unknown', () => {
      expect(comp.getHealthColor('unknown')).toBe('#9F9F9F');
    });
  });

  describe('getHealthIcon', () => {
    let comp: OrgProjectGridComponent;

    beforeEach(() => {
      comp = fixture.debugElement.children[0].componentInstance as OrgProjectGridComponent;
    });

    it('should return checkmark for on_track', () => {
      expect(comp.getHealthIcon('on_track')).toBe('\u2713');
    });

    it('should return warning for at_risk', () => {
      expect(comp.getHealthIcon('at_risk')).toBe('\u26A0');
    });

    it('should return exclamation for behind', () => {
      expect(comp.getHealthIcon('behind')).toBe('!');
    });

    it('should return question mark for unknown', () => {
      expect(comp.getHealthIcon('unknown')).toBe('?');
    });
  });

  describe('getHealthClass', () => {
    let comp: OrgProjectGridComponent;

    beforeEach(() => {
      comp = fixture.debugElement.children[0].componentInstance as OrgProjectGridComponent;
    });

    it('should return health-green for on_track', () => {
      expect(comp.getHealthClass('on_track')).toBe('health-green');
    });

    it('should return health-amber for at_risk', () => {
      expect(comp.getHealthClass('at_risk')).toBe('health-amber');
    });

    it('should return health-red for behind', () => {
      expect(comp.getHealthClass('behind')).toBe('health-red');
    });

    it('should return health-gray for unknown', () => {
      expect(comp.getHealthClass('unknown')).toBe('health-gray');
    });
  });

  describe('template rendering', () => {
    it('should show empty message when no projects', () => {
      host.groups = [];
      fixture.detectChanges();
      expect(el.textContent).toContain(
        'Create projects to track your organization',
      );
    });

    it('should render workspace name and project cards', () => {
      host.groups = [
        {
          workspace: makeWorkspace({ name: 'Engineering' }),
          projects: [
            makeProject({ name: 'API Rewrite', progress_pct: 75, total_tasks: 40 }),
          ],
        },
      ];
      fixture.detectChanges();

      expect(el.textContent).toContain('Engineering');
      expect(el.textContent).toContain('API Rewrite');
      expect(el.textContent).toContain('75% complete');
      expect(el.textContent).toContain('40 tasks');
    });

    it('should show overdue count when project has overdue tasks', () => {
      host.groups = [
        {
          workspace: makeWorkspace(),
          projects: [makeProject({ overdue_tasks: 5 })],
        },
      ];
      fixture.detectChanges();
      expect(el.textContent).toContain('5 overdue');
    });

    it('should not show overdue text when overdue is 0', () => {
      host.groups = [
        {
          workspace: makeWorkspace(),
          projects: [makeProject({ overdue_tasks: 0 })],
        },
      ];
      fixture.detectChanges();
      expect(el.textContent).not.toContain('overdue');
    });
  });
});
