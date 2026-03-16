import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SidebarComponent } from './sidebar.component';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let mockWorkspaceService: any;
  let mockAuthService: any;
  let mockNotificationService: any;

  beforeEach(async () => {
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

    mockWorkspaceService = {
      list: vi.fn().mockReturnValue(
        of([
          {
            id: 'ws-1',
            name: 'Alpha',
            slug: 'alpha',
            owner_id: 'u-1',
            created_at: '',
            updated_at: '',
          },
          {
            id: 'ws-2',
            name: 'Beta',
            slug: 'beta',
            owner_id: 'u-1',
            created_at: '',
            updated_at: '',
          },
        ]),
      ),
      create: vi
        .fn()
        .mockReturnValue(
          of({
            id: 'ws-new',
            name: 'New',
            slug: 'new',
            owner_id: 'u-1',
            created_at: '',
            updated_at: '',
          }),
        ),
    };

    mockAuthService = {
      currentUser: signal({
        id: 'u-1',
        name: 'Alice',
        email: 'alice@test.com',
        avatar_url: null,
        role: 'Member' as const,
        tenant_id: 't-1',
        onboarding_completed: true,
      }),
      isAuthenticated: vi.fn().mockReturnValue(true),
      signOut: vi.fn(),
    };

    mockNotificationService = {
      unreadCount: signal(0),
    };

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load workspaces on init', () => {
    component.ngOnInit();
    expect(mockWorkspaceService.list).toHaveBeenCalled();
    expect(component.workspaces().length).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should handle workspace load error', () => {
    mockWorkspaceService.list.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.ngOnInit();
    expect(component.loading()).toBe(false);
  });

  it('should emit toggleCollapse', () => {
    const spy = vi.spyOn(component.toggleCollapse, 'emit');
    component.toggleCollapse.emit();
    expect(spy).toHaveBeenCalled();
  });

  it('should determine canCreateWorkspace', () => {
    expect(component.canCreateWorkspace()).toBe(true);
    mockAuthService.currentUser.set(null as any);
    expect(component.canCreateWorkspace()).toBe(false);
    // Reset
    mockAuthService.currentUser.set({
      id: 'u-1',
      name: 'Alice',
      email: 'alice@test.com',
      avatar_url: null,
      role: 'Member' as const,
      tenant_id: 't-1',
      onboarding_completed: true,
    });
  });

  it('should compute workspace color from name', () => {
    const ws = {
      id: 'ws-1',
      name: 'Alpha',
      slug: 'alpha',
      owner_id: 'u-1',
      created_at: '',
      updated_at: '',
    };
    const color = component.getWorkspaceColor(ws as any);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should show create workspace dialog', () => {
    component.onCreateWorkspace();
    expect(component.showCreateWorkspaceDialog()).toBe(true);
  });

  it('should create workspace and navigate', () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');
    component.onWorkspaceCreated({ name: 'New WS' } as any);
    expect(mockWorkspaceService.create).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(['/workspace', 'ws-new']);
    expect(component.workspaces().length).toBeGreaterThanOrEqual(1);
  });

  it('should toggle profile menu', () => {
    expect(component.profileMenuOpen()).toBe(false);
    component.toggleProfileMenu();
    expect(component.profileMenuOpen()).toBe(true);
    component.toggleProfileMenu();
    expect(component.profileMenuOpen()).toBe(false);
  });

  it('should sign out via handleSignOut', () => {
    component.profileMenuOpen.set(true);
    component.handleSignOut();
    expect(mockAuthService.signOut).toHaveBeenCalledWith('manual');
    expect(component.profileMenuOpen()).toBe(false);
  });

  it('should compute user initials', () => {
    expect(component.getUserInitials('Alice Smith')).toBe('AS');
    expect(component.getUserInitials('Bob')).toBe('B');
  });
});
