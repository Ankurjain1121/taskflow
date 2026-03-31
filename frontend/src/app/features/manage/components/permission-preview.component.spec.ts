import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PermissionPreviewComponent } from './permission-preview.component';
import { Capabilities } from '../../../core/services/permission.service';

function makeCapabilities(overrides: Partial<Capabilities> = {}): Capabilities {
  return {
    can_view_all_tasks: false,
    can_create_tasks: false,
    can_edit_own_tasks: false,
    can_edit_all_tasks: false,
    can_delete_tasks: false,
    can_manage_members: false,
    can_manage_project_settings: false,
    can_manage_automations: false,
    can_export: false,
    can_manage_billing: false,
    can_invite_members: false,
    can_manage_roles: false,
    ...overrides,
  };
}

describe('PermissionPreviewComponent', () => {
  let component: PermissionPreviewComponent;
  let fixture: ComponentFixture<PermissionPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionPreviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PermissionPreviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have null capabilities by default', () => {
      expect(component.capabilities()).toBeNull();
    });

    it('should expose 4 capability groups', () => {
      expect(component.groups).toHaveLength(4);
    });

    it('should have group names TASKS, PROJECT, WORKSPACE, DATA', () => {
      const names = component.groups.map((g) => g.name);
      expect(names).toEqual(['TASKS', 'PROJECT', 'WORKSPACE', 'DATA']);
    });

    it('should have 12 skeleton lines', () => {
      expect(component.skeletonLines).toHaveLength(12);
    });
  });

  describe('groups structure', () => {
    it('TASKS group should have 4 items', () => {
      const tasks = component.groups.find((g) => g.name === 'TASKS');
      expect(tasks?.items).toHaveLength(4);
    });

    it('PROJECT group should have 2 items', () => {
      const project = component.groups.find((g) => g.name === 'PROJECT');
      expect(project?.items).toHaveLength(2);
    });

    it('WORKSPACE group should have 4 items', () => {
      const workspace = component.groups.find(
        (g) => g.name === 'WORKSPACE',
      );
      expect(workspace?.items).toHaveLength(4);
    });

    it('DATA group should have 2 items', () => {
      const data = component.groups.find((g) => g.name === 'DATA');
      expect(data?.items).toHaveLength(2);
    });
  });

  describe('template rendering', () => {
    it('should show skeleton when capabilities is null', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const pulseElements = el.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBe(12);
    });

    it('should show capability list when capabilities are provided', () => {
      fixture.componentRef.setInput('capabilities', makeCapabilities());
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const heading = el.querySelector('p');
      expect(heading?.textContent).toContain('With this role, user can:');
    });

    it('should render allowed check mark for enabled capabilities', () => {
      fixture.componentRef.setInput(
        'capabilities',
        makeCapabilities({ can_create_tasks: true }),
      );
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const allowed = el.querySelectorAll('[aria-label="allowed"]');
      expect(allowed.length).toBeGreaterThan(0);
    });

    it('should render denied mark for disabled capabilities', () => {
      fixture.componentRef.setInput('capabilities', makeCapabilities());
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const denied = el.querySelectorAll('[aria-label="denied"]');
      // All 12 capabilities are false, so all should be denied
      expect(denied.length).toBe(12);
    });

    it('should show correct mix of allowed and denied marks', () => {
      fixture.componentRef.setInput(
        'capabilities',
        makeCapabilities({
          can_create_tasks: true,
          can_edit_own_tasks: true,
          can_export: true,
        }),
      );
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const allowed = el.querySelectorAll('[aria-label="allowed"]');
      const denied = el.querySelectorAll('[aria-label="denied"]');
      expect(allowed.length).toBe(3);
      expect(denied.length).toBe(9);
    });
  });
});
