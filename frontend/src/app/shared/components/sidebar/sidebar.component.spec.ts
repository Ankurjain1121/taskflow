import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SidebarComponent } from './sidebar.component';
import { NotificationService } from '../../../core/services/notification.service';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let mockNotificationService: any;
  let mockWsContextService: any;

  beforeEach(async () => {
    mockNotificationService = {
      unreadCount: signal(0),
    };

    mockWsContextService = {
      activeWorkspaceId: signal<string | null>('ws-1'),
      activeWorkspace: signal(null),
      getWorkspaceColor: vi.fn().mockReturnValue('#6366f1'),
      workspaces: signal([]),
      loading: signal(false),
      setActiveWorkspace: vi.fn(),
      switchWorkspace: vi.fn(),
      loadWorkspaces: vi.fn(),
      projects: signal([]),
      projectsLoading: signal(false),
      loadProjects: vi.fn(),
      getProjectColor: vi.fn().mockReturnValue('#6366f1'),
      getOrderedProjects: vi.fn().mockReturnValue([]),
      saveProjectOrder: vi.fn(),
      projectOrder: signal([]),
      setProjectOrder: vi.fn(),
      favoriteProjects: signal([]),
      recentProjects: signal([]),
    };

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: WorkspaceContextService, useValue: mockWsContextService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit toggleCollapse', () => {
    const spy = vi.spyOn(component.toggleCollapse, 'emit');
    component.toggleCollapse.emit();
    expect(spy).toHaveBeenCalled();
  });

  it('should compute dashboardRoute from workspace context', () => {
    expect(component.dashboardRoute()).toBe('/workspace/ws-1/dashboard');
  });

  it('should compute myWorkRoute from workspace context', () => {
    expect(component.myWorkRoute()).toBe('/workspace/ws-1/my-work');
  });

  it('should compute inboxRoute from workspace context', () => {
    expect(component.inboxRoute()).toBe('/workspace/ws-1/inbox');
  });

  it('should compute routes with empty base when no workspace', () => {
    mockWsContextService.activeWorkspaceId.set(null);
    expect(component.dashboardRoute()).toBe('/dashboard');
    expect(component.myWorkRoute()).toBe('/my-work');
    expect(component.inboxRoute()).toBe('/inbox');
  });

  it('should expose unreadCount from notification service', () => {
    expect(component.unreadCount()).toBe(0);
    mockNotificationService.unreadCount.set(5);
    expect(component.unreadCount()).toBe(5);
  });

  it('should emit sidebarClose on navClick when mobile is open', () => {
    const spy = vi.spyOn(component.sidebarClose, 'emit');
    fixture.componentRef.setInput('isMobileOpen', true);
    fixture.detectChanges();
    component.onNavClick();
    expect(spy).toHaveBeenCalled();
  });

  it('should not emit sidebarClose on navClick when mobile is not open', () => {
    const spy = vi.spyOn(component.sidebarClose, 'emit');
    fixture.componentRef.setInput('isMobileOpen', false);
    fixture.detectChanges();
    component.onNavClick();
    expect(spy).not.toHaveBeenCalled();
  });

  it('should have focusIndex initialized to -1', () => {
    expect(component.focusIndex()).toBe(-1);
  });

  it('should not throw on onSidebarKeydown with no focusable items', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    expect(() => component.onSidebarKeydown(event)).not.toThrow();
  });
});
